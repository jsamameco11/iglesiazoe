<?php

namespace App\Domain\Stream;

use App\Domain\Media\Support\MediaLibrary;
use App\Models\LiveRecording;
use App\Models\LiveStream;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

/**
 * Original-quality recordings of each broadcast: the media server writes segments without
 * re-encoding, they are joined into one MP4 and kept on Wasabi only a few days for editing.
 */
final class Recordings
{
    /** Archives the pending segments of a broadcast (or only $files) and removes them from the VPS. */
    public static function archive(string $liveStreamId, ?array $files = null): void
    {
        [$live, $taken] = self::take($liveStreamId, $files);
        if (! $live || ! $taken) {
            return;
        }

        $folder = storage_path('app/private/transmisiones');
        File::ensureDirectoryExists($folder);
        $joined = $folder.'/'.$live->id.'-'.Str::lower(Str::random(6)).'.mp4';
        $outputs = self::join($taken, $joined) ? [$joined] : $taken;

        $part = (int) $live->recordings()->max('part');
        $base = Str::slug(Str::limit($live->title, 60, '')).'-'.($live->started_at ?? now())->copy()->setTimezone('America/Lima')->format('Y-m-d');
        $uploaded = true;
        foreach ($outputs as $path) {
            $part++;
            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION)) ?: 'mp4';
            $name = $base.($part > 1 || count($outputs) > 1 ? '-parte-'.$part : '').'.'.$extension;
            $uploaded = self::upload($live, $path, $part, $name) && $uploaded;
        }

        File::delete($joined);
        if ($uploaded) {
            File::delete($taken);
        } else {
            $live->refresh()->update(['segments' => array_values(array_unique([...$live->segmentFiles(), ...$taken]))]);
        }
    }

    /** Tries again a recording that could not reach Wasabi. */
    public static function retry(LiveStream $live): bool
    {
        if (! $live->segmentFiles()) {
            return false;
        }
        LiveRecording::query()->where('live_stream_id', $live->id)->where('status', 'failed')->delete();

        return true;
    }

    /** Recordings past their days on Wasabi are deleted; returns how many. */
    public static function purge(): int
    {
        $expired = LiveRecording::query()->where('status', 'ready')->whereNotNull('expires_at')->where('expires_at', '<=', now())->get();
        foreach ($expired as $recording) {
            try {
                MediaLibrary::deletePrivate($recording->path);
            } catch (\Throwable $error) {
                Log::warning('No se pudo borrar la grabación '.$recording->id.': '.$error->getMessage());

                continue;
            }
            $recording->update(['status' => 'expired', 'path' => null]);
        }

        return $expired->count();
    }

    /** Seconds of a media file, read with ffprobe. */
    public static function duration(string $path): ?int
    {
        $result = Process::timeout(60)->run([config('stream.ffprobe'), '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', $path]);
        $seconds = trim($result->output());

        return $result->successful() && is_numeric($seconds) ? (int) round((float) $seconds) : null;
    }

    /**
     * Claims the segments to archive so a second run never uploads them twice.
     *
     * @return array{0: ?LiveStream, 1: list<string>}
     */
    private static function take(string $liveStreamId, ?array $files): array
    {
        return DB::transaction(function () use ($liveStreamId, $files) {
            $live = LiveStream::query()->lockForUpdate()->find($liveStreamId);
            if (! $live) {
                return [null, []];
            }
            $pending = $live->segmentFiles();
            $taken = $files === null ? $pending : array_values(array_intersect($pending, $files));
            $live->update(['segments' => array_values(array_diff($pending, $taken))]);

            return [$live, array_values(array_filter($taken, 'is_file'))];
        });
    }

    /** Joins the segments without re-encoding into an MP4 that starts playing right away. */
    private static function join(array $files, string $target): bool
    {
        $list = $target.'.txt';
        File::put($list, collect($files)->map(fn ($file) => "file '".str_replace("'", "'\\''", $file)."'")->implode("\n"));
        $result = Process::timeout(4 * 3600)->run([
            config('stream.ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'concat', '-safe', '0', '-i', $list,
            '-map', '0', '-c', 'copy', '-movflags', '+faststart', $target,
        ]);
        File::delete($list);
        if (! $result->successful()) {
            Log::warning('No se pudo unir la grabación: '.Str::limit($result->errorOutput(), 500));
            File::delete($target);
        }

        return $result->successful() && is_file($target) && filesize($target) > 0;
    }

    private static function upload(LiveStream $live, string $path, int $part, string $name): bool
    {
        $recording = LiveRecording::query()->create([
            'live_stream_id' => $live->id,
            'part' => $part,
            'name' => $name,
            'size' => (int) filesize($path),
            'status' => 'processing',
        ]);
        $key = 'transmisiones/'.now()->format('Y/m').'/'.$live->id.'/'.$name;
        $stream = fopen($path, 'rb');
        try {
            $stored = MediaLibrary::privateDisk()->writeStream($key, $stream, [
                'visibility' => 'private',
                'ContentType' => str_ends_with($name, '.mp4') ? 'video/mp4' : 'application/octet-stream',
            ]);
        } catch (\Throwable $error) {
            $stored = false;
            Log::warning('No se pudo subir la grabación a Wasabi: '.$error->getMessage());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        if ($stored === false) {
            $recording->update(['status' => 'failed', 'error' => 'No se pudo guardar en Wasabi. Los archivos siguen en el servidor.']);

            return false;
        }
        $recording->update([
            'path' => $key,
            'duration_seconds' => self::duration($path),
            'status' => 'ready',
            'expires_at' => now()->addHours((int) config('stream.retention_hours')),
        ]);

        return true;
    }
}
