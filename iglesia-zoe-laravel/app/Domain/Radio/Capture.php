<?php

namespace App\Domain\Radio;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Actions\SaveEpisode;
use App\Models\RadioRecording;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Records a console transmission in order, then keeps it as a «Programa grabado».
 *
 * The browser sends the microphone that went on air in short pieces. Each piece is
 * appended, never rewritten, so a dropped connection still leaves the audio already
 * received. Closing the transmission does not publish it: the operator then adds
 * the title, the description and the image, and chooses whether it appears as an
 * episode on /radio.
 */
final class Capture
{
    public const RECORDING = 'recording';

    public const READY = 'ready';

    public const SAVED = 'saved';

    public const DISCARDED = 'discarded';

    /** Claimed by a save that is still copying the audio, so a second click cannot create two programs. */
    public const SAVING = 'saving';

    /** Opus at the console bitrate stays under this for a transmission of about four hours. */
    public const MAX_MB = 120;

    private const CHUNK_MB = 8;

    /** A recording nobody saved is removed after this many days. */
    private const KEEP_DAYS = 2;

    /** @var list<string> */
    private const OPEN = [self::RECORDING, self::READY];

    /**
     * Opens the recording of the transmission that is on air now.
     *
     * @return array{recording: RadioRecording}|array{error: string, status: int, recording?: RadioRecording}
     */
    public static function open(User $user, string $session): array
    {
        $session = Str::lower(trim($session));
        if (! preg_match('/^[a-z0-9]{16,40}$/', $session) || Station::live()['session'] !== $session) {
            return ['error' => 'Abre la transmisión en vivo para empezar a grabar.', 'status' => 409];
        }

        return self::exclusive($user, function () use ($user, $session) {
            self::recover($user);
            $current = self::unfinished($user);
            if ($current && $current->session === $session && $current->status === self::RECORDING) {
                return ['recording' => $current];
            }
            if ($current) {
                if ($current->status === self::RECORDING && $current->updated_at->lt(now()->subSeconds(25))) {
                    self::seal($current, $current->duration ?? 0);
                    $current->refresh();
                }
                if (in_array($current->status, self::OPEN, true)) {
                    return [
                        'error' => 'Hay una grabación anterior sin guardar. Guárdala o descártala para grabar esta transmisión.',
                        'status' => 409,
                        'recording' => $current,
                    ];
                }
            }

            $recording = RadioRecording::query()->create([
                'user_id' => $user->id,
                'session' => $session,
                'status' => self::RECORDING,
                'extension' => 'webm',
                'mime' => 'audio/webm',
                'bytes' => 0,
                'parts' => 0,
                'started_at' => now(),
            ]);
            $recording->update(['path' => 'radio-recordings/'.$recording->id]);

            return ['recording' => $recording->refresh()];
        });
    }

    /**
     * Appends the next piece. Pieces already stored are accepted again, so a retry does not duplicate audio.
     *
     * @return array{recording: RadioRecording, code?: string}|array{error: string, status: int, code?: string, recording?: RadioRecording}
     */
    public static function append(User $user, string $id, int $index, UploadedFile $chunk, string $extension): array
    {
        if ($index < 0 || $index > 20000) {
            return ['error' => 'Ese tramo de la grabación no corresponde.', 'status' => 422];
        }
        $extension = strtolower($extension);
        if (! in_array($extension, ['webm', 'm4a'], true)) {
            return ['error' => 'La grabación tiene que ser audio WebM o M4A.', 'status' => 422];
        }
        if (! $chunk->isValid()) {
            return ['error' => 'Un tramo de la grabación no llegó completo. Se sigue grabando.', 'status' => 422];
        }
        if ($chunk->getSize() > self::CHUNK_MB * 1024 * 1024) {
            return ['error' => 'Un tramo de la grabación es demasiado grande.', 'status' => 422];
        }

        return self::exclusive($user, function () use ($user, $id, $index, $chunk, $extension) {
            $recording = self::owned($user, $id);
            if (! $recording || $recording->status !== self::RECORDING) {
                return ['error' => 'Esta grabación ya no está abierta.', 'status' => 409];
            }
            if ($index < $recording->parts) {
                return ['recording' => $recording, 'code' => 'have'];
            }
            if ($index !== $recording->parts) {
                return ['error' => 'Falta un tramo anterior de la grabación.', 'status' => 409, 'code' => 'gap'];
            }
            $next = $recording->bytes + (int) $chunk->getSize();
            if ($next > self::MAX_MB * 1024 * 1024) {
                self::seal($recording, $recording->duration ?? 0);

                return [
                    'error' => 'La grabación llegó al máximo de '.self::MAX_MB.' MB. Guarda lo que ya se grabó.',
                    'status' => 413,
                    'code' => 'full',
                    'recording' => $recording->refresh(),
                ];
            }
            if ($recording->parts === 0 && ! self::header($chunk, $extension)) {
                return ['error' => 'El audio de la grabación no es válido.', 'status' => 422];
            }
            if ($recording->parts === 0) {
                $recording->extension = $extension;
                $recording->mime = $extension === 'm4a' ? 'audio/mp4' : 'audio/webm';
            }
            Storage::disk('local')->put(self::partKey($recording, $index), $chunk->get());
            $recording->bytes = $next;
            $recording->parts++;
            $recording->save();

            return ['recording' => $recording];
        });
    }

    /** Stops accepting audio. A recording too short to be a program is discarded. */
    public static function close(User $user, string $id, float $duration): ?RadioRecording
    {
        return self::exclusive($user, function () use ($user, $id, $duration) {
            $recording = self::owned($user, $id);
            if (! $recording || ! in_array($recording->status, self::OPEN, true)) {
                return $recording;
            }
            if ($recording->status === self::READY) {
                return $recording;
            }
            self::seal($recording, $duration);

            return $recording->refresh();
        });
    }

    /**
     * Keeps the audio as Programa grabado. With permission, also stores the episode
     * (image, description and whether the page shows it).
     *
     * @return array{message: string}|array{error: string, status: int}
     */
    public static function keep(User $user, string $id, array $input, mixed $cover, bool $publish): array
    {
        $recording = self::exclusive($user, function () use ($user, $id) {
            self::recover($user);
            $recording = self::owned($user, $id);
            if (! $recording || $recording->status !== self::READY || $recording->bytes < 1 || ! $recording->path) {
                return null;
            }
            $recording->update(['status' => self::SAVING]);

            return $recording->refresh();
        });
        if (! $recording instanceof RadioRecording) {
            return ['error' => 'Esta grabación ya no está disponible para guardarse.', 'status' => 409];
        }
        $seconds = (float) $recording->duration;
        if ($seconds < 1 || $seconds > Station::MAX_BLOCK) {
            $recording->update(['status' => self::READY]);

            return ['error' => 'La grabación es demasiado corta para guardarla como programa.', 'status' => 422];
        }

        $canEpisode = Permissions::has($user, 'radio.episodes');
        $episode = null;
        if ($canEpisode && ($publish || $cover instanceof UploadedFile || trim((string) ($input['description'] ?? '')) !== '')) {
            try {
                $episode = app(SaveEpisode::class)->validate([
                    'title' => $input['title'] ?? '',
                    'program' => $input['program'] ?? null,
                    'description' => $input['description'] ?? null,
                    'aired_on' => $recording->started_at->timezone(Station::TZ)->toDateString(),
                ], $cover);
            } catch (ValidationException $exception) {
                $recording->update(['status' => self::READY]);

                return ['error' => $exception->validator->errors()->first() ?: 'Revisa los datos del episodio.', 'status' => 422];
            }
        }

        $title = trim((string) ($input['title'] ?? ''));
        if (mb_strlen($title) < 3 || mb_strlen($title) > 160) {
            $recording->update(['status' => self::READY]);

            return ['error' => 'Ponle un título de al menos 3 caracteres.', 'status' => 422];
        }
        $program = trim((string) ($input['program'] ?? ''));
        $program = $program === '' ? null : mb_substr($program, 0, 120);

        $stored = self::storeAudio($recording);
        if ($stored === null) {
            $recording->update(['status' => self::READY]);

            return ['error' => 'No se pudo guardar el audio. Inténtalo de nuevo; la grabación sigue aquí.', 'status' => 500];
        }

        try {
            DB::transaction(function () use ($recording, $title, $program, $seconds, $stored, $episode, $cover, $publish, $canEpisode) {
                $track = RadioTrack::query()->create([
                    'kind' => 'programa',
                    'title' => $title,
                    'artist' => $program,
                    'file_path' => $stored,
                    'duration' => round($seconds, 2),
                    'rotation' => false,
                    'duck' => in_array('programa', RadioTrack::DUCK_BY_DEFAULT, true),
                    'active' => true,
                ]);
                if ($canEpisode && $episode) {
                    app(SaveEpisode::class)->handle($episode, $track, $publish, $cover instanceof UploadedFile ? $cover : null);
                }
                $recording->update([
                    'status' => self::SAVED,
                    'radio_track_id' => $track->id,
                ]);
            });
        } catch (\Throwable $error) {
            MediaLibrary::deletePublic($stored);
            $recording->update(['status' => self::READY]);
            Log::warning('No se pudo registrar la grabación de la radio: '.$error->getMessage());

            return ['error' => 'No se pudo registrar el audio. Inténtalo de nuevo; la grabación sigue aquí.', 'status' => 500];
        }

        self::eraseFile($recording);
        Station::flush();

        return ['message' => self::keptMessage($canEpisode, $episode !== null, $publish)];
    }

    public static function drop(User $user, string $id): bool
    {
        return self::exclusive($user, function () use ($user, $id) {
            $recording = self::owned($user, $id);
            if (! $recording || ! in_array($recording->status, self::OPEN, true)) {
                return false;
            }
            self::eraseFile($recording);
            $recording->update(['status' => self::DISCARDED]);

            return true;
        });
    }

    /** The operator's unfinished recording, if they still have to save or discard it. */
    public static function pending(User $user): ?array
    {
        self::recover($user);
        $recording = self::unfinished($user);
        if (! $recording || $recording->bytes < 1) {
            return null;
        }

        return [
            ...$recording->brief(),
            'stale' => $recording->status === self::RECORDING && $recording->updated_at->lt(now()->subSeconds(25)),
        ];
    }

    /** Discards recordings left open or unsaved for two days, and deletes their files. */
    public static function purge(): int
    {
        $stale = RadioRecording::query()
            ->whereIn('status', self::OPEN)
            ->where('updated_at', '<', now()->subDays(self::KEEP_DAYS))
            ->get();
        foreach ($stale as $recording) {
            self::eraseFile($recording);
            $recording->update(['status' => self::DISCARDED]);
        }

        return $stale->count();
    }

    /** A save that died mid-copy becomes editable again. One that is still running is left alone. */
    private static function recover(User $user): void
    {
        RadioRecording::query()
            ->where('user_id', $user->id)
            ->where('status', self::SAVING)
            ->where('updated_at', '<', now()->subMinutes(25))
            ->update(['status' => self::READY]);
    }

    private static function unfinished(User $user): ?RadioRecording
    {
        return RadioRecording::query()
            ->where('user_id', $user->id)
            ->whereIn('status', self::OPEN)
            ->orderByDesc('created_at')
            ->first();
    }

    private static function owned(User $user, string $id): ?RadioRecording
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return RadioRecording::query()->whereKey($id)->where('user_id', $user->id)->first();
    }

    /** One operator saves or appends a single recording at a time. */
    private static function exclusive(User $user, callable $callback): mixed
    {
        return Cache::lock('radio.capture.'.$user->id, 20)->block(8, $callback);
    }

    /** Marks the recording ready, or discards it when there is nothing worth keeping. */
    private static function seal(RadioRecording $recording, float $duration): void
    {
        $seconds = self::duration($recording, $duration);
        if ($recording->bytes < 8000 || $seconds < 1) {
            self::eraseFile($recording);
            $recording->update(['status' => self::DISCARDED, 'finished_at' => now(), 'duration' => round($seconds, 2)]);

            return;
        }
        $recording->update([
            'status' => self::READY,
            'finished_at' => now(),
            'duration' => round(min(Station::MAX_BLOCK, $seconds), 2),
        ]);
    }

    /** Prefers the console clock, and falls back to the file size when that clock is not believable. */
    private static function duration(RadioRecording $recording, float $given): float
    {
        $given = max(0, min(Station::MAX_BLOCK, $given));
        $estimate = $recording->bytes > 0 ? ($recording->bytes * 8) / 64000 : 0;
        if ($estimate > 1 && ($given < $estimate * 0.4 || $given > $estimate * 3)) {
            return $estimate;
        }

        return $given;
    }

    private static function header(UploadedFile $chunk, string $extension): bool
    {
        $handle = fopen($chunk->getRealPath(), 'rb');
        if ($handle === false) {
            return false;
        }
        $bytes = fread($handle, 16) ?: '';
        fclose($handle);
        if ($extension === 'webm') {
            return str_starts_with($bytes, "\x1A\x45\xDF\xA3");
        }

        return strlen($bytes) >= 8 && substr($bytes, 4, 4) === 'ftyp';
    }

    private static function partKey(RadioRecording $recording, int $index): string
    {
        return 'radio-recordings/'.$recording->id.'/'.str_pad((string) $index, 5, '0', STR_PAD_LEFT).'.part';
    }

    /** Joins the pieces in order. A retried piece overwrites its own file, so it is never doubled. */
    private static function combine(RadioRecording $recording): ?string
    {
        $target = Storage::disk('local')->path('radio-recordings/'.$recording->id.'.'.$recording->extension);
        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }
        $out = fopen($target, 'wb');
        if ($out === false) {
            return null;
        }
        try {
            for ($index = 0; $index < $recording->parts; $index++) {
                $in = Storage::disk('local')->readStream(self::partKey($recording, $index));
                if (! is_resource($in)) {
                    return null;
                }
                stream_copy_to_stream($in, $out);
                fclose($in);
            }
        } finally {
            fclose($out);
        }

        return is_file($target) && filesize($target) > 0 ? $target : null;
    }

    /** Puts the audio where the library can play it. WebM is converted to M4A when ffmpeg is available. */
    private static function storeAudio(RadioRecording $recording): ?string
    {
        $source = self::combine($recording);
        if ($source === null) {
            return null;
        }
        [$file, $extension, $mime, $temporary] = self::playable($source, $recording->extension);
        $key = 'radio/programa/'.now()->format('Ymd-His').'-'.Str::lower(Str::random(10)).'.'.$extension;
        $stream = fopen($file, 'rb');
        if ($stream === false) {
            if ($temporary) {
                @unlink($file);
            }

            return null;
        }
        try {
            $stored = MediaLibrary::publicDisk()->writeStream($key, $stream, [
                'visibility' => 'public',
                'ContentType' => $mime,
                'CacheControl' => 'public, max-age=31536000, immutable',
            ]);
        } catch (\Throwable $error) {
            $stored = false;
            Log::warning('No se pudo publicar el audio de la radio: '.$error->getMessage());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
            if ($temporary) {
                @unlink($file);
            }
        }

        return $stored === false ? null : MediaLibrary::PUBLIC_PREFIX.$key;
    }

    /** @return array{0: string, 1: string, 2: string, 3: bool} path, extension, mime, whether the path is a temp file */
    private static function playable(string $source, string $extension): array
    {
        if ($extension !== 'webm') {
            return [$source, 'm4a', 'audio/mp4', false];
        }
        $target = $source.'.m4a';
        set_time_limit(0);
        $result = Process::timeout(2700)->run([
            config('stream.ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y',
            '-i', $source, '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', $target,
        ]);
        if ($result->successful() && is_file($target) && filesize($target) > 0) {
            return [$target, 'm4a', 'audio/mp4', true];
        }
        if (is_file($target)) {
            @unlink($target);
        }
        if (! $result->successful()) {
            Log::warning('La grabación de la radio se guardó en WebM porque no se pudo convertir a M4A: '.Str::limit($result->errorOutput(), 300));
        }

        return [$source, 'webm', 'audio/webm', false];
    }

    private static function eraseFile(RadioRecording $recording): void
    {
        Storage::disk('local')->deleteDirectory('radio-recordings/'.$recording->id);
        if ($recording->extension) {
            Storage::disk('local')->delete('radio-recordings/'.$recording->id.'.'.$recording->extension);
            Storage::disk('local')->delete('radio-recordings/'.$recording->id.'.'.$recording->extension.'.m4a');
        }
    }

    private static function keptMessage(bool $canEpisode, bool $episode, bool $publish): string
    {
        if (! $canEpisode) {
            return 'Audio guardado en la biblioteca como Programa grabado. Para mostrarlo en la página hace falta el permiso de Episodios.';
        }
        if ($episode && $publish) {
            return 'Guardado como Programa grabado y publicado como episodio en la página de la radio.';
        }
        if ($episode) {
            return 'Guardado como Programa grabado. El episodio queda oculto: publícalo en Episodios cuando quieras que se vea.';
        }

        return 'Guardado como Programa grabado en la biblioteca. No aparece en la página hasta que lo publiques en Episodios.';
    }
}
