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
 * the main timeline play at their exact time and, when it has a gap, the automatic music
 * fills it in a deterministic order (songs overlap by the crossfade), so everybody hears
 * the same song. Automatic-music blocks hold a period for one playlist; live blocks give
 * way to the live signal only while the host is connected (see LiveSwitch). On top of it
 * sound the layers: overlay blocks of the timeline and the pads and players fired from the
 * console, which may lower the music while they play.
 *
 * The live transmission always wins: while the console is on air or the music is cut for the
 * live signal, scheduled audios of the main program wait instead of starting, and when the
 * transmission ends they play one after another (see Schedule::releaseHeld).
 */
final class Station
{
    public const TZ = 'America/Lima';

    /** Longest block the timeline accepts, in seconds. */
    public const MAX_BLOCK = 6 * 3600;

    /** Console lanes: the pad bank plays many sounds at once; each player (A–C) and background bed (F1, F2) one at a time. */
    public const LANES = ['pad', 'A', 'B', 'C', 'F1', 'F2'];

    public const MAX_PADS = 16;

    /** Longest fade in, fade out or crossfade of a console layer, in seconds. */
    public const MAX_FADE = 12;

    /** Music and sounds drop to this share of their volume while the host speaks («Detectar voz»). */
    public const VOICE_DUCK = 0.25;

    /** How long before a scheduled block the console warns about it, in ms. */
    public const ALERT_AHEAD = 15 * 60000;

    public const DEFAULTS = [
        'name' => 'Radio Zoe',
        'tagline' => 'Música, Palabra y esperanza las 24 horas.',
        'on_air' => true,
        'autofill' => true,
        'bed_level' => 22,
        'fx_level' => 90,
        'duck_level' => 25,
        'crossfade' => 4,
        'pads' => null,
        'stream_url' => '',
        'turn_url' => '',
        'turn_username' => '',
        'turn_credential' => '',
        'max_voice' => 60,
        // Automatic music of the gaps: a playlist id (null = every list), shuffled or in order. A change
        // applies from auto_since (a song boundary at least switch_lead seconds ahead); before it, auto_prev played.
        // auto_start is the song the operator chose to start the music with (null = from the top).
        'auto_playlist' => null,
        'auto_shuffle' => true,
        'auto_start' => null,
        'auto_since' => 0,
        'auto_prev' => null,
        // With auto_repeat off the source plays each song once and then the radio falls silent at
        // auto_until (the end of that cycle, set when the music starts or repeat is turned off).
        'auto_repeat' => true,
        'auto_until' => null,
        'switch_lead' => 300,
        // Live switch: automatic or manual, fed by the console or an external OBS/Icecast signal.
        'live_mode' => LiveSwitch::AUTO,
        'live_source' => LiveSwitch::CONSOLE,
        'live_url' => '',
    ];

    private const LIVE_DEFAULTS = [
        'session' => null,
        'host' => '',
        'title' => '',
        'started_at' => null,
        'music' => 100,
        'overlay' => 100,
        'muted' => false,
        'bed' => false,
        'mic' => false,
        'layers' => [],
        'window' => null,
        'skip' => null,
        // Since when scheduled audios wait for the live transmission (null when nothing is on air live).
        'hold' => null,
        'rev' => 0,
    ];

    /** Bounds of the lead time of a source change, in seconds. */
    public const MIN_LEAD = 30;

    public const MAX_LEAD = 1800;

    /** «Iniciar modo automático» starts this far ahead, so every listener (polling every ~2.5 s) hears the first song from its beginning. */
    private const START_AHEAD = 3000;

    /** Shortest fade of the song on air when the automatic music is started by hand, in ms. */
    private const START_FADE = 2000;

    /** The console sends a heartbeat every ~1.5 s; after this many seconds of silence the live session ends. */
    private const OPERATOR_TIMEOUT = 25;

    private const LISTENER_WINDOW = 40;

    /** Pads sounding at once; older ones are dropped first. */
    private const PADS_AT_ONCE = 8;

    /** Scheduled overlays this far ahead travel with the state so listeners can preload them. */
    private const LAYER_LOOKAHEAD = 60000;

    /** A start the console reports is trusted only this close to the server clock (ms). */
    private const LAYER_CLOCK_SKEW = 5000;

    /** Listeners see what sounded before the item on air: this far back, at most this many (newest first). */
    private const RECENT_WINDOW = 60 * 60000;

    private const RECENT_ITEMS = 6;

    /** 2026-01-01 00:00 in Lima: start of the music rotation when the timeline has never had a block. */
    private const ROTATION_EPOCH = 1767243600000;

    private const CONFIG_KEY = 'radio.config';

    private const LIVE_KEY = 'radio.live';

    private const OPERATOR_KEY = 'radio.operator';

    /** Config the program is computed with instead of the stored one (to foresee a source change). */
    private static ?array $override = null;

    public static function nowMs(): int
    {
        return CarbonImmutable::now()->getTimestampMs();
    }

    public static function config(): array
    {
        if (self::$override !== null) {
            return self::$override;
        }
        $cached = Cache::rememberForever(self::CONFIG_KEY, function () {
            $stored = SiteSetting::query()->find('radio')?->value;

            return array_replace(self::DEFAULTS, is_array($stored) ? array_intersect_key($stored, self::DEFAULTS) : []);
        });

        return array_replace(self::DEFAULTS, is_array($cached) ? array_intersect_key($cached, self::DEFAULTS) : []);
    }

    public static function saveConfig(array $values): array
    {
        $next = array_replace(self::config(), array_intersect_key($values, self::DEFAULTS));
        SiteSetting::query()->updateOrCreate(['key' => 'radio'], ['value' => $next, 'updated_at' => now()]);
        Cache::forget(self::CONFIG_KEY);
        self::flush();

        return $next;
    }

    /** Called whenever the library, a playlist, the timeline or the crossfade changes. */
    public static function flush(): void
    {
        Autopilot::flush();
    }

    /**
     * Changes the automatic music of the gaps without cutting a song: the new source starts at the
     * first song boundary at least switch_lead seconds ahead (so when the song on air ends too soon,
     * the next one plays to its end as well), and the last song of the old source fades into it.
     * With $immediately it is at once.
     *
     * @return int when the new source starts (UTC ms)
     */
    public static function switchAutopilot(?string $playlist, bool $shuffle, bool $immediately = false): int
    {
        $config = self::config();
        $now = self::nowMs();
        $playing = self::onAir($config, $now);
        $immediately = $immediately || self::finished($config, $now);
        [$since, $boundary] = $immediately ? [$now, false] : self::switchPoint($config, $playing, $now);
        self::saveConfig([
            'auto_prev' => [...$playing, 'tail' => $boundary],
            'auto_since' => $since,
            'auto_playlist' => $playlist,
            'auto_shuffle' => $playlist === null || $shuffle,
            'auto_start' => null,
            'auto_until' => null,
        ]);
        self::limitToOneCycle();

        return $since;
    }

    /**
     * «Repetir»: on, the source starts over when its last song ends; off, the cycle sounding now
     * is the last one and the radio falls silent when it ends. Turning it back on after that
     * silence starts the source again from its first song.
     */
    public static function setRepeat(bool $repeat): void
    {
        $config = self::config();
        if ($repeat && $config['autofill'] && self::finished($config, self::nowMs())) {
            self::startAutopilot($config['auto_playlist'], (bool) $config['auto_shuffle'], null, true);

            return;
        }
        self::saveConfig(['auto_repeat' => $repeat, 'auto_until' => null]);
        self::limitToOneCycle();
    }

    /** Whether the single cycle of a source without repeat already played to its end (its last song included). */
    private static function finished(array $config, int $now): bool
    {
        return ! $config['auto_repeat'] && $config['auto_until'] !== null
            && $now >= (int) $config['auto_until'] + (int) round($config['crossfade'] * 1000);
    }

    /** With repeat off, the music stops at the end of the cycle of the current source (see cycleEnd()). */
    private static function limitToOneCycle(): void
    {
        $config = self::config();
        if (! $config['auto_repeat']) {
            self::saveConfig(['auto_until' => self::cycleEnd($config, self::nowMs())]);
        }
    }

    /**
     * When the cycle of the current source that sounds now (or sounds next) ends: every song of
     * it once from where its music started. Null when the source has no song.
     */
    private static function cycleEnd(array $config, int $now): ?int
    {
        $crossfade = (int) round($config['crossfade'] * 1000);
        $current = self::current($config);
        $total = array_sum(array_column(Autopilot::resolve($current['playlist'], $current['shuffle'], $crossfade)['songs'], 'step'));
        if ($total <= 0) {
            return null;
        }
        $since = (int) $config['auto_since'];
        $at = max($now, $since);
        self::$override = [...$config, 'auto_until' => null];
        try {
            foreach (self::items($at, $at + 6 * 3600000, true, 200) as $item) {
                if ($item['kind'] === 'musica' && $item['slot'] === null && $item['block'] === null && $item['origin'] >= $since) {
                    $at = $item['origin'];
                    break;
                }
            }
        } finally {
            self::$override = null;
        }
        $anchor = max(self::anchorBefore($at, LiveSwitch::window($config, self::live(), $now), self::storedLive()['hold']), $since);

        return $anchor + (intdiv(max(0, $at - $anchor), $total) + 1) * $total;
    }

    /**
     * «Iniciar modo automático»: puts the radio on air with the automatic music on and starts the
     * source now, from the chosen song ($first; null = from the top). It starts a few seconds ahead
     * so every listener hears the song from its beginning, while the song on air fades out under
     * it; a live cut by hand ends. A scheduled audio on air keeps playing and the music follows it.
     *
     * @return int when the music starts (UTC ms)
     */
    public static function startAutopilot(?string $playlist, bool $shuffle, ?string $first, ?bool $repeat = null): int
    {
        $config = self::config();
        $now = self::nowMs();
        $since = $now + self::START_AHEAD;
        $cut = LiveSwitch::isOpen(self::storedLive()['window'], $now);
        $sounding = $config['on_air'] && $config['autofill'] && ! $cut && ! self::finished($config, $now);
        self::saveConfig([
            'on_air' => true,
            'autofill' => true,
            'auto_prev' => $sounding ? [...self::onAir($config, $now), 'tail' => false, 'fade' => true] : null,
            'auto_since' => $since,
            'auto_playlist' => $playlist,
            'auto_shuffle' => $playlist === null || $shuffle,
            'auto_start' => $first,
            'auto_repeat' => $repeat ?? $config['auto_repeat'],
            'auto_until' => null,
        ]);
        if ($cut) {
            LiveSwitch::resume();
        }
        self::limitToOneCycle();

        return $since;
    }

    /** The first song the automatic music plays from $since, or null when something else is on air then. */
    public static function firstSong(int $since): ?array
    {
        foreach (self::items($since, $since + 1000, true, 4) as $item) {
            if ($item['origin'] >= $since - 50) {
                return $item['kind'] === 'musica' && $item['slot'] === null && $item['block'] === null ? $item : null;
            }
        }

        return null;
    }

    /** Calls off a source change that has not started yet: what is on air keeps playing. */
    public static function cancelAutopilotSwitch(): bool
    {
        $config = self::config();
        if ($config['auto_since'] <= self::nowMs() || ! is_array($config['auto_prev'])) {
            return false;
        }
        $playing = self::onAir($config, self::nowMs());
        self::saveConfig([
            'auto_playlist' => $playing['playlist'],
            'auto_shuffle' => $playing['shuffle'],
            'auto_start' => $playing['start'],
            'auto_since' => $playing['from'],
            'auto_prev' => null,
            'auto_until' => null,
        ]);
        self::limitToOneCycle();

        return true;
    }

    /** Seconds ahead a source change is due, within MIN_LEAD and MAX_LEAD. */
    public static function lead(array $config): int
    {
        return max(self::MIN_LEAD, min(self::MAX_LEAD, (int) $config['switch_lead']));
    }

    /**
     * «Siguiente»: the automatic song on air ($item, an id of items()) fades out and the song that
     * came after it starts for every listener within seconds; the music goes on from there. A
     * change of source still waiting is brought forward. Null when $item is no longer on air (or
     * already fading out of a skip) or no automatic song follows it.
     *
     * @return ?array<string, mixed> the song that starts
     */
    public static function skipSong(string $item): ?array
    {
        $config = self::config();
        $now = self::nowMs();
        if (! $config['on_air'] || ! $config['autofill']) {
            return null;
        }
        $automatic = fn (array $entry): bool => $entry['kind'] === 'musica' && $entry['slot'] === null && $entry['block'] === null;
        $items = self::items($now, $now + 6 * 3600000, true, 40);
        $at = array_search($item, array_column($items, 'id'), true);
        if ($at === false || ! $automatic($items[$at]) || $items[$at]['start'] > $now) {
            return null;
        }
        $song = $items[$at];
        if (! empty($config['auto_prev']['fade']) && $song['origin'] < $config['auto_since']) {
            return null;
        }

        foreach (array_slice($items, $at + 1) as $next) {
            if (! $automatic($next) || $next['origin'] <= $song['origin']) {
                continue;
            }
            $current = self::current($config);
            $first = $next['origin'] >= $config['auto_since'] ? $next['track'] : $current['start'];

            return self::firstSong(self::startAutopilot($current['playlist'], $current['shuffle'], $first)) ?? $next;
        }

        return null;
    }

    /**
     * The source of the automatic music on air at $now and since when it plays.
     *
     * @return array{playlist: ?string, shuffle: bool, start: ?string, from: int}
     */
    private static function onAir(array $config, int $now): array
    {
        if ($config['auto_since'] > $now && is_array($config['auto_prev'])) {
            return self::source($config['auto_prev']);
        }

        return self::current($config);
    }

    /** @return array{playlist: ?string, shuffle: bool, start: ?string, from: int} the source of the config, from auto_since */
    private static function current(array $config): array
    {
        return self::source([
            'playlist' => $config['auto_playlist'],
            'shuffle' => $config['auto_shuffle'],
            'start' => $config['auto_start'],
            'from' => $config['auto_since'],
        ]);
    }

    /** @return array{playlist: ?string, shuffle: bool, start: ?string, from: int} */
    private static function source(array $source): array
    {
        $playlist = $source['playlist'] ?? null;
        $start = $source['start'] ?? null;

        return [
            'playlist' => $playlist,
            'shuffle' => $playlist === null || (bool) ($source['shuffle'] ?? true),
            'start' => is_string($start) ? $start : null,
            'from' => (int) ($source['from'] ?? 0),
        ];
    }

    /**
     * Where a change of source lands: the first automatic song that would start at least the lead
     * time from now (a song boundary, where the song before fades into the new source).
     *
     * @return array{0: int, 1: bool} the time and whether it is a song boundary
     */
    private static function switchPoint(array $config, array $playing, int $now): array
    {
        $due = $now + self::lead($config) * 1000;
        self::$override = [
            ...$config,
            'auto_playlist' => $playing['playlist'],
            'auto_shuffle' => $playing['shuffle'],
            'auto_start' => $playing['start'],
            'auto_since' => $playing['from'],
            'auto_prev' => null,
        ];
        try {
            $items = self::items($now, $due + 2 * 3600000, true, 120);
        } finally {
            self::$override = null;
        }

        $sounding = false;
        $lastEnd = $now;
        foreach ($items as $item) {
            if ($item['kind'] !== 'musica' || $item['slot'] !== null || $item['block'] !== null) {
                continue;
            }
            if ($item['origin'] >= $due) {
                return [$item['origin'], true];
            }
            $sounding = $sounding || $item['start'] <= $now;
            $lastEnd = max($lastEnd, $item['end']);
        }

        // No song boundary ahead: the program takes over, so the change waits for the end of this music.
        return [$sounding ? max($due, $lastEnd) : $now, false];
    }

    /** The automatic music of the gaps, for the console and the schedule. */
    public static function autopilot(?array $config = null): array
    {
        $config ??= self::config();
        $now = self::nowMs();
        $current = self::current($config);
        // A start by hand is not a pending change: it is heard within seconds.
        $pending = $config['auto_since'] > $now && is_array($config['auto_prev']) && empty($config['auto_prev']['fade'])
            ? self::source($config['auto_prev']) : null;

        return [
            'mode' => $current['playlist'] !== null ? 'lista' : 'aleatorio',
            'playlist' => $current['playlist'],
            'shuffle' => $current['shuffle'],
            'start' => $current['start'],
            'label' => self::sourceLabel($current),
            'since' => (int) $config['auto_since'],
            // What keeps playing until a scheduled change starts.
            'pending' => $pending ? ['label' => self::sourceLabel($pending)] : null,
            'lead' => self::lead($config),
            'paused' => ! $config['autofill'],
            // Without repeat: when the last cycle ends (UTC ms) and whether the radio is already silent.
            'repeat' => (bool) $config['auto_repeat'],
            'until' => $config['auto_repeat'] || $config['auto_until'] === null ? null : (int) $config['auto_until'],
            'finished' => self::finished($config, $now),
            // Level of the fallback chain that really sounds, and audios off the air because of their file.
            'level' => Autopilot::resolve($current['playlist'], $current['shuffle'], (int) round($config['crossfade'] * 1000))['level'],
            'broken' => RadioHealth::brokenCount(),
        ];
    }

    /** Name of a source for the console, the schedule and the messages. */
    public static function sourceLabel(array $source): string
    {
        return Autopilot::label($source['playlist'] ?? null);
    }

    /** Tracks of the pad bank, in the order the operator chose (effects first until the bank is first saved). */
    public static function pads(): Collection
    {
        $ids = self::config()['pads'];
        if (! is_array($ids)) {
            return RadioTrack::query()->where('active', true)->whereIn('kind', ['efecto', 'anuncio'])
                ->orderByRaw("case when kind = 'efecto' then 0 else 1 end")->orderBy('title')->limit(12)->get();
        }
        $tracks = RadioTrack::query()->whereIn('id', $ids)->where('active', true)->get()->keyBy('id');

        return collect($ids)->map(fn (string $id) => $tracks->get($id))->filter()->values();
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
            if ($next['hold'] === null && self::holding($next)) {
                $next['hold'] = self::nowMs();
            }
            Cache::forever(self::LIVE_KEY, $next);

            return $next;
        });
    }

    /** Whether the live transmission is on: the console session is open or the music is cut for the live signal. */
    public static function holding(array $live): bool
    {
        return $live['session'] !== null || LiveSwitch::isOpen($live['window'], self::nowMs());
    }

    /** Once the live transmission is over, the scheduled audios that waited for it go on air. */
    public static function settleHold(): void
    {
        $live = self::storedLive();
        if ($live['hold'] === null || self::holding($live)) {
            return;
        }
        $since = null;
        self::updateLive(function (array $live) use (&$since) {
            if ($live['hold'] === null || self::holding($live)) {
                return [];
            }
            $since = (int) $live['hold'];

            return ['hold' => null];
        });
        if ($since !== null) {
            Schedule::releaseHeld($since, self::nowMs());
        }
    }

    /**
     * Blocks of the main program the console warns about: those starting within ALERT_AHEAD
     * and the audios waiting for the live transmission to end (`held`).
     *
     * @return list<array<string, mixed>>
     */
    public static function upcoming(int $now): array
    {
        $hold = self::storedLive()['hold'];

        return RadioSlot::query()->with(['track', 'playlist'])->where('layer', RadioSlot::MAIN)
            ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($hold ?? $now))
            ->where('starts_at', '<=', CarbonImmutable::createFromTimestampMs($now + self::ALERT_AHEAD))
            ->orderBy('starts_at')->get()
            ->map(function (RadioSlot $slot) use ($hold, $now) {
                $held = $hold !== null && self::waits($slot, $hold);
                if ($slot->starts_at->getTimestampMs() <= $now && ! $held) {
                    return null;
                }

                return [...Schedule::payload($slot), 'held' => $held];
            })
            ->filter()->values()->all();
    }

    /** Scheduled audios (not live blocks nor automatic periods) that start during the hold wait for it. */
    private static function waits(RadioSlot $slot, int $hold): bool
    {
        return ! in_array($slot->kind, [RadioSlot::LIVE, RadioSlot::AUTO], true) && $slot->starts_at->getTimestampMs() >= $hold;
    }

    /** Opens the live session; without a title it takes the name of the live block scheduled now or about to start. */
    public static function startLive(string $host, string $title = ''): array
    {
        self::heartbeat();
        $title = $title !== '' ? $title : (self::scheduledLiveTitle(self::nowMs()) ?? '');

        return self::updateLive(fn (array $live) => $live['session'] ? ['host' => $host, 'title' => $title ?: $live['title']] : [
            'session' => Str::lower(Str::random(24)),
            'host' => $host,
            'title' => $title,
            'started_at' => self::nowMs(),
            'mic' => false,
            'bed' => false,
            'muted' => false,
        ]);
    }

    /** Title of the live block on the program now, or of the next one starting within ALERT_AHEAD. */
    public static function scheduledLiveTitle(int $now): ?string
    {
        $slot = LiveSwitch::liveSlot($now) ?? RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', RadioSlot::LIVE)
            ->where('starts_at', '>', CarbonImmutable::createFromTimestampMs($now))
            ->where('starts_at', '<=', CarbonImmutable::createFromTimestampMs($now + self::ALERT_AHEAD))
            ->orderBy('starts_at')->first();

        return $slot?->title ?: null;
    }

    public static function endLive(): array
    {
        $session = self::storedLive()['session'];
        if ($session) {
            Signal::close($session);
        }
        $config = self::config();

        return self::updateLive(fn (array $live) => [
            'session' => null, 'host' => '', 'title' => '', 'started_at' => null, 'mic' => false, 'bed' => false, 'muted' => false,
            ...LiveSwitch::closeOnHangUp($live, $config),
        ]);
    }

    public static function heartbeat(): void
    {
        Cache::put(self::OPERATOR_KEY, CarbonImmutable::now()->getTimestamp(), 3600);
    }

    /**
     * Puts a library audio on air on top of the program: a pad, or one of the players or beds.
     * What the lane played stops at once, or fades out over the new fade in (a crossfade).
     * A looped layer repeats until it is stopped. The console may name the layer and the moment
     * it already started sounding there, so every listener hears it in step with the operator.
     */
    public static function playLayer(RadioTrack $track, string $lane, int $volume, bool $duck, float $fadeIn = 0, float $fadeOut = 0, bool $loop = false, ?string $id = null, ?int $at = null): array
    {
        $now = self::nowMs();
        if ($at !== null && abs($at - $now) <= self::LAYER_CLOCK_SKEW) {
            $now = $at;
        }
        $length = (int) round($track->duration * 1000);
        $fadeIn = self::fade($fadeIn);
        $layer = [
            'id' => $id !== null && preg_match('/^[a-z0-9]{12}$/', $id) ? $id : Str::lower(Str::random(12)),
            'lane' => $lane,
            'track_id' => $track->id,
            'title' => $track->title,
            'kind' => $track->kind,
            'src' => $track->file_path,
            'start' => $now,
            'end' => $now + ($loop ? self::MAX_BLOCK * 1000 : $length),
            'volume' => max(0, min(100, $volume)),
            'duck' => $duck,
            'fade_in' => $fadeIn,
            'fade_out' => self::fade($fadeOut),
            'loop' => $loop,
            'length' => $length,
        ];

        self::updateLive(function (array $live) use ($layer, $lane, $now, $fadeIn) {
            $layers = [];
            foreach (self::sounding($live['layers'], $now) as $item) {
                if ($item['id'] === $layer['id']) {
                    continue;
                }
                if ($lane === 'pad' || $item['lane'] !== $lane) {
                    $layers[] = $item;
                } elseif ($fadeIn > 0) {
                    $layers[] = self::fadeAway($item, $now, $fadeIn);
                }
            }
            if ($lane === 'pad') {
                $pads = array_keys(array_filter($layers, fn (array $item) => $item['lane'] === 'pad'));
                foreach (array_slice($pads, 0, max(0, count($pads) - self::PADS_AT_ONCE + 1)) as $key) {
                    unset($layers[$key]);
                }
            }

            return ['layers' => [...array_values($layers), $layer]];
        });

        return $layer;
    }

    /**
     * Stops console layers: one by id, every sound of a lane, or all of them.
     *
     * @return list<string> ids that stopped
     */
    public static function stopLayers(?string $lane = null, ?string $id = null): array
    {
        $stopped = [];
        self::updateLive(function (array $live) use ($lane, $id, &$stopped) {
            $kept = [];
            foreach (self::sounding($live['layers'], self::nowMs()) as $layer) {
                $match = $id !== null ? $layer['id'] === $id : ($lane === null || $layer['lane'] === $lane);
                $match ? $stopped[] = $layer['id'] : $kept[] = $layer;
            }

            return ['layers' => $kept];
        });

        return $stopped;
    }

    /**
     * Fades console layers out instead of cutting them: one by id, every sound of a lane, or all of them.
     *
     * @return list<array<string, mixed>> the layers as they now end
     */
    public static function fadeLayers(?string $lane, ?string $id, float $seconds): array
    {
        $faded = [];
        $seconds = max(0.5, self::fade($seconds));
        self::updateLive(function (array $live) use ($lane, $id, $seconds, &$faded) {
            $now = self::nowMs();
            $layers = [];
            foreach (self::sounding($live['layers'], $now) as $layer) {
                $match = $id !== null ? $layer['id'] === $id : ($lane === null || $layer['lane'] === $lane);
                if ($match) {
                    $layer = self::fadeAway($layer, $now, $seconds);
                    $faded[] = $layer;
                }
                $layers[] = $layer;
            }

            return ['layers' => $layers];
        });

        return $faded;
    }

    private static function fadeAway(array $layer, int $now, float $seconds): array
    {
        $end = min($layer['end'], $now + (int) round($seconds * 1000));

        return [...$layer, 'end' => $end, 'fade_out' => round(($end - $now) / 1000, 1), 'fading' => true];
    }

    private static function fade(float $seconds): float
    {
        return round(max(0, min(self::MAX_FADE, $seconds)), 1);
    }

    public static function updateLayer(string $id, int $volume, bool $duck): ?array
    {
        $updated = null;
        self::updateLive(function (array $live) use ($id, $volume, $duck, &$updated) {
            $layers = self::sounding($live['layers'], self::nowMs());
            foreach ($layers as &$layer) {
                if ($layer['id'] === $id) {
                    $layer = [...$layer, 'volume' => max(0, min(100, $volume)), 'duck' => $duck];
                    $updated = $layer;
                }
            }

            return ['layers' => $layers];
        });

        return $updated;
    }

    /**
     * Gains every listener applies: music bus (after the console faders), layers bus, bed and duck
     * levels, and what everything but the voice drops to while the host's voice is detected.
     */
    public static function mix(array $live, array $config): array
    {
        $music = $live['muted'] ? 0.0 : ($live['music'] / 100) * ($live['bed'] ? $config['bed_level'] / 100 : 1);

        return [
            'music' => round($music, 3),
            'fx' => round(($config['fx_level'] / 100) * ($live['overlay'] / 100), 3),
            'bed' => round($config['bed_level'] / 100, 3),
            'duck' => round($config['duck_level'] / 100, 3),
            'voice' => self::VOICE_DUCK,
        ];
    }

    /* ------------------------------------------------------------- program */

    /**
     * Playable items of the main timeline overlapping [from, to), in order. With $expand it is
     * what sounds, song by song: live blocks give way to the music unless the live switch cut
     * it. Without it, it is the schedule: each gap and automatic period is one block.
     *
     * @return list<array<string, mixed>>
     */
    public static function items(int $from, int $to, bool $expand = true, int $limit = 600): array
    {
        $config = self::config();
        $window = $expand ? LiveSwitch::window($config, self::live(), self::nowMs()) : null;
        $hold = $expand ? self::storedLive()['hold'] : null;
        $items = [];
        $cursor = $from;
        $anchor = null;

        foreach (self::entries(self::slotsBetween($from, $to), $window, $expand, $hold) as $entry) {
            if ($entry['end'] <= $cursor) {
                continue;
            }
            if ($entry['start'] > $cursor) {
                $anchor ??= $cursor === $from ? self::anchorBefore($from, $window, $hold) : $cursor;
                array_push($items, ...self::gap($config, $anchor, $cursor, min($entry['start'], $to), $expand, $limit - count($items)));
            }
            array_push($items, ...self::entryItems($entry, $config, max($entry['start'], $cursor), min($entry['end'], $to), $expand, $limit - count($items)));
            $cursor = $entry['end'];
            $anchor = $entry['end'];
            if ($cursor >= $to || count($items) >= $limit) {
                break;
            }
        }

        if ($cursor < $to && count($items) < $limit) {
            $anchor ??= self::anchorBefore($from, $window, $hold);
            array_push($items, ...self::gap($config, $cursor === $from ? $anchor : $cursor, $cursor, $to, $expand, $limit - count($items)));
        }

        return array_slice($items, 0, $limit);
    }

    /**
     * Sounds on top of the program around $now: console pads and players, and overlay
     * blocks of the timeline that are playing or start within the lookahead.
     *
     * @return list<array<string, mixed>>
     */
    public static function layers(array $live, int $now): array
    {
        $layers = array_map(fn (array $layer) => [...$layer, 'source' => 'live'], self::sounding($live['layers'], $now));

        $scheduled = RadioSlot::query()->with('track')->where('layer', '>', RadioSlot::MAIN)
            ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($now - self::MAX_BLOCK * 1000))
            ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($now + self::LAYER_LOOKAHEAD))
            ->orderBy('starts_at')->get()
            ->filter(fn (RadioSlot $slot) => self::playable($slot->track) && $slot->endsAt()->getTimestampMs() > $now);

        foreach ($scheduled as $slot) {
            $layers[] = [
                'id' => 's'.$slot->id,
                'lane' => (string) $slot->layer,
                'track_id' => $slot->radio_track_id,
                'title' => $slot->title,
                'kind' => $slot->kind,
                'src' => $slot->track->file_path,
                'start' => $slot->starts_at->getTimestampMs(),
                'end' => $slot->endsAt()->getTimestampMs(),
                'volume' => $slot->volume,
                'duck' => $slot->duck,
                'source' => 'schedule',
            ];
        }

        return $layers;
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
        self::settleHold();
        RadioHealth::sweepSoon();
        $now = self::nowMs();
        $onAir = (bool) $config['on_air'];
        [$previous, $queue, $recent] = $onAir ? self::program($now) : [null, [], []];
        $live = self::storedLive();
        $window = $onAir && LiveSwitch::isOpen($live['window'], $now) ? $live['window'] : null;
        $external = $window && $config['live_source'] === LiveSwitch::EXTERNAL && $config['live_url'] !== '';
        $next = $onAir ? RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::AUTO)
            ->where('starts_at', '>', CarbonImmutable::createFromTimestampMs($now))->orderBy('starts_at')->first() : null;

        return [
            'now' => $now,
            'name' => $config['name'],
            'tagline' => $config['tagline'],
            'on_air' => $onAir,
            'stream' => $config['stream_url'] ?: null,
            'previous' => $previous,
            'queue' => $queue,
            'recent' => $recent,
            // Healthy songs of the source the player falls back on when a file fails or the server stops
            // answering (none when silence is intended, also when the source plays only once).
            'fallback' => $onAir && $config['autofill'] && $config['auto_repeat'] ? Autopilot::reserve($now, self::onAir($config, $now)) : [],
            'layers' => $onAir ? self::layers($live, $now) : [],
            'next_show' => $next ? ['title' => $next->title, 'kind' => $next->kind, 'start' => $next->starts_at->getTimestampMs()] : null,
            'live' => [
                'on' => $onAir && ($live['session'] !== null || $external),
                'session' => $onAir ? $live['session'] : null,
                'title' => $live['title'] ?: (string) ($window['title'] ?? ''),
                'mic' => $onAir && $live['session'] !== null && $live['mic'],
                'started_at' => $live['started_at'],
                'rev' => $live['rev'],
                'mode' => $config['live_mode'],
                'source' => $config['live_source'],
                'cut' => $window !== null,
                'window' => $window,
                'url' => $external ? $config['live_url'] : null,
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

        return array_intersect_key(array_replace(self::LIVE_DEFAULTS, is_array($stored) ? $stored : []), self::LIVE_DEFAULTS);
    }

    /** Console layers still sounding at $now. */
    private static function sounding(array $layers, int $now): array
    {
        return array_values(array_filter($layers, fn (array $layer) => $layer['end'] > $now));
    }

    /**
     * The song before the one on air, the items from now on (the one on air first; during a
     * crossfade the song fading out comes first and keeps playing) and what sounded before the
     * one on air, newest first: songs, programs and live shows, not announcements or effects.
     *
     * @return array{0: ?array, 1: list<array>, 2: list<array>}
     */
    private static function program(int $now): array
    {
        $items = self::items($now - self::RECENT_WINDOW, $now + 4 * 3600000, true, 90);
        $current = null;
        foreach ($items as $index => $item) {
            if ($item['start'] <= $now && $now < $item['end']) {
                $current = $index;
            }
        }
        $previous = $current !== null && $current > 0 ? $items[$current - 1] : null;
        $queue = [];
        foreach ($items as $item) {
            if ($item['end'] > $now && count($queue) < 7) {
                $queue[] = $item['start'] < $now ? [...$item, 'start' => $now, 'seek' => round(($now - $item['origin']) / 1000, 3)] : $item;
            }
        }
        $before = $current !== null ? array_slice($items, 0, $current) : array_filter($items, fn (array $item) => $item['end'] <= $now);
        $recent = [];
        foreach (array_reverse($before) as $item) {
            if (in_array($item['kind'], ['anuncio', 'efecto'], true) || ($recent && $recent[count($recent) - 1]['id'] === $item['id'])) {
                continue;
            }
            $recent[] = $item;
            if (count($recent) >= self::RECENT_ITEMS) {
                break;
            }
        }

        return [$previous, $queue, $recent];
    }

    /** @return Collection<int, RadioSlot> main-timeline blocks overlapping [from, to) */
    private static function slotsBetween(int $from, int $to): Collection
    {
        return RadioSlot::query()->with('track')->where('layer', RadioSlot::MAIN)
            ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($from - self::MAX_BLOCK * 1000))
            ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($to))
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (RadioSlot $slot) => $slot->endsAt()->getTimestampMs() > $from
                && (in_array($slot->kind, [RadioSlot::LIVE, RadioSlot::AUTO], true) || self::playable($slot->track)))
            ->values();
    }

    /** A scheduled audio sounds only when it is active and its file is healthy; otherwise the music fills its time. */
    private static function playable(?RadioTrack $track): bool
    {
        return $track !== null && $track->active && $track->file_problem === null && (string) $track->file_path !== '';
    }

    /**
     * The main program as entries of what sounds: scheduled blocks, automatic periods and the
     * live cut, which overrides whatever was scheduled under it. Live blocks only sound while
     * the cut holds them, so outside it they are gaps the music fills. Audios waiting for the
     * live transmission ($hold) are left out until it ends. Back-to-back periods of the same
     * playlist play as one, so a long period does not restart at each block.
     *
     * @return list<array{type: string, start: int, end: int, anchor: int, slot: ?RadioSlot, window: ?array}>
     */
    private static function entries(Collection $slots, ?array $window, bool $expand, ?int $hold = null): array
    {
        $entries = [];
        foreach ($slots as $slot) {
            if ($expand && ($slot->kind === RadioSlot::LIVE || ($hold !== null && self::waits($slot, $hold)))) {
                continue;
            }
            $start = $slot->starts_at->getTimestampMs();
            foreach (self::outside($start, $slot->endsAt()->getTimestampMs(), $window) as [$begin, $end]) {
                $auto = $slot->kind === RadioSlot::AUTO;
                $entries[] = [
                    'type' => $auto ? 'auto' : 'slot',
                    'start' => $begin,
                    'end' => $end,
                    'anchor' => $auto && $begin === $start ? self::chainStart($slot) : $begin,
                    'slot' => $slot,
                    'window' => null,
                ];
            }
        }
        if ($window) {
            $entries[] = ['type' => 'cut', 'start' => $window['start'], 'end' => $window['end'] ?? PHP_INT_MAX, 'anchor' => $window['start'], 'slot' => null, 'window' => $window];
        }
        usort($entries, fn (array $a, array $b) => $a['start'] <=> $b['start']);

        $merged = [];
        foreach ($entries as $entry) {
            $last = $merged ? $merged[count($merged) - 1] : null;
            if ($last && $last['type'] === 'auto' && $entry['type'] === 'auto' && abs($entry['start'] - $last['end']) <= 50
                && self::sameSource($last['slot'], $entry['slot'])) {
                $merged[count($merged) - 1]['end'] = $entry['end'];

                continue;
            }
            $merged[] = $entry;
        }

        return $merged;
    }

    /** @return list<array{0: int, 1: int}> the parts of [start, end) outside the live cut */
    private static function outside(int $start, int $end, ?array $window): array
    {
        $cutFrom = $window['start'] ?? PHP_INT_MAX;
        $cutTo = $window ? ($window['end'] ?? PHP_INT_MAX) : PHP_INT_MAX;
        if ($cutTo <= $start || $cutFrom >= $end) {
            return [[$start, $end]];
        }

        return array_values(array_filter([[$start, $cutFrom], [$cutTo, $end]], fn (array $part) => $part[1] > $part[0]));
    }

    private static function sameSource(RadioSlot $a, RadioSlot $b): bool
    {
        return $a->radio_playlist_id === $b->radio_playlist_id && $a->shuffle === $b->shuffle;
    }

    /** Where a run of back-to-back automatic periods of the same playlist began. */
    private static function chainStart(RadioSlot $slot): int
    {
        $start = $slot->starts_at->getTimestampMs();
        for ($step = 0; $step < 8; $step++) {
            $previous = RadioSlot::query()->where('layer', RadioSlot::MAIN)
                ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($start))
                ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($start - self::MAX_BLOCK * 1000))
                ->orderByDesc('starts_at')->first();
            if (! $previous || $previous->kind !== RadioSlot::AUTO || ! self::sameSource($previous, $slot)
                || abs($previous->endsAt()->getTimestampMs() - $start) > 50) {
                break;
            }
            $start = $previous->starts_at->getTimestampMs();
        }

        return $start;
    }

    /** @return list<array<string, mixed>> what an entry plays between $begin and $finish */
    private static function entryItems(array $entry, array $config, int $begin, int $finish, bool $expand, int $limit): array
    {
        if ($finish <= $begin || $limit <= 0) {
            return [];
        }
        $crossfade = (int) round($config['crossfade'] * 1000);
        $slot = $entry['slot'];

        if ($entry['type'] === 'auto') {
            if (! $expand) {
                return [self::block('a'.$slot->id, 'relleno', $slot->title, $begin, $finish, $entry['start'])];
            }

            $source = Autopilot::resolve($slot->radio_playlist_id, (bool) $slot->shuffle, $crossfade);

            return Autopilot::fill($source['songs'], $source['shuffle'], $entry['anchor'], $begin, $finish, $limit, ['block' => $slot->title]);
        }

        if ($entry['type'] === 'cut') {
            $window = $entry['window'];
            if ($window['bed']) {
                $source = Autopilot::resolve($config['auto_playlist'], (bool) $config['auto_shuffle'], $crossfade);
                if ($source['songs']) {
                    return Autopilot::fill($source['songs'], $source['shuffle'], $window['start'], $begin, $finish, $limit, ['kind' => 'vivo', 'bed' => true, 'block' => $window['title']]);
                }
            }

            return [[...self::block('live-'.$window['start'], RadioSlot::LIVE, $window['title'], $begin, $finish, $window['start']), 'block' => $window['title'], 'slot' => $window['slot']]];
        }

        return [self::slotItem($slot, $begin, $finish)];
    }

    /**
     * Where the gap that contains $at began: the end of the block before it (live blocks only
     * count through the cut, since the music plays across them when nobody is on air; audios
     * waiting for the live transmission do not count either, since they have not played).
     */
    private static function anchorBefore(int $at, ?array $window, ?int $hold = null): int
    {
        $previous = RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::LIVE)
            ->when($hold !== null, fn ($query) => $query->where(fn ($query) => $query->where('kind', RadioSlot::AUTO)
                ->orWhere('starts_at', '<', CarbonImmutable::createFromTimestampMs($hold))))
            ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($at))->orderByDesc('starts_at')->first();
        $ends = array_filter(
            [$previous?->endsAt()->getTimestampMs(), $window['end'] ?? null],
            fn (?int $end) => $end !== null && $end <= $at,
        );

        return $ends ? max($ends) : self::ROTATION_EPOCH;
    }

    /**
     * Automatic music of a gap, from the station's source. A source change splits the gap: the
     * old source plays until auto_since, its last song running on to fade into the new source,
     * which starts fresh there. After a start by hand (auto_prev «fade») the song on air does not
     * run on: it fades out over the first seconds of the new source.
     */
    private static function gap(array $config, int $anchor, int $from, int $to, bool $expand, int $limit): array
    {
        if ($to <= $from || ! $config['autofill'] || $limit <= 0) {
            return [];
        }
        $crossfade = (int) round($config['crossfade'] * 1000);
        $since = (int) $config['auto_since'];
        $current = self::current($config);
        $until = $config['auto_repeat'] || $config['auto_until'] === null ? null : (int) $config['auto_until'];
        if (! $expand) {
            $end = $until !== null ? min($to, $until) : $to;

            return $end > $from && Autopilot::songs($current['playlist'], $crossfade) ? [self::block('gap-'.$from, 'relleno', 'Música continua', $from, $end, $from)] : [];
        }

        $previous = is_array($config['auto_prev']) ? self::source($config['auto_prev']) : null;
        $fade = $previous !== null && ! empty($config['auto_prev']['fade']) ? max(self::START_FADE, $crossfade) : 0;
        $parts = [];
        if ($since <= $anchor) {
            $parts[] = [$anchor, $from, $to, $current, false, 0, $until];
        } else {
            $tail = $previous !== null && $since < $to && ! empty($config['auto_prev']['tail']);
            if ($previous !== null && ($from < $since || ($tail && $from < $since + $crossfade) || $from < $since + $fade)) {
                $start = max($anchor, $previous['from']);
                $parts[] = [$start, max($start, min($from, $since - 1)), min($since, $to), $previous, $tail, $fade, null];
            }
            if ($since < $to) {
                $parts[] = [$since, max($since, $from), $to, $current, false, 0, $until];
            }
        }

        $items = [];
        foreach ($parts as [$start, $begin, $end, $source, $tail, $fadeOut, $stop]) {
            $resolved = Autopilot::resolve($source['playlist'], $source['shuffle'], $crossfade);
            if ($stop !== null && $stop < $end) {
                array_push($items, ...self::lastCycle($resolved, $source, $start, $begin, $end, $stop, $limit - count($items)));

                continue;
            }
            $songs = Autopilot::fill($resolved['songs'], $resolved['shuffle'], $start, $begin, $end, $limit - count($items), [], $tail, $source['start']);
            if ($fadeOut > 0 && $end === $since) {
                $lengths = array_column($resolved['songs'], 'ms', 'id');
                foreach ($songs as &$song) {
                    if ($song['end'] === $since) {
                        $song['end'] = min($song['origin'] + ($lengths[$song['track']] ?? 0), $since + $fadeOut, $to);
                    }
                }
                unset($song);
                $songs = array_values(array_filter($songs, fn (array $song) => $song['end'] > $from));
            }
            array_push($items, ...$songs);
        }

        return $items;
    }

    /**
     * Songs of a source without repeat between $begin and $end: those that start before $stop
     * play to their end (never past $end), and then silence.
     *
     * @return list<array<string, mixed>>
     */
    private static function lastCycle(array $resolved, array $source, int $start, int $begin, int $end, int $stop, int $limit): array
    {
        $songs = Autopilot::fill($resolved['songs'], $resolved['shuffle'], $start, min($begin, $stop - 1), $stop, $limit, [], true, $source['start']);
        $heard = [];
        foreach ($songs as $song) {
            $song['end'] = min($song['end'], $end);
            if ($song['end'] <= $begin) {
                continue;
            }
            if ($song['start'] < $begin) {
                $song['start'] = $begin;
                $song['seek'] = round(($begin - $song['origin']) / 1000, 3);
            }
            $heard[] = $song;
        }

        return $heard;
    }

    private static function block(string $id, string $kind, string $title, int $begin, int $finish, int $origin): array
    {
        return [
            'id' => $id,
            'kind' => $kind,
            'title' => $title,
            'artist' => null,
            'src' => null,
            'start' => $begin,
            'end' => $finish,
            'origin' => $origin,
            'seek' => round(($begin - $origin) / 1000, 3),
            'bed' => false,
            'block' => null,
            'slot' => null,
            'track' => null,
        ];
    }

    private static function slotItem(RadioSlot $slot, int $begin, int $finish): array
    {
        $start = $slot->starts_at->getTimestampMs();

        return [
            'id' => 's'.$slot->id,
            'kind' => $slot->kind,
            'title' => $slot->title,
            'artist' => $slot->track?->credit(),
            'src' => $slot->kind === RadioSlot::LIVE ? null : $slot->track?->file_path,
            'start' => $begin,
            'end' => $finish,
            'origin' => $start,
            'seek' => round(($begin - $start) / 1000, 3),
            'bed' => false,
            'block' => $slot->kind === RadioSlot::LIVE ? $slot->title : null,
            'slot' => $slot->id,
            'track' => $slot->radio_track_id,
        ];
    }
}
