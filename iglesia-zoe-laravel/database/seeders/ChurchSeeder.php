<?php

namespace Database\Seeders;

use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Domain\Shared\Enums\Role;
use App\Models\Cell;
use App\Models\Ministry;
use App\Models\Network;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Database\Seeder;

class ChurchSeeder extends Seeder
{
    public function run(): void
    {
        SiteSetting::query()->updateOrCreate(
            ['key' => 'site'],
            ['value' => config('zoe.settings'), 'updated_at' => now()],
        );
        SiteSetting::query()->updateOrCreate(
            ['key' => 'admin_capabilities'],
            ['value' => config('zoe.admin_capabilities'), 'updated_at' => now()],
        );

        foreach (config('zoe.ministries') as $ministry) {
            Ministry::query()->updateOrCreate(['slug' => $ministry['slug']], $ministry);
        }

        $networks = [];
        foreach (range('A', 'L') as $code) {
            $networks[$code] = Network::query()->updateOrCreate(
                ['code' => $code],
                ['name' => 'Red '.$code],
            );
        }

        $networkA = $networks['A'];
        $cell = Cell::query()->updateOrCreate(
            ['code' => CellCodes::root('A', 1)],
            [
                'network_id' => $networkA->id,
                'number' => 1,
                'leader_name' => 'Servidor de prueba',
                'meeting_day' => 'Miércoles',
                'meeting_time' => '19:00',
                'active' => true,
            ],
        );

        $password = env('SEED_PASSWORD', '');

        User::query()->updateOrCreate(
            ['username' => 'superadmi'],
            [
                'name' => 'Superadministrador',
                'email' => 'superadmi@lideres.iglesiacristianazoe.pe',
                'password' => $password,
                'role' => Role::Superadmin,
            ],
        );
        User::query()->updateOrCreate(
            ['username' => 'admi'],
            [
                'name' => 'Administrador',
                'email' => 'admi@lideres.iglesiacristianazoe.pe',
                'password' => $password,
                'role' => Role::Admin,
                'admin_types' => ['visuales'],
                'permissions' => Permissions::forTypes(['visuales']),
            ],
        );
        $red = User::query()->updateOrCreate(
            ['username' => 'red'],
            [
                'name' => 'Servidor de red',
                'email' => 'red@lideres.iglesiacristianazoe.pe',
                'password' => $password,
                'role' => Role::Admin,
                'admin_types' => ['red'],
                'permissions' => Permissions::forTypes(['red']),
                'network_id' => $networkA->id,
            ],
        );
        $servidor = User::query()->updateOrCreate(
            ['username' => 'servidor'],
            [
                'name' => 'Servidor',
                'dni' => '16736506',
                'email' => '16736506@lideres.iglesiacristianazoe.pe',
                'password' => $password,
                'role' => Role::Admin,
                'admin_types' => ['celula'],
                'permissions' => Permissions::clean(Permissions::SERVER_ACCOUNT),
                'network_id' => $networkA->id,
            ],
        );

        $servidor->cells()->syncWithoutDetaching([$cell->id]);
        $red->cells()->syncWithoutDetaching([$cell->id]);
    }
}
