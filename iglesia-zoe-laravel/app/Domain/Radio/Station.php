<?php

namespace App\Domain\Radio;

use App\Models\RadioListener;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\SiteSetting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The radio station: what is on air at any moment and the live state of the console.
 *
 * Every listener computes the same program from the server clock: scheduled blocks of
 * the timeline play at their exact time and, when the timeline has a gap, the music
 * library fills it in a deterministic order, so everybody hears the same song.
 */
final class Station
{
    public const TZ = 'America/Lima';

    /** Longest block the timeline accepts, in seconds. */
    public const MAX_BLOCK = 6 * 3600;

    public const DEFAULTS = [
        'name' => 'Radio Zoe',
        'tagline' => 'Música, Palabra y esperanza las 24 horas.',
        'on_air' => true,
        'autofill' => true,
        'bed_level' => 22,
        'fx_level' => 90,
        'stream_url' => '',
        'turn_url' => '',
        'turn_username' => '',
        'turn_credential' => '',
        'max_voice' => 60,
    ];

    private const LIVE_DEFAULTS = [
        'session' => null,
        'host' => '',
        'started_at' => null,
        'music' => 100,
        'muted' => false,
        'bed' => false,
        'mic' => false,
        'fx' => [],
        'rev' => 0,
    ];

    /** The console sends a heartbeat every ~1.5 s; after this many seconds of silence the live session ends. */
    private const OPERATOR_TIMEOUT = 25;

    private const LISTENER_WINDOW = 40;

    /** 2026-01-01 00:00 in Lima: start of the music rotation when the timeline has never had a block. */
    private const ROTATION_EPOCH = 1767243600000;

    private const CONFIG_KEY = 'radio.config';

    private const LIVE_KEY = 'radio.live';

    private const OPERATOR_KEY = 'radio.operator';

    private const ROTATION_KEY = 'radio.rotation';

    public static function nowMs(): int
    {
        return CarbonImmutable::now()->getTimestampMs();
    }

    public static function config(): array
    {
        return Cache::rememberForever(self::CONFIG_KEY, function () {
            $stored = SiteSetting::query()->find('radio')?->value;

            return array_replace(self::DEFAULTS, is_array($stored) ? array_intersect_key($stored, self::DEFAULTS) : []);
        });
    }

    public static function saveConfig(array $values): array
    {
        $next = array_replace(self::config(), array_intersect_key($values, self::DEFAULTS));
        SiteSetting::query()->updateOrCreate(['key' => 'radio'], ['value' => $next, 'updated_at' => now()]);
        Cache::forget(self::CONFIG_KEY);

        return $next;
    }

    /** Called whenever the library or the timeline changes. */
    public static function flush(): void
    {
        Cache::forget(self::ROTATION_KEY);
    }

    /* ---------------------------------------------------------------- live */

    public static function live(): array
    {
        $live = self::storedLive();
        if ($live['session'] && (int) Cache::get(self::OPERATOR_KEY, 0) < CarbonImmutable::now()->getTimestamp() - self::OPERATOR_TIMEOUT) {
            return self::endLive();
        }

        return $live;
    }

    /** @param  callable(array): array  $change */
    public static function updateLive(callable $change): array
    {
        return Cache::lock('radio.live.lock', 5)->block(3, function () use ($change) {
            $live = self::storedLive();
            $next = array_replace($live, $change($live));
            $next['rev'] = $live['rev'] + 1;
            Cache::forever(self::LIVE_KEY, $next);

            return $next;
        });
    }

    public static function startLive(string $host): array
    {
        self::heartbeat();

        return self::updateLive(fn (array $live) => $live['session'] ? ['host' => $host] : [
            'session' => Str::lower(Str::random(24)),
            'host' => $host,
            'started_at' => self::nowMs(),
            'mic' => false,
            'bed' => false,
            'muted' => false,
        ]);
    }

    public static function endLive(): array
    {
        $session = self::storedLive()['session'];
        if ($session) {
            Signal::close($session);
        }

        return self::updateLive(fn () => ['session' => null, 'host' => '', 'started_at' => null, 'mic' => false, 'bed' => false, 'muted' => false]);
    }

    public static function heartbeat(): void
    {
        Cache::put(self::OPERATOR_KEY, CarbonImmutable::now()->getTimestamp(), 3600);
    }

    public static function fire(RadioTrack $track): array
    {
        $now = self::nowMs();

        return self::updateLive(function (array $live) use ($track, $now) {
            $recent = array_values(array_filter($live['fx'], fn ($fx) => $fx['at'] > $now - 30000));
            $recent[] = ['id' => Str::lower(Str::random(10)), 'src' => $track->file_path, 'title' => $track->title, 'kind' => $track->kind, 'at' => $now];

            return ['fx' => array_slice($recent, -8)];
        });
    }

    /** Gains every listener applies: the music bus (after the console faders) and the effects bus. */
    public static function mix(array $live, array $config): array
    {
        $music = $live['muted'] ? 0.0 : ($live['music'] / 100) * ($live['bed'] ? $config['bed_level'] / 100 : 1);

        return [
            'music' => round($music, 3),
            'fx' => round($config['fx_level'] / 100, 3),
            'bed' => round($config['bed_level'] / 100, 3),
        ];
    }

    /* ------------------------------------------------------------- program */

    /**
     * Playable items overlapping [from, to), in order. With $expand the gaps are filled
     * song by song; without it each gap is one «Música continua» block (for timelines).
     *
     * @return list<array<string, mixed>>
     */
    public static function items(int $from, int $to, bool $expand = true, int $limit = 600): array
    {
        $config = self::config();
        $rotation = $config['autofill'] ? self::rotation() : [];
        $slots = self::slotsBetween($from, $to);
        $items = [];
        $cursor = $from;
        $anchor = null;

        foreach ($slots as $slot) {
            $start = $slot->starts_at->getTimestampMs();
            $end = $slot->endsAt()->getTimestampMs();
            if ($end <= $cursor) {
                continue;
            }
            if ($start > $cursor) {
                $anchor ??= $cursor === $from ? self::anchorBefore($from) : $cursor;
                array_push($items, ...self::gap($rotation, $anchor, $cursor, min($start, $to), $expand, $limit));
            }
            $begin = max($start, $cursor);
            $finish = min($end, $to);
            if ($slot->kind === RadioSlot::LIVE && $slot->bed && $expand && $rotation) {
                array_push($items, ...self::fill($rotation, $start, $begin, $finish, $slot->title, $limit));
            } else {
                $items[] = self::slotItem($slot, $begin, $finish);
            }
            $cursor = $end;
            $anchor = $end;
            if ($cursor >= $to || count($items) >= $limit) {
                break;
            }
        }

        if ($cursor < $to && count($items) < $limit) {
            $anchor ??= self::anchorBefore($from);
            array_push($items, ...self::gap($rotation, $cursor === $from ? $anchor : $cursor, $cursor, $to, $expand, $limit));
        }

        return array_slice($items, 0, $limit);
    }

    /** UTC milliseconds of 00:00 and 24:00 of a Lima calendar day. */
    public static function dayBounds(string $date): array
    {
        $start = CarbonImmutable::parse($date, self::TZ)->startOfDay();

        return [$start->getTimestampMs(), $start->addDay()->getTimestampMs()];
    }

    public static function today(): string
    {
        return CarbonImmutable::now(self::TZ)->toDateString();
    }

    /** Public snapshot polled by every listener. */
    public static function state(): array
    {
        $config = self::config();
        $live = self::live();
        $now = self::nowMs();
        $onAir = (bool) $config['on_air'];
        $next = $onAir ? RadioSlot::query()->where('starts_at', '>', CarbonImmutable::createFromTimestampMs($now))->orderBy('starts_at')->first() : null;

        return [
            'now' => $now,
            'name' => $config['name'],
            'tagline' => $config['tagline'],
            'on_air' => $onAir,
            'stream' => $config['stream_url'] ?: null,
            'queue' => $onAir ? self::items($now, $now + 4 * 3600 * 1000, true, 6) : [],
            'next_show' => $next ? ['title' => $next->title, 'kind' => $next->kind, 'start' => $next->starts_at->getTimestampMs()] : null,
            'live' => [
                'on' => $onAir && $live['session'] !== null,
                'session' => $onAir ? $live['session'] : null,
                'host' => $live['host'],
                'mic' => $onAir && $live['session'] !== null && $live['mic'],
                'started_at' => $live['started_at'],
                'rev' => $live['rev'],
                'fx' => array_values(array_filter($live['fx'], fn ($fx) => $fx['at'] > $now - 15000)),
            ],
            'mix' => self::mix($live, $config),
            'listeners' => self::listenerCount(),
            'ice' => self::iceServers($config),
        ];
    }

    public static function listenerCount(): int
    {
        return Cache::remember('radio.listeners', 8, fn () => RadioListener::query()
            ->where('last_seen', '>=', CarbonImmutable::now()->subSeconds(self::LISTENER_WINDOW))
            ->count());
    }

    public static function voiceCount(?string $session): int
    {
        return $session ? RadioListener::query()->where('session', $session)->where('state', 'connected')
            ->where('last_seen', '>=', CarbonImmutable::now()->subSeconds(self::LISTENER_WINDOW))->count() : 0;
    }

    public static function iceServers(array $config): array
    {
        $servers = [['urls' => ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']]];
        if ($config['turn_url']) {
            $servers[] = ['urls' => $config['turn_url'], 'username' => $config['turn_username'], 'credential' => $config['turn_credential']];
        }

        return $servers;
    }

    /* ------------------------------------------------------------ internals */

    private static function storedLive(): array
    {
        $stored = Cache::get(self::LIVE_KEY);

        return array_replace(self::LIVE_DEFAULTS, is_array($stored) ? $stored : []);
    }

    /** @return Collection<int, RadioSlot> */
    private static function slotsBetween(int $from, int $to): Collection
    {
        return RadioSlot::query()->with('track')
            ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($from - self::MAX_BLOCK * 1000))
            ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($to))
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (RadioSlot $slot) => $slot->endsAt()->getTimestampMs() > $from && ($slot->kind === RadioSlot::LIVE || ($slot->track && $slot->track->active)))
            ->values();
    }

    /** Where the gap that contains $at began: the end of the block before it. */
    private static function anchorBefore(int $at): int
    {
        $previous = RadioSlot::query()->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($at))->orderByDesc('starts_at')->first();
        $end = $previous?->endsAt()->getTimestampMs();

        return $end !== null && $end <= $at ? $end : self::ROTATION_EPOCH;
    }

    /** @return list<array{id: string, kind: string, title: string, artist: ?string, src: string, ms: int}> */
    private static function rotation(): array
    {
        return Cache::remember(self::ROTATION_KEY, 600, fn () => RadioTrack::query()
            ->where('kind', 'musica')->where('active', true)->where('rotation', true)->where('duration', '>=', 5)
            ->orderBy('id')
            ->get()
            ->map(fn (RadioTrack $track) => [
                'id' => $track->id,
                'kind' => $track->kind,
                'title' => $track->title,
                'artist' => $track->artist,
                'src' => $track->file_path,
                'ms' => (int) round($track->duration * 1000),
            ])->all());
    }

    private static function gap(array $rotation, int $anchor, int $from, int $to, bool $expand, int $limit): array
    {
        if ($to <= $from || ! $rotation) {
            return [];
        }
        if ($expand) {
            return self::fill($rotation, $anchor, $from, $to, null, $limit);
        }

        return [[
            'id' => 'gap-'.$from,
            'kind' => 'relleno',
            'title' => 'Música continua',
            'artist' => null,
            'src' => null,
            'start' => $from,
            'end' => $to,
            'origin' => $from,
            'seek' => 0,
            'bed' => false,
            'block' => null,
            'slot' => null,
        ]];
    }

    /** Songs of the library between $from and $to, shuffled per gap so each gap starts a fresh sequence. */
    private static function fill(array $rotation, int $anchor, int $from, int $to, ?string $block, int $limit): array
    {
        $order = $rotation;
        usort($order, fn ($a, $b) => crc32($a['id'].$anchor) <=> crc32($b['id'].$anchor));
        $total = array_sum(array_column($order, 'ms'));
        if ($total <= 0 || $to <= $from) {
            return [];
        }
        $count = count($order);
        $t = $anchor + intdiv(max(0, $from - $anchor), $total) * $total;
        $index = 0;
        while ($t + $order[$index]['ms'] <= $from) {
            $t += $order[$index]['ms'];
            $index = ($index + 1) % $count;
        }

        $items = [];
        while ($t < $to && count($items) < $limit) {
            $track = $order[$index];
            $end = $t + $track['ms'];
            $begin = max($t, $from);
            $items[] = [
                'id' => 'r'.$t.'-'.substr($track['id'], 0, 8),
                'kind' => $block ? 'vivo' : 'musica',
                'title' => $track['title'],
                'artist' => $track['artist'],
                'src' => $track['src'],
                'start' => $begin,
                'end' => min($end, $to),
                'origin' => $t,
                'seek' => round(($begin - $t) / 1000, 3),
                'bed' => $block !== null,
                'block' => $block,
                'slot' => null,
            ];
            $t = $end;
            $index = ($index + 1) % $count;
        }

        return $items;
    }

    private static function slotItem(RadioSlot $slot, int $begin, int $finish): array
    {
        $start = $slot->starts_at->getTimestampMs();

        return [
            'id' => 's'.$slot->id,
            'kind' => $slot->kind,
            'title' => $slot->title,
            'artist' => $slot->track?->artist,
            'src' => $slot->kind === RadioSlot::LIVE ? null : $slot->track?->file_path,
            'start' => $begin,
            'end' => $finish,
            'origin' => $start,
            'seek' => round(($begin - $start) / 1000, 3),
            'bed' => false,
            'block' => $slot->kind === RadioSlot::LIVE ? $slot->title : null,
            'slot' => $slot->id,
        ];
    }
}
