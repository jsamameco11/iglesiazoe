<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CreateAccount
{
    public function handle(array $data, ?User $creator = null): User
    {
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        if (! preg_match('/^[A-Za-z0-9._-]{3,40}$/', $username)) {
            throw ValidationException::withMessages(['username' => 'El usuario debe tener de 3 a 40 letras, números, punto o guion.']);
        }
        if (mb_strlen($password) < 6) {
            throw ValidationException::withMessages(['password' => 'La clave debe tener al menos 6 caracteres.']);
        }
        $email = strtolower($username).'@lideres.iglesiacristianazoe.pe';
        $taken = User::query()
            ->where('username', $username)
            ->orWhere('email', $email)
            ->when(ctype_digit($username), fn ($query) => $query->orWhere('dni', $username))
            ->exists();
        if ($taken) {
            throw ValidationException::withMessages(['username' => 'Ese usuario ya existe.']);
        }

        $types = Permissions::cleanTypes($data['types'] ?? []);

        return User::query()->create([
            'name' => trim((string) ($data['name'] ?? '')) ?: $username,
            'username' => $username,
            'dni' => ctype_digit($username) ? $username : null,
            'email' => $email,
            'password' => $password,
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => Permissions::clean($data['permissions'] ?? Permissions::forTypes($types)),
            'network_id' => $data['network_id'] ?? null,
            'active' => true,
            'created_by' => $creator?->id,
        ]);
    }
}
