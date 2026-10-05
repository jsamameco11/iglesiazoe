<?php

namespace App\Domain\Media\Support;

use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Design\NormalizeDesign;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * The web server's own copy of the media the home page shows.
 *
 * Every public file lives on Wasabi. The ones the home page loads on every visit (the
 * built-in library under images/ and videos/, the home slots of the media editor, the
 * service area cards and the design files) are also kept under public/ at the very
 * path the site links to, so Apache answers them straight from disk. Every other file
 * keeps going through MediaController's signed redirect to Wasabi.
 */
final class HotMedia
{
    /** Home page slots of the media editor; the "ministry:<slug>" covers are matched apart. */
    private const HOME_SLOTS = ['hero', 'home-cells', 'events', 'radio'];

    /** Built-in library folders, linked as /images/* and /videos/*. */
    private const LIBRARY = ['images', 'videos'];

    /** Uploads are copied under /media/, the path the site links them with. */
    private const UPLOADS = 'media';

    /** Larger files stay on Wasabi only. */
    private const MAX_BYTES = 200 * 1024 * 1024;

    /** A copy in progress is written next to its final name and renamed when complete. */
    private const PART = '.part-';

    private const LOCK_SECONDS = 600;

    /** Whether the web server keeps its own copy of a key. */
    public static function isHot(string $key): bool
    {
        return MediaLibrary::cloud() && (self::isLibrary($key) || in_array($key, self::referenced(), true));
    }

    /** Copies a key to the web server unless it is already there; false when it cannot. */
    public static function mirror(string $key): bool
    {
        $path = self::localPath($key);

        return is_file($path) || self::copy($key, $path);
    }

    /**
     * Copies every hot key that is missing or was replaced on Wasabi and deletes the copies nothing links to anymore.
     *
     * @return array{copied: int, removed: int, failed: list<string>}
     */
    public static function sync(): array
    {
        $result = ['copied' => 0, 'removed' => 0, 'failed' => []];
        if (! MediaLibrary::cloud()) {
            return $result;
        }

        $keys = self::keys();
        foreach ($keys as $key) {
            $path = self::localPath($key);
            if (is_file($path) && ! self::isStale($key, $path)) {
                continue;
            }
            if (self::copy($key, $path)) {
                $result['copied']++;
            } else {
                $result['failed'][] = $key;
            }
        }

        $wanted = array_flip(array_map(fn (string $key) => self::localPath($key), $keys));
        foreach (self::copies() as $path) {
            $working = str_contains(basename($path), self::PART) && filemtime($path) > time() - self::LOCK_SECONDS;
            if (! isset($wanted[$path]) && ! $working) {
                File::delete($path);
                $result['removed']++;
            }
        }

        return $result;
    }

    /** Where the web server keeps a key: library files at their own path, uploads under /media/. */
    public static function localPath(string $key): string
    {
        return self::root().'/'.(self::isLibrary($key) ? $key : self::UPLOADS.'/'.$key);
    }

    /**
     * Every key the web server should keep: the whole built-in library plus the uploads the home page links to.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        $disk = MediaLibrary::publicDisk();
        $library = [];
        foreach (self::LIBRARY as $folder) {
            array_push($library, ...$disk->allFiles($folder));
        }

        return array_values(array_unique([...$library, ...self::referenced()]));
    }

    /**
     * Uploaded files the home page links to, read from the cached site data.
     *
     * @return list<string>
     */
    public static function referenced(): array
    {
        $paths = NormalizeDesign::files(LoadPublicSite::design());
        foreach (LoadPublicSite::mediaOverrides() as $slot => $asset) {
            if (! is_array($asset) || ! self::isHomeSlot((string) $slot)) {
                continue;
            }
            $paths[] = $asset['src'] ?? null;
            $paths[] = $asset['poster'] ?? null;
            foreach (is_array($asset['slides'] ?? null) ? $asset['slides'] : [] as $slide) {
                $paths[] = is_array($slide) ? ($slide['src'] ?? null) : null;
            }
        }
        foreach (LoadPublicSite::serveAreas() as $area) {
            $paths[] = $area['image'] ?? null;
        }

        $keys = array_filter(array_map(fn (mixed $path) => MediaLibrary::keyOf(is_string($path) ? $path : null), $paths));

        return array_values(array_unique(array_filter($keys, fn (string $key) => ! self::isLibrary($key))));
    }

    private static function isLibrary(string $key): bool
    {
        return in_array(strstr($key, '/', true), self::LIBRARY, true);
    }

    private static function isHomeSlot(string $slot): bool
    {
        return in_array($slot, self::HOME_SLOTS, true) || (str_starts_with($slot, 'ministry:') && substr_count($slot, ':') === 1);
    }

    private static function root(): string
    {
        return str_replace('\\', '/', rtrim((string) config('filesystems.hot'), '/\\'));
    }

    /**
     * Files currently copied to the web server, partial copies included.
     *
     * @return list<string>
     */
    private static function copies(): array
    {
        $paths = [];
        foreach ([...self::LIBRARY, self::UPLOADS] as $folder) {
            $directory = self::root().'/'.$folder;
            if (! is_dir($directory)) {
                continue;
            }
            foreach (File::allFiles($directory) as $file) {
                $paths[] = $directory.'/'.str_replace('\\', '/', $file->getRelativePathname());
            }
        }

        return $paths;
    }

    /** Copies a key from Wasabi over whatever copy the web server has; false when it cannot. */
    private static function copy(string $key, string $path): bool
    {
        if (! MediaLibrary::cloud() || ! MediaLibrary::validKey($key)) {
            return false;
        }

        return (bool) Cache::lock('zoe.hot.'.sha1($key), self::LOCK_SECONDS)->get(fn () => self::download($key, $path));
    }

    /** Whether the file on Wasabi changed after it was copied; an unreachable Wasabi keeps the copy. */
    private static function isStale(string $key, string $path): bool
    {
        try {
            $disk = MediaLibrary::publicDisk();

            return $disk->size($key) !== filesize($path) || $disk->lastModified($key) > filemtime($path);
        } catch (Throwable) {
            return false;
        }
    }

    /** Streams a key from Wasabi into a partial file and renames it into place when complete. */
    private static function download(string $key, string $path): bool
    {
        $disk = MediaLibrary::publicDisk();
        $part = $path.self::PART.Str::lower(Str::random(8));
        $source = $target = null;
        try {
            if ($disk->size($key) > self::MAX_BYTES) {
                return false;
            }
            File::ensureDirectoryExists(dirname($path));
            $source = $disk->readStream($key);
            $target = fopen($part, 'wb');
            if (! is_resource($source) || ! is_resource($target) || stream_copy_to_stream($source, $target) === false) {
                return false;
            }
            fclose($target);
            $target = null;

            return rename($part, $path);
        } catch (Throwable $error) {
            Log::warning('No se pudo copiar al servidor un archivo de Wasabi.', ['key' => $key, 'error' => $error->getMessage()]);

            return false;
        } finally {
            foreach ([$source, $target] as $stream) {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
            if (is_file($part)) {
                File::delete($part);
            }
        }
    }
}
