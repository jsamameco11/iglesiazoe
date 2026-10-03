<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Permissions;
use App\Domain\Access\Support\Credentials;
use App\Domain\Servers\Support\NetworkLeaders;
use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CreateAccount
{
    public function handle(array $data, ?User $creator = null): User
    {
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        if (! Credentials::validUsername($username)) {
            throw ValidationException::withMessages(['username' => 'El usuario debe tener de 3 a 40 letras, números, punto o guion.']);
        }
        if (! Credentials::validPassword($password)) {
            throw ValidationException::withMessages(['password' => 'La clave debe tener al menos '.Credentials::MIN_PASSWORD.' caracteres.']);
        }
        $email = Credentials::leaderEmail($username);
        if (Credentials::taken($username, $email)) {
            throw ValidationException::withMessages(['username' => 'Ese usuario ya existe.']);
        }

        $types = Permissions::cleanTypes($data['types'] ?? []);
        $networkId = $data['network_id'] ?? null;
        if (in_array('red', $types, true) && $networkId) {
            NetworkLeaders::ensureRoom($networkId);
        }

        return User::query()->create([
            'name' => trim((string) ($data['name'] ?? '')) ?: $username,
            'username' => $username,
            'dni' => ctype_digit($username) ? $username : null,
            'email' => $email,
            'password' => $password,
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => Permissions::resolve($types, $data['permissions'] ?? null),
            'network_id' => $networkId,
            'active' => true,
            'created_by' => $creator?->id,
        ]);
    }
}
