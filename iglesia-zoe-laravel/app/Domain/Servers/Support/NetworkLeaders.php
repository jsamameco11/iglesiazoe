<?php

namespace App\Domain\Servers\Support;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Models\Network;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/** The Servidores de Red of a network: usually one, never more than MAX active accounts at once. */
final class NetworkLeaders
{
    public const MAX = 2;

    public static function is(User $user): bool
    {
        return in_array('red', Permissions::typesOf($user), true);
    }

    /** @return Collection<int, User> */
    public static function of(array $networkIds): Collection
    {
        return User::query()
            ->whereIn('network_id', $networkIds ?: [CellScope::NONE])
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user) => self::is($user))
            ->values();
    }

    /** A deactivated Servidor de Red frees his place; reactivating him needs a free place again. */
    public static function ensureRoom(string $networkId, ?User $except = null): void
    {
        $active = self::of([$networkId])
            ->filter(fn (User $user) => $user->active !== false && $user->id !== $except?->id)
            ->count();
        if ($active < self::MAX) {
            return;
        }
        $code = Network::query()->whereKey($networkId)->value('code');

        throw ValidationException::withMessages([
            'network_id' => "La Red {$code} ya tiene ".self::MAX.' Servidores de Red activos, el máximo por red. Desactiva a uno para asignar otro.',
        ]);
    }
}
