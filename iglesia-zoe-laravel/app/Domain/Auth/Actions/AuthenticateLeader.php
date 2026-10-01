<?php

namespace App\Domain\Auth\Actions;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthenticateLeader
{
    public function attempt(string $username, string $password): ?User
    {
        $login = trim($username);
        $email = str_contains($login, '@') ? strtolower($login) : strtolower($login).'@lideres.iglesiacristianazoe.pe';

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

        Auth::login($user, true);

        return $user;
    }

    public static function home(User $user): string
    {
        return '/admin';
    }
}
