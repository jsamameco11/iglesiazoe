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
        // Automatic music of the gaps: a playlist id (null = every list), shuffled or in order.
        // A change applies from auto_since (when the song on air ends); before it, auto_prev played.
        'auto_playlist' => null,
        'auto_shuffle' => true,
        'auto_since' => 0,
        'auto_prev' => null,
        // Live switch: automatic or manual, fed by the console or an external OBS/Icecast signal.
        'live_mode' => LiveSwitch::AUTO,
        'live_source' => LiveSwitch::CONSOLE,
        'live_url' => '',
    ];

    private const LIVE_DEFAULTS = [
        'session' => null,
        'host' => '',
        'started_at' => null,
        'music' => 100,
        'overlay' => 100,
        'muted' => false,
        'bed' => false,
        'mic' => false,
        'layers' => [],
        'window' => null,
        'skip' => null,
        'rev' => 0,
    ];

    /** The console sends a heartbeat every ~1.5 s; after this many seconds of silence the live session ends. */
    private const OPERATOR_TIMEOUT = 25;

    private const LISTENER_WINDOW = 40;

    /** Pads sounding at once; older ones are dropped first. */
    private const PADS_AT_ONCE = 8;

    /** Scheduled overlays this far ahead travel with the state so listeners can preload them. */
    private const LAYER_LOOKAHEAD = 60000;

    /** 2026-01-01 00:00 in Lima: start of the music rotation when the timeline has never had a block. */
    private const ROTATION_EPOCH = 1767243600000;

    private const CONFIG_KEY = 'radio.config';

    private const LIVE_KEY = 'radio.live';

    private const OPERATOR_KEY = 'radio.operator';

    public static function nowMs(): int
    {
        return CarbonImmutable::now()->getTimestampMs();
    }

    public static function config(): array
    {
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
     * Changes the automatic music of the gaps. The song on air finishes first: the new source
     * starts when it ends (at once when no automatic song is playing, or when $now is asked).
     *
     * @return int when the new source starts (UTC ms)
     */
    public static function switchAutopilot(?string $playlist, bool $shuffle, bool $immediately = false): int
    {
        $config = self::config();
        $now = self::nowMs();
        $current = $immediately ? null : collect(self::program($now)[1])->filter(fn (array $item) => $item['start'] <= $now)->last();
        $since = $current && $current['kind'] === 'musica' && $current['slot'] === null && $current['block'] === null
            ? max($now, (int) $current['end'])
            : $now;
        $wasPlaying = $config['auto_since'] > $now ? $config['auto_prev'] : null;
        self::saveConfig([
            'auto_prev' => $wasPlaying ?? ['playlist' => $config['auto_playlist'], 'shuffle' => (bool) $config['auto_shuffle']],
            'auto_since' => $since,
            'auto_playlist' => $playlist,
            'auto_shuffle' => $shuffle,
        ]);

        return $since;
    }

    /** The automatic music of the gaps, for the console and the schedule. */
    public static function autopilot(?array $config = null): array
    {
        $config ??= self::config();

        return [
            'playlist' => $config['auto_playlist'],
            'shuffle' => (bool) $config['auto_shuffle'],
            'label' => Autopilot::label($config['auto_playlist']),
            'since' => (int) $config['auto_since'],
            'paused' => ! $config['autofill'],
        ];
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
        $config = self::config();

        return self::updateLive(fn (array $live) => [
            'session' => null, 'host' => '', 'started_at' => null, 'mic' => false, 'bed' => false, 'muted' => false,
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
     * A looped layer repeats until it is stopped.
     */
    public static function playLayer(RadioTrack $track, string $lane, int $volume, bool $duck, float $fadeIn = 0, float $fadeOut = 0, bool $loop = false): array
    {
        $now = self::nowMs();
        $length = (int) round($track->duration * 1000);
        $fadeIn = self::fade($fadeIn);
        $layer = [
            'id' => Str::lower(Str::random(12)),
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

    /** Gains every listener applies: music bus (after the console faders), layers bus, bed and duck levels. */
    public static function mix(array $live, array $config): array
    {
        $music = $live['muted'] ? 0.0 : ($live['music'] / 100) * ($live['bed'] ? $config['bed_level'] / 100 : 1);

        return [
            'music' => round($music, 3),
            'fx' => round(($config['fx_level'] / 100) * ($live['overlay'] / 100), 3),
            'bed' => round($config['bed_level'] / 100, 3),
            'duck' => round($config['duck_level'] / 100, 3),
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
        $items = [];
        $cursor = $from;
        $anchor = null;

        foreach (self::entries(self::slotsBetween($from, $to), $window, $expand) as $entry) {
            if ($entry['end'] <= $cursor) {
                continue;
            }
            if ($entry['start'] > $cursor) {
                $anchor ??= $cursor === $from ? self::anchorBefore($from, $window) : $cursor;
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
            $anchor ??= self::anchorBefore($from, $window);
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
            ->filter(fn (RadioSlot $slot) => $slot->track?->active && $slot->endsAt()->getTimestampMs() > $now);

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
        $now = self::nowMs();
        $onAir = (bool) $config['on_air'];
        [$previous, $queue] = $onAir ? self::program($now) : [null, []];
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
            'layers' => $onAir ? self::layers($live, $now) : [],
            'next_show' => $next ? ['title' => $next->title, 'kind' => $next->kind, 'start' => $next->starts_at->getTimestampMs()] : null,
            'live' => [
                'on' => $onAir && ($live['session'] !== null || $external),
                'session' => $onAir ? $live['session'] : null,
                'host' => $live['host'],
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
     * The song before the one on air and the items from now on (the one on air first;
     * during a crossfade the song fading out comes first and keeps playing).
     *
     * @return array{0: ?array, 1: list<array>}
     */
    private static function program(int $now): array
    {
        $items = self::items($now - 20 * 60000, $now + 4 * 3600000, true, 60);
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

        return [$previous, $queue];
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
                && (in_array($slot->kind, [RadioSlot::LIVE, RadioSlot::AUTO], true) || ($slot->track && $slot->track->active)))
            ->values();
    }

    /**
     * The main program as entries of what sounds: scheduled blocks, automatic periods and the
     * live cut, which overrides whatever was scheduled under it. Live blocks only sound while
     * the cut holds them, so outside it they are gaps the music fills. Back-to-back periods of
     * the same playlist play as one, so a long period does not restart at each block.
     *
     * @return list<array{type: string, start: int, end: int, anchor: int, slot: ?RadioSlot, window: ?array}>
     */
    private static function entries(Collection $slots, ?array $window, bool $expand): array
    {
        $entries = [];
        foreach ($slots as $slot) {
            if ($expand && $slot->kind === RadioSlot::LIVE) {
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

            return Autopilot::fill(Autopilot::songs($slot->radio_playlist_id, $crossfade), $slot->shuffle, $entry['anchor'], $begin, $finish, $limit, ['block' => $slot->title]);
        }

        if ($entry['type'] === 'cut') {
            $window = $entry['window'];
            if ($window['bed']) {
                $songs = Autopilot::songs($config['auto_playlist'], $crossfade);
                if ($songs) {
                    return Autopilot::fill($songs, (bool) $config['auto_shuffle'], $window['start'], $begin, $finish, $limit, ['kind' => 'vivo', 'bed' => true, 'block' => $window['title']]);
                }
            }

            return [[...self::block('live-'.$window['start'], RadioSlot::LIVE, $window['title'], $begin, $finish, $window['start']), 'block' => $window['title'], 'slot' => $window['slot']]];
        }

        return [self::slotItem($slot, $begin, $finish)];
    }

    /**
     * Where the gap that contains $at began: the end of the block before it (live blocks only
     * count through the cut, since the music plays across them when nobody is on air).
     */
    private static function anchorBefore(int $at, ?array $window): int
    {
        $previous = RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::LIVE)
            ->where('starts_at', '<', CarbonImmutable::createFromTimestampMs($at))->orderByDesc('starts_at')->first();
        $ends = array_filter(
            [$previous?->endsAt()->getTimestampMs(), $window['end'] ?? null],
            fn (?int $end) => $end !== null && $end <= $at,
        );

        return $ends ? max($ends) : self::ROTATION_EPOCH;
    }

    /**
     * Automatic music of a gap, from the station's source. A source change splits the gap: the
     * old source plays until auto_since and the new one starts fresh there.
     */
    private static function gap(array $config, int $anchor, int $from, int $to, bool $expand, int $limit): array
    {
        if ($to <= $from || ! $config['autofill'] || $limit <= 0) {
            return [];
        }
        $crossfade = (int) round($config['crossfade'] * 1000);
        $current = ['playlist' => $config['auto_playlist'], 'shuffle' => (bool) $config['auto_shuffle']];
        if (! $expand) {
            return Autopilot::songs($current['playlist'], $crossfade) ? [self::block('gap-'.$from, 'relleno', 'Música continua', $from, $to, $from)] : [];
        }

        $since = (int) $config['auto_since'];
        $previous = is_array($config['auto_prev']) ? $config['auto_prev'] : null;
        $parts = $previous && $anchor < $since && $since < $to
            ? [[$anchor, $since, $previous], [$since, $to, $current]]
            : [[$anchor, $to, $previous && $anchor < $since ? $previous : $current]];

        $items = [];
        foreach ($parts as [$start, $end, $source]) {
            $songs = Autopilot::songs($source['playlist'] ?? null, $crossfade);
            array_push($items, ...Autopilot::fill($songs, (bool) ($source['shuffle'] ?? true), $start, max($start, $from), $end, $limit - count($items)));
        }

        return $items;
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
            'artist' => $slot->track?->artist,
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
