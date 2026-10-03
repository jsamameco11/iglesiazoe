<?php

namespace App\Domain\Site\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Stamp of the last change published from the admin. Open tabs compare it with
 * the one their page was rendered with and fetch the page again when it moved,
 * so new fonts, photos and texts show without clearing the browser.
 */
final class SiteVersion
{
    private const KEY = 'zoe.site.version';

    public static function current(): string
    {
        return (string) Cache::rememberForever(self::KEY, fn () => self::stamp());
    }

    public static function bump(): void
    {
        Cache::forever(self::KEY, self::stamp());
    }

    private static function stamp(): string
    {
        return (string) now()->getTimestampMs();
    }
}
