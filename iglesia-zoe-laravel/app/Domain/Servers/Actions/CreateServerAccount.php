<?php

namespace App\Domain\Servers\Actions;

use App\Domain\Access\Actions\CreateAccount;
use App\Domain\Servers\ServerLevel;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;

/** Creates the sign-in account of a server with the permissions of its level. */
final class CreateServerAccount
{
    public function __construct(private readonly CreateAccount $create) {}

    public function forNetwork(Network $network, array $data, User $creator): User
    {
        return $this->create->handle([
            'name' => $data['name'] ?? null,
            'username' => $data['username'] ?? null,
            'password' => $data['password'] ?? null,
            'types' => ServerLevel::Red->accountTypes(),
            'permissions' => ServerLevel::Red->accountPermissions(),
            'network_id' => $network->id,
        ], $creator);
    }

    public function forCell(Cell $cell, array $data, User $creator): User
    {
        $level = ServerLevel::ofCell($cell);
        $user = $this->create->handle([
            'name' => ($data['leader_name'] ?? null) ?: $cell->leader_name,
            'username' => $data['username'] ?? null,
            'password' => $data['password'] ?? null,
            'types' => $level->accountTypes(),
            'permissions' => $level->accountPermissions(),
            'network_id' => $cell->network_id,
        ], $creator);
        $user->cells()->syncWithoutDetaching([$cell->id]);

        return $user;
    }
}
