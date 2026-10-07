<?php

namespace App\Domain\Stream;

use App\Models\Teaching;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Edited videos sent from the panel in parts, so a file of several gigabytes gets
 * through the server's upload limit and can resume after a dropped connection.
 */
final class VideoUploads
{
    /** Formats YouTube accepts. */
    public const TYPES = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mpg', 'mpeg', 'wmv', 'flv', '3gp'];

    private const MIME = [
        'mp4' => 'video/mp4', 'm4v' => 'video/mp4', 'mov' => 'video/quicktime', 'mkv' => 'video/x-matroska',
        'webm' => 'video/webm', 'avi' => 'video/x-msvideo', 'mpg' => 'video/mpeg', 'mpeg' => 'video/mpeg',
        'wmv' => 'video/x-ms-wmv', 'flv' => 'video/x-flv', '3gp' => 'video/3gpp',
    ];

    private const CACHE = 'zoe.video-upload.';

    public static function chunkBytes(): int
    {
        return (int) config('stream.chunk_mb') * 1024 * 1024;
    }

    public static function maxBytes(): int
    {
        return (int) config('stream.upload_max_gb') * 1024 * 1024 * 1024;
    }

    /** @return array{upload: string, chunk: int, offset: int} */
    public static function begin(string $name, int $size, string $userId): array
    {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (! in_array($extension, self::TYPES, true)) {
            throw new InvalidArgumentException('Elige un video MP4, MOV, MKV, WEBM o AVI.');
        }
        if ($size <= 0 || $size > self::maxBytes()) {
            throw new InvalidArgumentException('El video puede pesar hasta '.config('stream.upload_max_gb').' GB.');
        }
        $free = @disk_free_space(self::folder());
        if (is_float($free) && $free < $size * 2.2) {
            throw new InvalidArgumentException('El servidor no tiene espacio libre suficiente para este video. Libera espacio o sube una versión más liviana.');
        }

        $token = Str::lower(Str::random(32));
        File::put(self::folder().'/'.$token.'.part', '');
        Cache::put(self::CACHE.$token, ['name' => $name, 'size' => $size, 'extension' => $extension, 'user' => $userId], now()->addDay());

        return ['upload' => $token, 'chunk' => self::chunkBytes(), 'offset' => 0];
    }

    /** Adds a part at $offset; returns how many bytes the server has, so the panel continues from there. */
    public static function append(string $token, int $offset, UploadedFile $chunk, string $userId): int
    {
        $meta = self::meta($token, $userId);
        $path = self::folder().'/'.$token.'.part';
        clearstatcache(true, $path);
        $current = is_file($path) ? (int) filesize($path) : 0;
        if ($offset !== $current) {
            return $current;
        }
        if ($current + (int) $chunk->getSize() > $meta['size'] || (int) $chunk->getSize() > self::chunkBytes()) {
            throw new InvalidArgumentException('Esa parte no corresponde al video. Vuelve a elegir el archivo.');
        }

        $target = fopen($path, 'ab');
        $source = fopen($chunk->getRealPath(), 'rb');
        try {
            flock($target, LOCK_EX);
            stream_copy_to_stream($source, $target);
            fflush($target);
            flock($target, LOCK_UN);
        } finally {
            fclose($source);
            fclose($target);
        }
        clearstatcache(true, $path);

        return (int) filesize($path);
    }

    /** The whole file arrived: returns the name it is kept under until it reaches YouTube. */
    public static function complete(string $token, string $userId): string
    {
        $meta = self::meta($token, $userId);
        $path = self::folder().'/'.$token.'.part';
        clearstatcache(true, $path);
        if (! is_file($path) || (int) filesize($path) !== $meta['size']) {
            throw new InvalidArgumentException('El video no terminó de subir. Vuelve a intentarlo.');
        }
        $name = $token.'.'.$meta['extension'];
        File::move($path, self::folder().'/'.$name);
        Cache::forget(self::CACHE.$token);

        return $name;
    }

    /** Full path of a kept upload. */
    public static function path(?string $name): ?string
    {
        if (! is_string($name) || ! preg_match('/^[a-z0-9]{32}\.[a-z0-9]{2,5}$/', $name)) {
            return null;
        }
        $path = self::folder().'/'.$name;

        return is_file($path) ? $path : null;
    }

    public static function mime(string $path): string
    {
        return self::MIME[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    }

    public static function discard(?string $name): void
    {
        $path = self::path($name);
        if ($path) {
            File::delete($path);
        }
    }

    /** Unfinished parts older than a day and kept videos no teaching points to any more. */
    public static function purgeStale(): int
    {
        $kept = Teaching::query()->whereNotNull('upload_path')->pluck('upload_path')->all();
        $removed = 0;
        foreach (File::files(self::folder()) as $file) {
            $name = $file->getFilename();
            $stale = str_ends_with($name, '.part')
                ? $file->getMTime() < time() - 86400
                : ! in_array($name, $kept, true) && $file->getMTime() < time() - 12 * 3600;
            if ($stale) {
                File::delete($file->getPathname());
                $removed++;
            }
        }

        return $removed;
    }

    public static function folder(): string
    {
        $folder = (string) config('stream.uploads');
        File::ensureDirectoryExists($folder);

        return $folder;
    }

    /** @return array{name: string, size: int, extension: string, user: string} */
    private static function meta(string $token, string $userId): array
    {
        $meta = preg_match('/^[a-z0-9]{32}$/', $token) ? Cache::get(self::CACHE.$token) : null;
        if (! is_array($meta) || $meta['user'] !== $userId) {
            throw new InvalidArgumentException('La subida venció. Vuelve a elegir el video.');
        }

        return $meta;
    }
}
