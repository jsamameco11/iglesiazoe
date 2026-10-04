<?php

namespace App\Domain\Access;

use App\Domain\Inbox\Inbox;
use App\Domain\Shared\Enums\Role;
use App\Models\User;

/**
 * What an administrator may do in Equipo y accesos. The superadmin manages every account; any other
 * administrator manages only the accounts he created (and the ones those created, all the way down)
 * and hands out at most the functions he holds himself.
 */
class Delegation
{
    /** Functions only the superadmin hands out, even to administrators who already hold them. */
    public const SUPERADMIN_ONLY = ['live.manage', 'servers.network'];

    /** Functions this account may give to the accounts it creates or edits. */
    public static function grantable(User $actor): array
    {
        if (Permissions::isSuperadmin($actor)) {
            return Permissions::keys();
        }

        return array_values(array_diff(Permissions::of($actor), self::SUPERADMIN_ONLY));
    }

    /** Account types this account may give: those whose functions it can hand out in full. */
    public static function assignableTypes(User $actor): array
    {
        if (Permissions::isSuperadmin($actor)) {
            return array_keys(Permissions::TYPES);
        }
        $grantable = self::grantable($actor);

        return array_values(array_filter(
            array_keys(Permissions::TYPES),
            fn (string $type) => ! array_diff(Permissions::forTypes([$type], false), $grantable),
        ));
    }

    /** Ids of the accounts this account manages, or null when it manages every account. */
    public static function managedIds(User $actor): ?array
    {
        if (Permissions::isSuperadmin($actor)) {
            return null;
        }
        $found = [];
        $frontier = [$actor->id];
        while ($frontier) {
            $children = User::query()
                ->whereIn('created_by', $frontier)
                ->whereNotIn('id', [$actor->id, ...$found])
                ->whereNotIn('role', [Role::Superadmin->value, Role::Student->value])
                ->pluck('id')
                ->all();
            $found = [...$found, ...$children];
            $frontier = $children;
        }

        return $found;
    }

    public static function manages(User $actor, User $target): bool
    {
        if ($actor->is($target)) {
            return false;
        }
        $ids = self::managedIds($actor);

        return $ids === null || in_array($target->id, $ids, true);
    }

    /** Types to store: the ones the actor may give as asked, plus the ones he may not touch as they were. */
    public static function types(User $actor, array $requested, array $current = []): array
    {
        $assignable = self::assignableTypes($actor);

        return Permissions::cleanTypes([
            ...array_diff($current, $assignable),
            ...array_intersect(Permissions::cleanTypes($requested), $assignable),
        ]);
    }

    /** Functions to store: the ones the actor may give as asked, plus the ones he may not touch as they were. */
    public static function permissions(User $actor, array $types, array $requested, array $current = []): array
    {
        $resolved = Permissions::resolve($types, $requested);
        if (Permissions::isSuperadmin($actor)) {
            return $resolved;
        }
        $grantable = self::grantable($actor);
        $exclusive = count($types) === 1 && (Permissions::TYPES[$types[0]]['exclusive'] ?? false);

        return Permissions::clean([
            ...($exclusive ? [] : array_diff($current, $grantable)),
            ...array_intersect($resolved, $grantable),
        ]);
    }

    /** «Quiero servir» areas: an administrator limited to some areas only hands out those. */
    public static function serveAreas(User $actor, ?array $chosen): ?array
    {
        $own = Inbox::serveAreasOf($actor);
        if ($own === null) {
            return $chosen ?: null;
        }
        $kept = array_values(array_intersect($chosen ?? [], $own));

        return $kept ?: $own;
    }

    /** Takes away, from every account below this one, the functions it just lost. */
    public static function cascade(User $user, array $lost): void
    {
        $lost = Permissions::clean($lost);
        if (! $lost) {
            return;
        }
        foreach (User::query()->whereIn('id', self::managedIds($user) ?? [])->get() as $below) {
            $kept = array_values(array_diff(is_array($below->permissions) ? $below->permissions : [], $lost));
            if ($kept !== $below->permissions) {
                $below->update(['permissions' => $kept]);
            }
        }
    }
}
