<?php

namespace App\Domain\Inbox;

use App\Domain\Radio\Station;
use App\Domain\Site\Sermons\ChannelLive;
use App\Models\LiveStream;
use App\Models\RadioEpisode;
use App\Models\RadioSlot;
use App\Models\Sermon;
use App\Models\SitePushSubscription;
use App\Models\SiteSetting;
use App\Models\Teaching;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * The notifications of the public site, checked every minute by the scheduler:
 *  - a radio program (recorded or live) is about to start: REMINDER_MINUTES before;
 *  - the church went live on video (from the panel or straight on its YouTube channel);
 *  - a new YouTube video reached Prédicas or Enseñanzas;
 * and, for the panel, the channel videos waiting for an admin to approve them.
 *
 * What was already announced is kept in a site setting, so a notice never repeats
 * (not even after a deploy clears the cache) and the first run only takes note of
 * what is already on the site instead of announcing all of it.
 */
final class SiteAlerts
{
    public const REMINDER_MINUTES = 5;

    /** Main-program blocks worth a reminder: recorded programs and live shows (not songs, spots or automatic music). */
    private const PROGRAM_KINDS = ['programa', RadioSlot::LIVE];

    /** A live broadcast is announced only while it is this fresh, so a late check never sends a stale notice. */
    private const LIVE_FRESH_MINUTES = 30;

    /** Only videos from the last days are announced; an old one approved today joins the site quietly. */
    private const VIDEO_FRESH_DAYS = 3;

    private const SENT = 'push.sent';

    private const VIDEOS = 'push.videos';

    private const PENDING = 'push.pending';

    /** Announced radio reminders and broadcasts are remembered this long. */
    private const SENT_DAYS = 3;

    private const VIDEOS_KEPT = 500;

    /** @return array{radio: int, live: int, videos: int, pending: int} notices sent */
    public static function run(): array
    {
        return [
            'radio' => self::radioReminders(),
            'live' => self::liveStarted(),
            'videos' => self::newVideos(),
            'pending' => self::pendingSermons(),
        ];
    }

    /**
     * One notice to every visitor's browser that turned the notifications on.
     *
     * @param  array{title: string, body?: string, url?: string, tag?: string}  $payload
     */
    public static function broadcast(array $payload, int $ttl = 86400): void
    {
        SitePushSubscription::query()->chunkById(1000, fn (Collection $devices) => app(PushDelivery::class)->send($devices, $payload, $ttl));
    }

    private static function radioReminders(): int
    {
        if (! Station::config()['on_air']) {
            return 0;
        }
        $now = CarbonImmutable::now();
        $slots = RadioSlot::query()->with('track')
            ->where('layer', RadioSlot::MAIN)
            ->whereIn('kind', self::PROGRAM_KINDS)
            ->where('starts_at', '>', $now)
            ->where('starts_at', '<=', $now->addMinutes(self::REMINDER_MINUTES))
            ->orderBy('starts_at')->get();

        $sent = 0;
        foreach ($slots as $slot) {
            if (! self::firstTime('radio.'.$slot->id.'.'.$slot->starts_at->getTimestampMs())) {
                continue;
            }
            $seconds = (int) $now->diffInSeconds($slot->starts_at);
            $minutes = max(1, (int) ceil($seconds / 60));
            self::broadcast([
                'title' => $minutes === 1 ? 'Radio Zoe · comienza en 1 minuto' : "Radio Zoe · comienza en {$minutes} minutos",
                'body' => '«'.self::programTitle($slot).'» empieza a las '.self::clock($slot->starts_at).' Toca para escucharlo en vivo.',
                'url' => '/radio',
                'tag' => 'radio-'.$slot->id,
            ], $seconds + 600);
            $sent++;
        }

        return $sent;
    }

    /**
     * A broadcast from the panel (OBS through the site) or, when there is none, one streamed
     * straight to the YouTube channel; the same service is never announced twice.
     */
    private static function liveStarted(): int
    {
        $fresh = now()->subMinutes(self::LIVE_FRESH_MINUTES);
        if (LiveStream::query()->where('status', 'live')->exists()) {
            $live = LiveStream::query()
                ->where('status', 'live')
                ->whereNotNull('signal_at')
                ->whereNull('signal_lost_at')
                ->where('started_at', '>=', $fresh)
                ->latest('started_at')->first();

            return $live && self::firstTime('live.'.$live->id) ? self::announceLive($live->title, 'live-'.$live->id) : 0;
        }

        $channel = ChannelLive::current();
        $started = $channel && $channel['started_at'] ? CarbonImmutable::parse($channel['started_at']) : null;
        if (! $channel || ($started && $started->lt($fresh)) || ! self::firstTime('youtube.'.$channel['id'])) {
            return 0;
        }

        return self::announceLive($channel['title'], 'live-'.$channel['id']);
    }

    private static function announceLive(?string $title, string $tag): int
    {
        self::broadcast([
            'title' => 'Estamos en vivo',
            'body' => trim(($title ?: 'Iglesia Cristiana Zoe').'. Míralo ahora desde la web.'),
            'url' => '/predicas#en-vivo',
            'tag' => $tag,
        ], 2 * 3600);

        return 1;
    }

    private static function newVideos(): int
    {
        $fresh = now()->subDays(self::VIDEO_FRESH_DAYS);
        $seen = self::stored(self::VIDEOS);
        if ($seen === null) {
            $all = Sermon::query()->whereNotNull('youtube_id')->pluck('youtube_id')
                ->merge(Teaching::query()->whereNotNull('youtube_id')->pluck('youtube_id'))
                ->unique()->values()->all();
            self::store(self::VIDEOS, array_slice($all, -self::VIDEOS_KEPT));

            return 0;
        }

        $sermons = Sermon::query()->onSite()->whereNotNull('youtube_id')
            ->where(fn ($query) => $query->where('aired_at', '>=', $fresh)->orWhere(fn ($query) => $query->whereNull('aired_at')->where('created_at', '>=', $fresh)))
            ->limit(20)->get()
            ->map(fn (Sermon $sermon) => ['id' => $sermon->youtube_id, 'title' => $sermon->title, 'url' => '/predicas?v='.$sermon->youtube_id]);
        $teachings = Teaching::query()->onSite()->whereNotNull('youtube_id')->where('created_at', '>=', $fresh)
            ->latest()->limit(20)->get()
            ->filter(fn (Teaching $teaching) => $teaching->hasPublicVideo())
            ->map(fn (Teaching $teaching) => ['id' => $teaching->youtube_id, 'title' => $teaching->title, 'url' => '/recursos#ensenanza-'.$teaching->id]);

        $known = array_flip($seen);
        $new = $sermons->concat($teachings)->unique('id')->reject(fn (array $video) => isset($known[$video['id']]))->values();
        if ($new->isEmpty()) {
            return 0;
        }
        self::store(self::VIDEOS, array_slice([...$seen, ...$new->pluck('id')->all()], -self::VIDEOS_KEPT));

        $latest = $new->first();
        $more = $new->count() - 1;
        self::broadcast([
            'title' => $more ? 'Nuevas prédicas en la web' : 'Nueva prédica en la web',
            'body' => '«'.$latest['title'].'»'.($more ? ($more === 1 ? ' y 1 más' : " y {$more} más") : '').'. Mírala ahora.',
            'url' => $latest['url'],
            'tag' => 'video-'.$latest['id'],
        ], 3 * 86400);

        return 1;
    }

    private static function pendingSermons(): int
    {
        $pending = Sermon::query()->where('pending', true)->latest()->limit(50)->get(['id', 'title']);
        $seen = self::stored(self::PENDING);
        $ids = $pending->pluck('id')->all();
        if ($seen === null) {
            self::store(self::PENDING, $ids);

            return 0;
        }

        $known = array_flip($seen);
        $new = $pending->reject(fn (Sermon $sermon) => isset($known[$sermon->id]))->values();
        if ($new->isEmpty()) {
            if (array_diff($seen, $ids)) {
                self::store(self::PENDING, array_values(array_intersect($seen, $ids)));
            }

            return 0;
        }
        self::store(self::PENDING, $ids);

        $count = $new->count();
        PushNotifier::toPanel('content.manage', [
            'title' => $count === 1 ? 'Una prédica nueva espera tu revisión' : "{$count} prédicas nuevas esperan tu revisión",
            'body' => '«'.$new->first()->title.'»'.($count > 1 ? ' y '.($count - 1).' más' : '').' llegaron del canal de YouTube. Apruébalas para que salgan en la web.',
            'url' => '/admin/predicas',
            'tag' => 'sermons-pending',
        ]);

        return 1;
    }

    /** A recorded program goes by its episode name when it has one. */
    private static function programTitle(RadioSlot $slot): string
    {
        $episode = $slot->radio_track_id
            ? RadioEpisode::query()->where('radio_track_id', $slot->radio_track_id)->where('published', true)->latest('aired_on')->value('title')
            : null;

        return $episode ?: ($slot->title ?: ($slot->track?->title ?: 'Programa de Radio Zoe'));
    }

    /** «8:00 p. m.» in Lima. */
    private static function clock(CarbonImmutable $at): string
    {
        $local = $at->setTimezone(Station::TZ);

        return $local->format('g:i').($local->hour < 12 ? ' a. m.' : ' p. m.');
    }

    /** True the first time a notice key is seen; the remembered keys expire after SENT_DAYS. */
    private static function firstTime(string $key): bool
    {
        $now = time();
        $sent = array_filter(self::stored(self::SENT) ?? [], fn ($at) => is_int($at) && $at > $now - self::SENT_DAYS * 86400);
        if (isset($sent[$key])) {
            return false;
        }
        $sent[$key] = $now;
        self::store(self::SENT, $sent);

        return true;
    }

    /** @return array<array-key, mixed>|null */
    private static function stored(string $key): ?array
    {
        $value = SiteSetting::query()->find($key)?->value;

        return is_array($value) ? $value : null;
    }

    /** @param  array<array-key, mixed>  $value */
    private static function store(string $key, array $value): void
    {
        SiteSetting::withoutEvents(fn () => SiteSetting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_at' => now()]));
    }
}
