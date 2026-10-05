<?php

namespace App\Domain\Radio\Editor;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Station;
use App\Models\RadioTrack;
use Illuminate\Contracts\Process\ProcessResult;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Edits audio of the radio library with ffmpeg, without ever losing the original: the first edit
 * keeps the original file aside, and every edit is rendered again from it with the whole recipe,
 * so an edit can be reopened, adjusted or undone.
 *
 * @phpstan-import-type Recipe from EditRecipe
 */
final class AudioEditor
{
    /** Seconds of the edited audio the admin hears when asking for the final result. */
    public const PREVIEW_SECONDS = 15;

    /** An edit still "processing" after this many seconds per second of audio (and at least 15 minutes) was interrupted. */
    private const STALE_FACTOR = 0.6;

    private const ANALYSIS_DIR = 'radio-editor/analysis';

    /**
     * Waveform and loudness of the audio the editor works from, measured once per file. The peaks are
     * base64 of signed bytes: a minimum and a maximum for each slice of 1/perSecond seconds.
     *
     * @return array{perSecond: int, peaks: string, duration: float, loudness: ?float, peak: ?float}|null
     */
    public static function analysis(RadioTrack $track): ?array
    {
        $path = $track->sourcePath();
        $cache = self::ANALYSIS_DIR.'/'.$track->id.'-'.md5((string) $path).'.json';
        $disk = Storage::disk('local');
        if ($disk->exists($cache)) {
            $known = json_decode((string) $disk->get($cache), true);
            if (is_array($known)) {
                return $known;
            }
        }
        $input = self::input($path);
        if ($input === null) {
            return null;
        }

        $duration = max(1.0, $track->sourceDuration());
        $perSecond = $duration <= 600 ? 100 : ($duration <= 1800 ? 40 : max(8, intdiv(120000, (int) ceil($duration))));
        $rate = $duration <= 1200 ? 8000 : max(2000, (int) floor(9_600_000 / $duration));
        $rate = max($perSecond, intdiv($rate, $perSecond) * $perSecond);
        $pcm = self::temporary('pcm');

        try {
            $result = self::ffmpeg([
                '-nostats', '-i', $input,
                '-filter_complex', "[0:a]aformat=channel_layouts=stereo,asplit=2[w][l];[w]pan=mono|c0=0.5*c0+0.5*c1,aresample={$rate}[p];[l]ebur128=peak=true:framelog=quiet[e]",
                '-map', '[p]', '-f', 's16le', '-c:a', 'pcm_s16le', $pcm,
                '-map', '[e]', '-f', 'null', '-',
            ], 240, 'info');
            if (! $result->successful() || ! is_file($pcm)) {
                return null;
            }
            [$peaks, $samples] = self::peaks($pcm, intdiv($rate, $perSecond));
        } finally {
            @unlink($pcm);
        }
        if ($samples === 0) {
            return null;
        }

        $log = $result->errorOutput();
        $analysis = [
            'perSecond' => $perSecond,
            'peaks' => base64_encode($peaks),
            'duration' => round($samples / $rate, 3),
            'loudness' => preg_match_all('/I:\s+(-?[\d.]+) LUFS/', $log, $loud) ? (float) end($loud[1]) : null,
            'peak' => preg_match_all('/Peak:\s+(-?[\d.]+) dBFS/', $log, $peak) ? (float) end($peak[1]) : null,
        ];
        $disk->put($cache, json_encode($analysis));

        return $analysis;
    }

    /**
     * Renders the recipe from the original and puts the result in the library in place of the audio.
     *
     * @param  Recipe  $recipe
     *
     * @throws RuntimeException when ffmpeg or the storage fail
     */
    public static function render(RadioTrack $track, array $recipe): void
    {
        set_time_limit(0);
        $duration = $track->sourceDuration();
        $input = self::input($track->sourcePath()) ?? throw new RuntimeException('No encontramos el archivo original de este audio.');
        $target = self::temporary('mp3');

        try {
            $result = self::ffmpeg([
                '-i', $input,
                '-filter_complex', FilterGraph::build($recipe, $duration, self::loudnessGain($recipe, $duration, $input)),
                '-map', '[out]', '-c:a', 'libmp3lame', '-q:a', '2', '-map_metadata', '-1', $target,
            ], max(600, (int) ceil($duration * 3)));
            if (! $result->successful() || ! is_file($target) || filesize($target) === 0) {
                throw self::failure('No se pudo procesar el audio. Revisa que el archivo original no esté dañado e inténtalo de nuevo.', $result);
            }
            $stored = self::store($target, $track->kind);
        } finally {
            @unlink($target);
        }

        $track->refresh();
        $previous = $track->file_path;
        $track->update([
            'original_path' => $track->original_path ?: $track->file_path,
            'original_duration' => $track->original_path ? $track->original_duration : $track->duration,
            'file_path' => $stored,
            'duration' => EditRecipe::length($recipe, $duration),
            'edit' => $recipe,
            'edit_status' => null,
            'edit_error' => null,
            'edited_at' => now(),
        ]);
        if ($previous !== $track->original_path) {
            MediaLibrary::deletePublic($previous);
        }
        self::retime($track);
    }

    /**
     * A few seconds of the edited audio from a point of the edited timeline, rendered exactly as saving would.
     * Returns the path of a temporary MP3 the caller deletes.
     *
     * @param  Recipe  $recipe
     *
     * @throws RuntimeException
     */
    public static function preview(RadioTrack $track, array $recipe, float $at): string
    {
        $duration = $track->sourceDuration();
        $input = self::input($track->sourcePath()) ?? throw new RuntimeException('No encontramos el archivo de este audio.');
        $at = max(0, min($at, EditRecipe::length($recipe, $duration) - 1));
        $loudness = $recipe['normalize'] ? (self::analysis($track)['loudness'] ?? null) : null;
        $target = self::temporary('mp3');

        $result = self::ffmpeg([
            '-i', $input,
            '-filter_complex', FilterGraph::build($recipe, $duration, $loudness === null ? 0.0 : self::clamp(FilterGraph::TARGET_LUFS - $loudness)),
            '-map', '[out]', '-ss', sprintf('%.3F', $at), '-t', (string) self::PREVIEW_SECONDS,
            '-c:a', 'libmp3lame', '-b:a', '192k', $target,
        ], 180);
        if (! $result->successful() || ! is_file($target) || filesize($target) === 0) {
            @unlink($target);

            throw self::failure('No se pudo preparar la muestra. Inténtalo de nuevo en un momento.', $result);
        }

        return $target;
    }

    /** Puts the original audio back and forgets the edit. */
    public static function restore(RadioTrack $track): void
    {
        if (! $track->original_path) {
            return;
        }
        $edited = $track->file_path;
        $track->update([
            'file_path' => $track->original_path,
            'duration' => $track->original_duration ?: $track->duration,
            'original_path' => null,
            'original_duration' => null,
            'edit' => null,
            'edit_status' => null,
            'edit_error' => null,
            'edited_at' => null,
        ]);
        if ($edited !== $track->file_path) {
            MediaLibrary::deletePublic($edited);
        }
        self::retime($track);
    }

    /**
     * A new audio uploaded in place of an edited one starts clean: the kept original is deleted and the
     * edit forgotten. Returns the fields to save with the new audio.
     *
     * @return array<string, null>
     */
    public static function forget(RadioTrack $track): array
    {
        if (! $track->original_path) {
            return [];
        }
        MediaLibrary::deletePublic($track->original_path);

        return ['original_path' => null, 'original_duration' => null, 'edit' => null, 'edit_status' => null, 'edit_error' => null, 'edited_at' => null];
    }

    /** Whether an edit marked as processing was cut off (the server restarted, the process was killed). */
    public static function isStale(RadioTrack $track): bool
    {
        return $track->edit_status === 'processing'
            && $track->updated_at !== null
            && $track->updated_at->lt(now()->subSeconds(max(900, (int) ($track->sourceDuration() * self::STALE_FACTOR))));
    }

    /**
     * dB that bring the processed audio to the target loudness, measured with a first pass.
     *
     * @param  Recipe  $recipe
     */
    private static function loudnessGain(array $recipe, float $duration, string $input): float
    {
        if (! $recipe['normalize']) {
            return 0.0;
        }
        $result = self::ffmpeg([
            '-nostats', '-i', $input,
            '-filter_complex', FilterGraph::build($recipe, $duration, 0.0, true),
            '-map', '[out]', '-f', 'null', '-',
        ], max(600, (int) ceil($duration * 3)), 'info');
        if (! $result->successful() || preg_match('/"input_i"\s*:\s*"(-?[\d.]+)"/', $result->errorOutput(), $match) !== 1 || ! is_finite((float) $match[1])) {
            throw new RuntimeException('No se pudo medir el volumen del audio para normalizarlo.');
        }

        return self::clamp(FilterGraph::TARGET_LUFS - (float) $match[1]);
    }

    /** A new length reaches what is already scheduled with this audio, and the station hears the new file. */
    private static function retime(RadioTrack $track): void
    {
        $track->slots()->where('starts_at', '>=', now())->update(['duration' => $track->duration]);
        Station::flush();
    }

    /**
     * Minimum and maximum of every slice of a 16-bit mono PCM file, scaled to signed bytes, read in chunks.
     *
     * @return array{0: string, 1: int} bytes and number of samples read
     */
    private static function peaks(string $pcm, int $slice): array
    {
        $handle = fopen($pcm, 'rb');
        if ($handle === false) {
            return ['', 0];
        }
        $bytes = '';
        $count = 0;
        $low = 0;
        $high = 0;
        $filled = 0;
        $carry = '';
        while (! feof($handle)) {
            $chunk = $carry.(string) fread($handle, 65536);
            $even = strlen($chunk) - (strlen($chunk) % 2);
            $carry = substr($chunk, $even);
            if ($even === 0) {
                continue;
            }
            foreach (unpack('s*', substr($chunk, 0, $even)) as $sample) {
                $low = min($low, $sample);
                $high = max($high, $sample);
                if (++$filled === $slice) {
                    $bytes .= pack('cc', intdiv($low, 256), intdiv($high, 256));
                    $low = $high = $filled = 0;
                }
                $count++;
            }
        }
        fclose($handle);
        if ($filled > 0) {
            $bytes .= pack('cc', intdiv($low, 256), intdiv($high, 256));
        }

        return [$bytes, $count];
    }

    /** What ffmpeg reads for a "/media/..." file: a signed link on Wasabi, the file itself on a local disk. */
    private static function input(?string $path): ?string
    {
        $key = MediaLibrary::keyOf($path);
        if ($key === null) {
            return null;
        }
        $disk = MediaLibrary::publicDisk();
        if ($disk instanceof AwsS3V3Adapter) {
            return MediaLibrary::publicUrl($key);
        }

        return $disk->exists($key) ? $disk->path($key) : null;
    }

    /** Uploads a rendered file next to the library's audio and returns its site path. */
    private static function store(string $file, string $kind): string
    {
        $key = 'radio/'.$kind.'/'.now()->format('Ymd-His').'-'.Str::lower(Str::random(10)).'-editado.mp3';
        $stream = fopen($file, 'rb');
        if ($stream === false) {
            throw new RuntimeException('No se pudo leer el audio procesado.');
        }
        try {
            $stored = MediaLibrary::publicDisk()->writeStream($key, $stream, [
                'visibility' => 'public',
                'ContentType' => 'audio/mpeg',
                'CacheControl' => 'public, max-age=31536000, immutable',
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        if ($stored === false) {
            throw new RuntimeException('No se pudo guardar el audio procesado.');
        }

        return MediaLibrary::PUBLIC_PREFIX.$key;
    }

    /**
     * Runs ffmpeg with low priority, so the web stays fast while it works.
     *
     * @param  list<string>  $arguments
     */
    /** A message the admin can act on; ffmpeg's own output only goes to the log. */
    private static function failure(string $message, ProcessResult $result): RuntimeException
    {
        Log::warning('Editor de audio: '.$message, ['ffmpeg' => Str::limit(trim($result->errorOutput() ?: $result->output()), 1000)]);

        return new RuntimeException($message);
    }

    private static function ffmpeg(array $arguments, int $timeout, string $logLevel = 'error'): ProcessResult
    {
        $command = [config('stream.ffmpeg'), '-hide_banner', '-loglevel', $logLevel, '-y', ...$arguments];
        if (PHP_OS_FAMILY === 'Linux') {
            $command = ['nice', '-n', '10', ...$command];
        }

        return Process::timeout($timeout)->run($command);
    }

    private static function temporary(string $extension): string
    {
        $directory = storage_path('app/radio-editor/tmp');
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        return $directory.'/'.Str::lower(Str::random(16)).'.'.$extension;
    }

    private static function clamp(float $gain): float
    {
        return max(-20.0, min(20.0, round($gain, 2)));
    }
}
