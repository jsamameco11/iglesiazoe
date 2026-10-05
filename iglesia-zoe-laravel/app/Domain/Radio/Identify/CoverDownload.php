<?php

namespace App\Domain\Radio\Identify;

use App\Domain\Media\Support\MediaLibrary;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Throwable;

/** Brings the cover of a song found on the internet into the media library; only from the music databases' image servers. */
final class CoverDownload
{
    private const HOSTS = '/(^|\.)(mzstatic\.com|dzcdn\.net|coverartarchive\.org|archive\.org)$/i';

    private const MAX_BYTES = 8 * 1024 * 1024;

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public static function allowed(?string $url): bool
    {
        $parts = is_string($url) ? parse_url($url) : false;

        return is_array($parts) && ($parts['scheme'] ?? '') === 'https' && preg_match(self::HOSTS, (string) ($parts['host'] ?? '')) === 1;
    }

    /** Site path of the stored cover («/media/radio/caratulas/…»), or null when it cannot be brought. */
    public static function store(?string $url, string $directory = 'radio/caratulas'): ?string
    {
        if (! self::allowed($url)) {
            return null;
        }
        try {
            $response = Http::withUserAgent((string) config('services.music.agent'))
                ->timeout(12)->connectTimeout(4)
                ->withOptions(['allow_redirects' => ['max' => 3, 'protocols' => ['https']]])
                ->get($url);
        } catch (Throwable) {
            return null;
        }
        $body = $response->successful() ? $response->body() : '';
        if ($body === '' || strlen($body) > self::MAX_BYTES) {
            return null;
        }
        $image = @getimagesizefromstring($body);
        $extension = self::TYPES[$image['mime'] ?? ''] ?? null;
        if (! $extension) {
            return null;
        }
        $file = tempnam(sys_get_temp_dir(), 'cover');
        file_put_contents($file, $body);
        try {
            return MediaLibrary::storePublic(new UploadedFile($file, 'caratula.'.$extension, $image['mime'], null, true), $directory, $extension);
        } catch (Throwable) {
            return null;
        } finally {
            @unlink($file);
        }
    }
}
