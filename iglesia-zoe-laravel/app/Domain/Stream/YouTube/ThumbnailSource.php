<?php

namespace App\Domain\Stream\YouTube;

use App\Domain\Media\Support\MediaLibrary;

/** Bytes of a cover stored on the media disk, ready to send to YouTube as a thumbnail. */
final class ThumbnailSource
{
    private const TYPES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];

    /** YouTube accepts thumbnails up to 2 MB. */
    public const MAX_BYTES = 2 * 1024 * 1024;

    /** @return array{bytes: string, mime: string}|null */
    public static function read(?string $path): ?array
    {
        $key = MediaLibrary::keyOf($path);
        $mime = self::TYPES[strtolower(pathinfo((string) $key, PATHINFO_EXTENSION))] ?? null;
        if (! $key || ! $mime) {
            return null;
        }
        try {
            $bytes = MediaLibrary::publicDisk()->get($key);
        } catch (\Throwable) {
            return null;
        }

        return is_string($bytes) && $bytes !== '' && strlen($bytes) <= self::MAX_BYTES ? ['bytes' => $bytes, 'mime' => $mime] : null;
    }
}
