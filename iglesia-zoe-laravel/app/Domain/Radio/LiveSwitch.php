<?php

namespace App\Domain\Radio;

use App\Models\RadioSlot;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * The live switch: when the automatic music gives way to the live signal and when it comes back.
 *
 * The cut is a window of the main program (start, and an end once it is known) kept in the
 * live state, so every listener hears the switch at the same moment and the music after it
 * starts fresh. In automatic mode a scheduled live block cuts the music by itself as soon as
 * the host is connected (the console session, or the external OBS/Icecast signal answering)
 * and the music comes back when the block ends or the signal drops. The operator can always
 * cut and return by hand; in manual mode only the operator does.
 */
final class LiveSwitch
{
    public const AUTO = 'auto';

    public const MANUAL = 'manual';

    public const CONSOLE = 'consola';

    public const EXTERNAL = 'externo';

    /** Seconds an answer of the external signal is trusted before asking again. */
    private const PROBE_TTL = 10;

    private const SINCE_KEY = 'radio.external.since';

    /** The cut to honour now, reconciled with the schedule and the source in automatic mode. */
    public static function window(array $config, array $live, int $now): ?array
    {
        if (! $config['on_air']) {
            return null;
        }

        return $config['live_mode'] === self::AUTO ? self::reconcile($config, $live, $now) : $live['window'];
    }

    public static function isOpen(?array $window, int $now): bool
    {
        return $window !== null && $window['start'] <= $now && ($window['end'] === null || $window['end'] > $now);
    }

    /** «Ir al vivo»: cuts the automatic music now until the operator returns to it. */
    public static function cut(string $title): array
    {
        $now = Station::nowMs();
        $slot = self::liveSlot($now);

        return Station::updateLive(fn (array $live) => self::isOpen($live['window'], $now) ? [] : [
            'window' => [
                'start' => $now,
                'end' => null,
                'auto' => false,
                'bed' => false,
                'slot' => $slot?->id,
                'title' => $slot?->title ?: $title,
            ],
            'skip' => null,
        ])['window'];
    }

    /**
     * «Volver a la música automática»: closes the cut now. During a scheduled live block the
     * automatic switch leaves that block alone afterwards, so it does not cut the music again.
     */
    public static function resume(): void
    {
        $now = Station::nowMs();
        $slot = self::liveSlot($now);
        Station::updateLive(fn (array $live) => [
            'window' => self::isOpen($live['window'], $now) ? [...$live['window'], 'end' => $now] : $live['window'],
            'skip' => $live['window']['slot'] ?? $slot?->id,
        ]);
    }

    /** When the console session ends, a cut fed by the console ends with it. */
    public static function closeOnHangUp(array $live, array $config): array
    {
        $now = Station::nowMs();
        if ($config['live_source'] !== self::CONSOLE || ! self::isOpen($live['window'], $now)) {
            return [];
        }

        return ['window' => [...$live['window'], 'end' => $now]];
    }

    /** Whether the external signal answers right now (cached for a few seconds). */
    public static function externalOnline(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        return (bool) Cache::remember('radio.external.'.md5($url), self::PROBE_TTL, function () use ($url) {
            try {
                $response = Http::connectTimeout(3)->timeout(4)->withOptions(['stream' => true])->get($url);
                $online = $response->successful();
                $response->close();

                return $online;
            } catch (\Throwable) {
                return false;
            }
        });
    }

    /** The scheduled live block on air at $now, if any. */
    public static function liveSlot(int $now): ?RadioSlot
    {
        return RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', RadioSlot::LIVE)
            ->where('starts_at', '<=', CarbonImmutable::createFromTimestampMs($now))
            ->where('starts_at', '>=', CarbonImmutable::createFromTimestampMs($now - Station::MAX_BLOCK * 1000))
            ->orderByDesc('starts_at')->get()
            ->first(fn (RadioSlot $slot) => $slot->endsAt()->getTimestampMs() > $now);
    }

    private static function reconcile(array $config, array $live, int $now): ?array
    {
        $window = $live['window'];
        $open = self::isOpen($window, $now);
        if ($open && ! $window['auto']) {
            return $window;
        }

        $slot = self::liveSlot($now);
        $since = $slot && $live['skip'] !== $slot->id ? self::connectedSince($config, $live, $now) : null;
        if ($slot && $since !== null) {
            $end = $slot->endsAt()->getTimestampMs();
            if ($open && $window['slot'] === $slot->id) {
                return $window['end'] === $end ? $window : self::store([...$window, 'end' => $end]);
            }

            return self::store([
                'start' => max($slot->starts_at->getTimestampMs(), $since),
                'end' => $end,
                'auto' => true,
                'bed' => $slot->bed,
                'slot' => $slot->id,
                'title' => $slot->title,
            ]);
        }

        return $open ? self::store([...$window, 'end' => $now]) : $window;
    }

    /** Since when the host is connected, or null when nobody is. */
    private static function connectedSince(array $config, array $live, int $now): ?int
    {
        if ($config['live_source'] !== self::EXTERNAL) {
            return $live['session'] ? (int) $live['started_at'] : null;
        }
        if (! self::externalOnline((string) $config['live_url'])) {
            Cache::forget(self::SINCE_KEY);

            return null;
        }

        return (int) Cache::rememberForever(self::SINCE_KEY, fn () => $now);
    }

    private static function store(array $window): array
    {
        return Station::updateLive(fn () => ['window' => $window])['window'];
    }
}
