<?php

namespace App\Domain\Site\Sermons;

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\SiteSetting;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Crypt;

/**
 * How the channel watcher works: whether new YouTube videos go straight to the site or wait
 * for an admin, how often it looks, which videos count as a sermon and what it last did.
 * Private: never shared with the public site, the API key is stored encrypted.
 */
final class SermonSettings
{
    private const KEY = 'sermons_youtube';

    public const TIMEZONE = 'America/Lima';

    public const MODES = ['auto', 'review', 'off'];

    public const FILTERS = ['streams', 'all'];

    public const INTERVALS = [1, 3, 6, 12, 24];

    private const MAX_RUNS = 20;

    private const MAX_IGNORED = 500;

    public const DEFAULTS = [
        'mode' => 'auto',
        'every_hours' => 12,
        'start_hour' => 14,
        'filter' => 'streams',
        'min_minutes' => 20,
        'since' => null,
        'channel_url' => null,
        'preacher' => '',
        'series_sunday' => 'Servicio dominical',
        'series_weekday' => 'Servicio de media semana',
    ];

    /** Settings the panel edits, with defaults filled in. */
    public static function current(): array
    {
        $stored = self::stored();

        return array_replace(self::DEFAULTS, array_intersect_key($stored, self::DEFAULTS));
    }

    /**
     * Normalizes what the panel sent and stores it; a blank API key keeps the current one.
     *
     * @param  array<string, mixed>  $input
     */
    public static function save(array $input): array
    {
        $current = self::current();
        $since = is_string($input['since'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['since']) ? $input['since'] : null;
        $next = [
            'mode' => in_array($input['mode'] ?? null, self::MODES, true) ? $input['mode'] : $current['mode'],
            'every_hours' => in_array((int) ($input['every_hours'] ?? 0), self::INTERVALS, true) ? (int) $input['every_hours'] : $current['every_hours'],
            'start_hour' => max(0, min(23, (int) ($input['start_hour'] ?? $current['start_hour']))),
            'filter' => in_array($input['filter'] ?? null, self::FILTERS, true) ? $input['filter'] : $current['filter'],
            'min_minutes' => max(0, min(240, (int) ($input['min_minutes'] ?? $current['min_minutes']))),
            'since' => $since,
            'channel_url' => self::normalizeChannel($input['channel_url'] ?? null),
            'preacher' => mb_substr(trim((string) ($input['preacher'] ?? '')), 0, 120),
            'series_sunday' => mb_substr(trim((string) ($input['series_sunday'] ?? '')), 0, 120) ?: self::DEFAULTS['series_sunday'],
            'series_weekday' => mb_substr(trim((string) ($input['series_weekday'] ?? '')), 0, 120) ?: self::DEFAULTS['series_weekday'],
        ];
        $key = trim((string) ($input['api_key'] ?? ''));
        if ($key !== '') {
            $next['api_key'] = Crypt::encryptString($key);
        }
        if (! empty($input['forget_api_key'])) {
            $next['api_key'] = null;
        }
        self::put($next);

        return self::current();
    }

    /** The channel page the watcher reads: the panel's choice, or the YouTube link of the site. */
    public static function channelUrl(): string
    {
        $url = self::current()['channel_url'] ?: (LoadPublicSite::settings()['youtube'] ?? '');

        return self::normalizeChannel($url) ?? '';
    }

    public static function apiKey(): ?string
    {
        $value = self::stored()['api_key'] ?? null;
        if (! is_string($value) || $value === '') {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /** Videos an admin discarded: the watcher never brings them back. */
    public static function ignored(): array
    {
        $ignored = self::stored()['ignored'] ?? [];

        return is_array($ignored) ? array_values(array_filter($ignored, 'is_string')) : [];
    }

    public static function ignore(string $videoId): void
    {
        $ignored = array_values(array_unique([$videoId, ...self::ignored()]));
        self::put(['ignored' => array_slice($ignored, 0, self::MAX_IGNORED)]);
    }

    public static function unignore(string $videoId): void
    {
        self::put(['ignored' => array_values(array_diff(self::ignored(), [$videoId]))]);
    }

    /** Latest checks, newest first. */
    public static function runs(): array
    {
        $runs = self::stored()['runs'] ?? [];

        return is_array($runs) ? array_values($runs) : [];
    }

    public static function lastRunAt(): ?CarbonImmutable
    {
        $at = self::stored()['last_run_at'] ?? null;

        return is_string($at) ? CarbonImmutable::parse($at) : null;
    }

    /** Remembers a check; a failed one keeps the schedule moving so a broken page is not hammered. */
    public static function recordRun(array $run): void
    {
        self::put([
            'runs' => array_slice([$run, ...self::runs()], 0, self::MAX_RUNS),
            'last_run_at' => $run['at'],
        ]);
    }

    /**
     * When the next automatic check is due: slots start at the configured hour (Lima) and repeat
     * every N hours, so with 12 hours and 14:00 it looks at 02:00 and 14:00 every day.
     */
    public static function nextRunAt(?CarbonInterface $now = null): ?CarbonImmutable
    {
        $settings = self::current();
        if ($settings['mode'] === 'off') {
            return null;
        }
        $now = CarbonImmutable::instance($now ?? now())->setTimezone(self::TIMEZONE);
        $every = (int) $settings['every_hours'];
        $anchor = $now->startOfDay()->subDay()->setTime((int) $settings['start_hour'], 0);
        $after = self::lastRunAt()?->setTimezone(self::TIMEZONE) ?? $now->subHours($every);
        $slot = (int) max(0, floor(($after->getTimestamp() - $anchor->getTimestamp()) / ($every * 3600)) + 1);

        return $anchor->addHours($slot * $every);
    }

    public static function due(?CarbonInterface $now = null): bool
    {
        $next = self::nextRunAt($now);

        return $next !== null && ! $next->isAfter($now ?? now());
    }

    /** What the panel shows, with the key masked. */
    public static function panel(): array
    {
        return [
            ...self::current(),
            'channel' => self::channelUrl(),
            'has_api_key' => self::apiKey() !== null,
            'last_run_at' => self::lastRunAt()?->toIso8601String(),
            'next_run_at' => self::nextRunAt()?->toIso8601String(),
            'runs' => self::runs(),
            'ignored' => count(self::ignored()),
            'running' => SermonSync::queued(),
        ];
    }

    public static function clearIgnored(): void
    {
        self::put(['ignored' => null]);
    }

    /** Accepts a channel link (@handle, /channel/UC…, /c/…) and drops any tab after it. */
    public static function normalizeChannel(mixed $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (preg_match('~^@[\w.\-]{3,}$~u', $value)) {
            return 'https://www.youtube.com/'.$value;
        }
        if (preg_match('~youtube\.com/(@[\w.\-]{3,}|channel/UC[\w-]{22}|c/[\w.\-]+|user/[\w.\-]+)~u', $value, $match)) {
            return 'https://www.youtube.com/'.$match[1];
        }

        return null;
    }

    private static function stored(): array
    {
        $stored = SiteSetting::query()->find(self::KEY)?->value;

        return is_array($stored) ? $stored : [];
    }

    /** Saves without touching the public site version: the watcher settings never change what the site shows. */
    private static function put(array $values): void
    {
        $next = array_filter(array_replace(self::stored(), $values), fn ($value) => $value !== null);
        SiteSetting::withoutEvents(fn () => SiteSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => $next, 'updated_at' => now()]));
    }
}
