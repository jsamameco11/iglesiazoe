<?php

namespace App\Domain\Servers\Actions;

use App\Domain\Access\Support\Credentials;
use App\Domain\Servers\Support\NetworkLeaders;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Edits the account of a Servidor de Red: name, username, a new password and whether it can sign in. */
final class UpdateNetworkLeader
{
    public function handle(User $leader, array $data): User
    {
        $username = trim((string) $data['username']);
        if (! Credentials::validUsername($username)) {
            throw ValidationException::withMessages(['username' => 'El usuario debe tener de 3 a 40 letras, números, punto o guion.']);
        }
        $renamed = $username !== $leader->username;
        $email = $renamed ? Credentials::leaderEmail($username) : $leader->email;
        if ($renamed && Credentials::taken($username, $email, $leader->id)) {
            throw ValidationException::withMessages(['username' => 'Ese usuario ya existe.']);
        }
        $password = (string) ($data['password'] ?? '');
        if ($password !== '' && ! Credentials::validPassword($password)) {
            throw ValidationException::withMessages(['password' => 'La clave debe tener al menos '.Credentials::MIN_PASSWORD.' caracteres.']);
        }
        $active = (bool) $data['active'];
        if ($active && $leader->active === false) {
            NetworkLeaders::ensureRoom($leader->network_id, $leader);
        }

        $leader->fill(['name' => trim((string) $data['name']), 'active' => $active]);
        if ($renamed) {
            $leader->fill(['username' => $username, 'dni' => ctype_digit($username) ? $username : null, 'email' => $email]);
        }
        if ($password !== '') {
            $leader->password = $password;
        }
        $leader->save();

        return $leader;
    }
}
