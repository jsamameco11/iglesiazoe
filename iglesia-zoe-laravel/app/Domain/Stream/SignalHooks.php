<?php

namespace App\Domain\Stream;

use App\Domain\Stream\Jobs\ArchiveRecording;
use App\Models\LiveStream;
use Illuminate\Support\Facades\DB;

/** What the media server reports about the signal: someone publishing, the signal ready or gone, a recording segment closed. */
final class SignalHooks
{
    /** Only OBS with the current key publishes, and not in the minute after a broadcast was ended (OBS reconnects on its own). */
    public static function mayPublish(?string $path, ?string $user, ?string $password): bool
    {
        if ($path !== config('stream.path') || ! StreamSettings::allowsPublisher($user, $password)) {
            return false;
        }

        return ! Broadcasts::coolingDown() || LiveStream::query()->whereIn('status', LiveStream::OPEN)->exists();
    }

    /**
     * The signal is ready: the broadcast goes on air.
     * Returns the YouTube address the media server relays to, or null to keep it on the site only.
     */
    public static function started(): ?string
    {
        $live = LiveStream::current() ?? Broadcasts::quick();
        $live->update([
            'status' => 'live',
            'signal_at' => now(),
            'signal_lost_at' => null,
            'started_at' => $live->started_at ?? now(),
        ]);
        LiveState::forget();

        if (! $live->to_youtube || ! $live->youtube_mode || ($live->youtube_mode === 'api' && ! $live->youtube_id)) {
            return null;
        }
        $target = StreamSettings::relayTarget();

        return $target && $target['mode'] === $live->youtube_mode ? $target['url'] : null;
    }

    /** The signal stopped: the broadcast waits for it to come back until it is ended. */
    public static function stopped(): void
    {
        LiveStream::query()->where('status', 'live')->whereNull('signal_lost_at')->update(['signal_lost_at' => now(), 'updated_at' => now()]);
        LiveState::forget();
    }

    /** A recording segment was closed; it belongs to the broadcast on air or the one that just ended. */
    public static function segment(string $file): void
    {
        $file = self::recordingFile($file);
        if (! $file) {
            return;
        }

        $late = false;
        $live = DB::transaction(function () use ($file, &$late) {
            $live = LiveStream::query()->where('status', 'live')->latest('started_at')->lockForUpdate()->first()
                ?? LiveStream::query()->where('status', 'ended')->where('ended_at', '>=', now()->subMinutes(30))->latest('ended_at')->lockForUpdate()->first();
            if (! $live || in_array($file, $live->segmentFiles(), true)) {
                return null;
            }
            $late = $live->status === 'ended' && $live->ended_at->lt(now()->subSeconds(Broadcasts::ARCHIVE_DELAY - 5));
            $live->update(['segments' => [...$live->segmentFiles(), $file]]);

            return $live;
        });

        if ($live && $late) {
            ArchiveRecording::dispatch($live->id, [$file])->onConnection(config('stream.queue'));
        }
    }

    /** Full path of a segment, only when it lies inside the recordings folder. */
    public static function recordingFile(string $file): ?string
    {
        $root = realpath((string) config('stream.recordings'));
        $real = realpath($file);
        if (! $root || ! $real || ! is_file($real)) {
            return null;
        }

        return str_starts_with($real, rtrim($root, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR) ? $real : null;
    }
}
