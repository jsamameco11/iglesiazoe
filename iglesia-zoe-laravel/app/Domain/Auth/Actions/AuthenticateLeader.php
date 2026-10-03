<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Access\Permissions;
use App\Domain\Access\Support\Credentials;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthenticateLeader
{
    /** Checks the credentials without opening a session. */
    public function attempt(string $username, string $password): ?User
    {
        $login = trim($username);
        $email = str_contains($login, '@') ? strtolower($login) : Credentials::leaderEmail($login);

        $user = User::query()
            ->where(function ($query) use ($login, $email) {
                $query->where('username', $login)
                    ->orWhere('dni', $login)
                    ->orWhere('email', $email)
                    ->orWhere('email', $login);
            })
            ->first();

        if (! $user || $user->active === false || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $user;
    }

    public static function home(User $user): string
    {
        return Permissions::isStudent($user) ? '/estudios/mi-ruta' : '/admin';
    }
}
