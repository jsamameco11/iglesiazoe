<?php

namespace App\Domain\Radio;

use App\Domain\Media\Support\MediaLibrary;
use App\Models\RadioTrack;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Health of the library files, so the radio never sends listeners to a file that cannot sound.
 *
 * A song only leaves the air when two independent signals agree, never on a single one:
 *  - the storage says the file is missing or empty in two checks at least a minute apart, or
 *    once right after a listener's player failed to play it;
 *  - or the file is there but the players of several different listeners failed with it.
 * A storage that does not answer decides nothing, and when a check would take most of the
 * library off the air the storage is assumed to be failing instead (the circuit breaker).
 * Problems are checked again later, so a file that comes back returns to the air on its own.
 *
 * The checks run after the response is sent (listeners never wait for them): a few files
 * per minute, each one again every few hours, the ones with a problem sooner.
 */
final class RadioHealth
{
    public const MISSING = 'missing';

    public const EMPTY = 'empty';

    public const UNPLAYABLE = 'unplayable';

    private const OK = 'ok';

    /** Smaller files are not real audio. */
    private const MIN_BYTES = 1024;

    private const SWEEP_EVERY = 60;

    private const SWEEP_BATCH = 3;

    private const RECHECK_HOURS = 6;

    private const PROBLEM_RECHECK_MINUTES = 15;

    /** A song the listeners could not play stays off the air at least this long. */
    private const UNPLAYABLE_HOURS = 6;

    /** Different listeners (by network address) whose players must fail with the same song. */
    private const REPORTS_NEEDED = 3;

    private const REPORT_WINDOW = 30 * 60;

    /** A storage check of a reported song runs at most this often. */
    private const REPORT_CHECK_EVERY = 120;

    /** Never take more than this share of the library off the air: past it, the storage is failing. */
    private const MAX_BROKEN_SHARE = 0.5;

    private const MIN_LIBRARY_FOR_BREAKER = 4;

    public static function enabled(): bool
    {
        return (bool) config('radio.verify_files', true);
    }

    /** Active audios that are off the air because of their file. */
    public static function brokenCount(): int
    {
        return RadioTrack::query()->where('active', true)->whereNotNull('file_problem')->count();
    }

    /** Checks a few files after the response, at most once a minute. */
    public static function sweepSoon(): void
    {
        if (self::enabled() && Cache::add('radio.health.sweep', 1, self::SWEEP_EVERY)) {
            defer(fn () => self::sweep(), 'radio.health.sweep');
        }
    }

    /** Files waiting for a second check first, then problems due again, then the oldest checks. */
    public static function sweep(): void
    {
        $confirm = array_keys(array_filter(self::pending(), fn (int $due) => $due <= now()->getTimestamp()));
        $tracks = RadioTrack::query()->where('active', true)->whereIn('id', $confirm)->limit(self::SWEEP_BATCH)->get();

        $left = self::SWEEP_BATCH - $tracks->count();
        if ($left > 0) {
            $tracks = $tracks->concat(RadioTrack::query()->where('active', true)->whereNotIn('id', $tracks->modelKeys())
                ->where(fn ($query) => $query->whereNull('file_checked_at')
                    ->orWhere('file_checked_at', '<', now()->subHours(self::RECHECK_HOURS))
                    ->orWhere(fn ($query) => $query->whereNotNull('file_problem')
                        ->where('file_checked_at', '<', now()->subMinutes(self::PROBLEM_RECHECK_MINUTES))))
                ->orderByRaw('case when file_problem is null then 1 else 0 end')
                ->orderByRaw('case when file_checked_at is null then 0 else 1 end')
                ->orderBy('file_checked_at')
                ->limit($left)->get());
        }

        $tracks->each(fn (RadioTrack $track) => self::check($track));
    }

    /**
     * A listener's player could not play a song. The report alone changes nothing: it makes the
     * station check the file now, and counts towards the listeners that failed with it.
     */
    public static function report(RadioTrack $track, string $address): void
    {
        if (! self::enabled() || ! $track->active || $track->file_problem !== null) {
            return;
        }
        $key = "radio.health.reports.{$track->id}";
        $since = now()->getTimestamp() - self::REPORT_WINDOW;
        $reports = array_filter((array) Cache::get($key, []), fn (int $at) => $at >= $since);
        $reports[hash('sha256', $address)] = now()->getTimestamp();
        Cache::put($key, $reports, self::REPORT_WINDOW);

        $firstReport = Cache::add("radio.health.reported.{$track->id}", 1, self::REPORT_CHECK_EVERY);
        $enoughListeners = count($reports) >= self::REPORTS_NEEDED && Cache::add("radio.health.listeners.{$track->id}", 1, 30);
        if ($firstReport || $enoughListeners) {
            $id = $track->id;
            defer(fn () => ($fresh = RadioTrack::query()->find($id)) ? self::check($fresh, reported: true) : null, "radio.health.report.{$id}");
        }
    }

    /**
     * Checks one file and records the verdict.
     *
     * @return string|null the verdict (ok, missing or empty), or null when the storage did not answer
     */
    public static function check(RadioTrack $track, bool $reported = false): ?string
    {
        $verdict = self::inspect($track->file_path);
        if ($verdict === null) {
            Log::notice('Radio: the storage did not answer the check of an audio.', ['track' => $track->id]);

            return null;
        }
        $secondCheck = self::takePending($track->id);

        if ($verdict === self::OK) {
            $listenersFailed = $reported && count((array) Cache::get("radio.health.reports.{$track->id}", [])) >= self::REPORTS_NEEDED;
            if ($listenersFailed) {
                self::markBroken($track, self::UNPLAYABLE);
            } elseif ($track->file_problem !== self::UNPLAYABLE || $track->file_problem_at?->lt(now()->subHours(self::UNPLAYABLE_HOURS))) {
                $wasBroken = $track->file_problem !== null;
                $track->forceFill(['file_checked_at' => now(), 'file_problem' => null, 'file_problem_at' => null])->saveQuietly();
                if ($wasBroken) {
                    Log::info('Radio: an audio is back on the air.', ['track' => $track->id, 'title' => $track->title]);
                    Station::flush();
                }
            } else {
                $track->forceFill(['file_checked_at' => now()])->saveQuietly();
            }

            return $verdict;
        }

        if ($track->file_problem !== null) {
            $track->forceFill(['file_checked_at' => now()])->saveQuietly();
        } elseif ($reported || $secondCheck) {
            self::markBroken($track, $verdict);
        } else {
            self::confirmLater($track->id);
        }

        return $verdict;
    }

    /** What the storage says about a file: ok, missing, empty, or null when it does not answer. */
    private static function inspect(?string $path): ?string
    {
        $key = MediaLibrary::keyOf($path);
        if ($key === null) {
            return null;
        }
        try {
            $disk = MediaLibrary::publicDisk();
            if (! $disk->exists($key)) {
                return self::MISSING;
            }

            return $disk->size($key) < self::MIN_BYTES ? self::EMPTY : self::OK;
        } catch (Throwable) {
            return null;
        }
    }

    private static function markBroken(RadioTrack $track, string $problem): void
    {
        $active = RadioTrack::query()->where('active', true)->count();
        if ($active >= self::MIN_LIBRARY_FOR_BREAKER && (self::brokenCount() + 1) / $active > self::MAX_BROKEN_SHARE) {
            Log::critical('Radio: most of the library looks broken; the storage is assumed to be failing and nothing is taken off the air.', [
                'track' => $track->id, 'problem' => $problem,
            ]);
            $track->forceFill(['file_checked_at' => now()])->saveQuietly();

            return;
        }
        $track->forceFill(['file_checked_at' => now(), 'file_problem' => $problem, 'file_problem_at' => now()])->saveQuietly();
        Cache::forget("radio.health.reports.{$track->id}");
        Log::warning('Radio: an audio left the air because of its file.', ['track' => $track->id, 'title' => $track->title, 'problem' => $problem]);
        Station::flush();
    }

    /** @return array<string, int> track id => when its second check is due */
    private static function pending(): array
    {
        return (array) Cache::get('radio.health.pending', []);
    }

    private static function confirmLater(string $id): void
    {
        $stale = now()->getTimestamp() - 86400;
        $pending = array_filter(self::pending(), fn (int $due) => $due >= $stale);
        Cache::forever('radio.health.pending', [...$pending, $id => now()->getTimestamp() + self::SWEEP_EVERY]);
    }

    /** Whether this check is the second one of a file that already failed once, a minute or more ago. */
    private static function takePending(string $id): bool
    {
        $pending = self::pending();
        if (! isset($pending[$id]) || $pending[$id] > now()->getTimestamp()) {
            return false;
        }
        unset($pending[$id]);
        Cache::forever('radio.health.pending', $pending);

        return true;
    }
}
