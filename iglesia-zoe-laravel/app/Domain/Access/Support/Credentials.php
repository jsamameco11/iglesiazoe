<?php

namespace App\Domain\Access\Support;

use App\Models\User;

/** Sign-in rules shared by every account: the shape of a username, its uniqueness and the shortest password. */
final class Credentials
{
    public const MIN_PASSWORD = 6;

    public const USERNAME = '/^[A-Za-z0-9._-]{3,40}$/';

    public static function validUsername(string $username): bool
    {
        return (bool) preg_match(self::USERNAME, $username);
    }

    public static function validPassword(string $password): bool
    {
        return mb_strlen($password) >= self::MIN_PASSWORD;
    }

    /** A username blocks its email and, when it is a DNI, the DNI of any other account too. */
    public static function taken(string $username, string $email, ?int $ignoreId = null): bool
    {
        return User::query()
            ->when($ignoreId !== null, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where(fn ($query) => $query
                ->where('username', $username)
                ->orWhere('email', $email)
                ->when(ctype_digit($username), fn ($inner) => $inner->orWhere('dni', $username)))
            ->exists();
    }

    public static function leaderEmail(string $username): string
    {
        return strtolower($username).'@lideres.iglesiacristianazoe.pe';
    }

    public static function studentEmail(string $username): string
    {
        return strtolower($username).'@estudiantes.iglesiacristianazoe.pe';
    }
}
