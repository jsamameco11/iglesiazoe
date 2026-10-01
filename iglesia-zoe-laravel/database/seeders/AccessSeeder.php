<?php

namespace Database\Seeders;

use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Domain\Shared\Enums\Role;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class AccessSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('TEST_ACCOUNTS_PASSWORD') ?: throw new RuntimeException('Define TEST_ACCOUNTS_PASSWORD in .env before seeding test accounts.');
        $networkA = Network::query()->where('code', 'A')->first();
        $networkB = Network::query()->where('code', 'B')->first();
        $cellA = $networkA ? Cell::query()->firstOrCreate(
            ['code' => CellCodes::root('A', 1)],
            ['network_id' => $networkA->id, 'number' => 1, 'leader_name' => 'Servidor de prueba', 'active' => true],
        ) : null;

        $accounts = [
            ['super.prueba', 'Superadministrador de prueba', Role::Superadmin, [], null, null],
            ['red.prueba', 'Servidor de Red (prueba)', Role::Admin, ['red'], $networkA, null],
            ['visuales.prueba', 'Visuales · Multimedia (prueba)', Role::Admin, ['visuales'], null, null],
            ['celula.prueba', 'Servidor de Célula (prueba)', Role::Admin, ['celula'], $networkA, $cellA],
            ['atmosfera.prueba', 'Servidor Atmósfera (prueba)', Role::Admin, ['atmosfera'], null, null],
            ['hibrido.prueba', 'Red + Visuales (prueba)', Role::Admin, ['red', 'visuales'], $networkB, null],
        ];

        foreach ($accounts as [$username, $name, $role, $types, $network, $cell]) {
            if (User::query()->where('username', $username)->exists()) {
                continue;
            }
            $user = User::query()->create([
                'name' => $name,
                'username' => $username,
                'email' => $username.'@lideres.iglesiacristianazoe.pe',
                'password' => $password,
                'role' => $role,
                'admin_types' => $types,
                'permissions' => $role === Role::Superadmin ? [] : Permissions::forTypes($types),
                'network_id' => $network?->id,
                'active' => true,
            ]);
            if ($cell) {
                $user->cells()->syncWithoutDetaching([$cell->id]);
            }
        }
    }
}
