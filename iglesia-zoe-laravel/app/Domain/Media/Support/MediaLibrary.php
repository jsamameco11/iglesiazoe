<?php

namespace App\Domain\Media\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Every uploaded or heavy file of the site lives here.
 *
 * Public files (site photos, videos, the Yape QR) are referenced in the database as
 * "/media/<key>" and are served by MediaController through a signed link.
 * Private files (theme files, report photos, receipts) are stored by key and only
 * handed out as short-lived signed links to signed-in users.
 */
final class MediaLibrary
{
    /** Signed public links stay identical within this window so browsers can cache them. */
    private const WINDOW = 3 * 86400;

    /** Wasabi (S3 Signature V4) accepts at most seven days. */
    private const LIFETIME = 7 * 86400;

    public const PUBLIC_PREFIX = '/media/';

    public static function cloud(): bool
    {
        return config('filesystems.media') === 'wasabi';
    }

    public static function publicDisk(): Filesystem
    {
        return Storage::disk(config('filesystems.media'));
    }

    public static function privateDisk(): Filesystem
    {
        return Storage::disk(config('filesystems.vault'));
    }

    /** Stores a public upload and returns its site path, e.g. /media/medios/site/hero/abc.jpg. */
    public static function storePublic(UploadedFile $file, string $directory, string $extension): string
    {
        $key = self::newKey($directory, $extension);
        self::publicDisk()->putFileAs(dirname($key), $file, basename($key), self::uploadOptions($file, 'public'));

        return self::PUBLIC_PREFIX.$key;
    }

    /** Stores a private upload and returns its key. */
    public static function storePrivate(UploadedFile $file, string $directory, string $extension): string
    {
        $key = self::newKey($directory, $extension);
        self::privateDisk()->putFileAs(dirname($key), $file, basename($key), self::uploadOptions($file, 'private'));

        return $key;
    }

    /**
     * Real type of an upload, read from its content, when it is one of $allowed.
     * Word and PowerPoint files read as zip archives, so for them the file name decides.
     */
    public static function extension(mixed $file, array $allowed): ?string
    {
        if (! $file instanceof UploadedFile || ! $file->isValid()) {
            return null;
        }
        $extension = strtolower((string) $file->guessExtension());
        $named = strtolower($file->getClientOriginalExtension());
        if (in_array($extension, ['', 'zip', 'bin'], true) && in_array($named, ['doc', 'docx', 'ppt', 'pptx'], true)) {
            $extension = $named;
        }

        return in_array($extension, $allowed, true) ? $extension : null;
    }

    /** Key behind a "/media/..." site path, or null when the value points elsewhere. */
    public static function keyOf(?string $path): ?string
    {
        if (! is_string($path) || ! str_starts_with($path, self::PUBLIC_PREFIX)) {
            return null;
        }
        $key = substr($path, strlen(self::PUBLIC_PREFIX));

        return self::validKey($key) ? $key : null;
    }

    public static function validKey(string $key): bool
    {
        return $key !== '' && ! str_contains($key, '..') && preg_match('#^[A-Za-z0-9][A-Za-z0-9/_.\-]*$#', $key) === 1;
    }

    /** Direct link for a public key: signed on Wasabi, plain on the local disk. */
    public static function publicUrl(string $key): string
    {
        $disk = self::publicDisk();
        if (! $disk instanceof AwsS3V3Adapter) {
            return $disk->url($key);
        }
        $start = intdiv(time(), self::WINDOW) * self::WINDOW;
        $client = $disk->getClient();
        $command = $client->getCommand('GetObject', [
            'Bucket' => $disk->getConfig()['bucket'],
            'Key' => $disk->path($key),
        ]);

        return (string) $client->createPresignedRequest($command, $start + self::LIFETIME, ['start_time' => $start])->getUri();
    }

    /** Seconds a browser may reuse the redirect to publicUrl(). */
    public static function publicUrlCacheSeconds(): int
    {
        if (! self::cloud()) {
            return 3600;
        }
        $start = intdiv(time(), self::WINDOW) * self::WINDOW;

        return max(60, min(86400, $start + self::LIFETIME - time() - 3600));
    }

    /** Short-lived link for a private key, or null when there is no file. */
    public static function privateUrl(?string $key, int $minutes = 60, ?string $downloadName = null): ?string
    {
        if (! $key) {
            return null;
        }
        $disk = self::privateDisk();
        if (! $disk->providesTemporaryUrls()) {
            return null;
        }
        $options = $downloadName ? ['ResponseContentDisposition' => 'attachment; filename="'.addslashes($downloadName).'"'] : [];

        return $disk->temporaryUrl($key, now()->addMinutes($minutes), $options);
    }

    public static function deletePublic(?string $path): void
    {
        $key = self::keyOf($path);
        if ($key && ! str_starts_with($key, 'images/') && ! str_starts_with($key, 'videos/')) {
            self::publicDisk()->delete($key);
        }
    }

    public static function deletePrivate(?string $key): void
    {
        if ($key) {
            self::privateDisk()->delete($key);
        }
    }

    private static function newKey(string $directory, string $extension): string
    {
        return trim($directory, '/').'/'.now()->format('Ymd-His').'-'.Str::lower(Str::random(10)).'.'.strtolower($extension);
    }

    private static function uploadOptions(UploadedFile $file, string $visibility): array
    {
        return [
            'visibility' => $visibility,
            'ContentType' => $file->getMimeType() ?: 'application/octet-stream',
            'CacheControl' => $visibility === 'public' ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
        ];
    }
}
