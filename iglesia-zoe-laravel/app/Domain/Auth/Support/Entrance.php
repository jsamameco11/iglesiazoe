<?php

namespace App\Domain\Auth\Support;

use App\Domain\Access\Permissions;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Two doors into the same app: the church site (servers) and the admin site
 * (administrators and the superadmin).
 */
final class Entrance
{
    public static function isAdminHost(Request $request): bool
    {
        return in_array(strtolower($request->getHost()), config('zoe.admin_hosts', []), true);
    }

    public static function fits(User $user, Request $request): bool
    {
        return self::isAdminHost($request)
            ? Permissions::isAdministrator($user)
            : Permissions::isServer($user) || Permissions::isStudent($user);
    }

    /** Login URL of the door this account belongs to. */
    public static function loginUrlFor(User $user): string
    {
        if (Permissions::isStudent($user)) {
            return self::siteUrl('/estudios/acceso');
        }

        return Permissions::isAdministrator($user) && ! Permissions::isServer($user)
            ? self::adminUrl('/acceso')
            : self::siteUrl('/acceso');
    }

    public static function siteUrl(string $path = ''): string
    {
        return config('zoe.site_url').$path;
    }

    public static function adminUrl(string $path = ''): string
    {
        return config('zoe.admin_url').$path;
    }

    public static function adminLabel(): string
    {
        return (string) parse_url(config('zoe.admin_url'), PHP_URL_HOST);
    }

    public static function siteLabel(): string
    {
        return (string) parse_url(config('zoe.site_url'), PHP_URL_HOST);
    }
}
