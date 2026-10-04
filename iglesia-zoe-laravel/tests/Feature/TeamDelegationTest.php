<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Every administrator builds his own team, handing out at most the functions he holds. */
class TeamDelegationTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_an_administrator_creates_an_account_with_only_the_functions_he_holds(): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage', 'media.manage', 'live.manage'])->create();

        $this->actingAs($director)
            ->postJson(self::ADMIN.'/admin/equipo', [
                'name' => 'Ana Ruiz',
                'username' => 'ana.ruiz',
                'password' => 'secreto1',
                'types' => ['director', 'visuales'],
                'permissions' => ['events.manage', 'design.manage', 'live.manage', 'expenses.manage'],
                'area' => 'Multimedia',
            ])
            ->assertOk();

        $created = User::query()->where('username', 'ana.ruiz')->firstOrFail();
        $this->assertSame(['director'], $created->admin_types);
        $this->assertSame(['events.manage'], $created->permissions);
        $this->assertSame($director->id, $created->created_by);
        $this->actingAs($created)->get(self::ADMIN.'/admin/eventos')->assertOk();
        $this->actingAs($created)->get(self::ADMIN.'/admin/diseno')->assertRedirect();
    }

    public function test_an_administrator_sees_only_his_team_and_what_he_may_hand_out(): void
    {
        $super = User::factory()->superadmin()->create();
        $director = User::factory()->administrator(['director'], ['events.manage', 'live.manage'], $super)->create();
        $child = User::factory()->administrator(['director'], ['events.manage'], $director)->create();
        $grandchild = User::factory()->administrator(['director'], [], $child)->create();
        User::factory()->administrator(['visuales'], ['design.manage'], $super)->create();

        $this->actingAs($director)->get(self::ADMIN.'/admin/equipo')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Equipo')
                ->where('accounts', fn ($accounts) => collect($accounts)->pluck('id')->sort()->values()->all() === collect([$child->id, $grandchild->id])->map(fn ($id) => (string) $id)->sort()->values()->all())
                ->where('scope.superadmin', false)
                ->where('scope.grantable', ['events.manage'])
                ->where('scope.types', ['director'])
                ->where('networks', []));
    }

    #[DataProvider('outsiders')]
    public function test_an_administrator_cannot_touch_an_account_outside_his_team(string $endpoint, array $payload): void
    {
        $super = User::factory()->superadmin()->create();
        $director = User::factory()->administrator(['director'], ['events.manage'], $super)->create();
        $other = User::factory()->administrator(['visuales'], ['design.manage'], $super)->create();

        foreach ([$other, $super] as $target) {
            $this->actingAs($director)
                ->postJson(self::ADMIN.$endpoint, ['id' => $target->id, ...$payload])
                ->assertNotFound()
                ->assertJson(['error' => 'Esa cuenta no está en tu equipo.']);
        }

        $this->assertSame(['design.manage'], $other->fresh()->permissions);
        $this->assertNotNull($other->fresh());
    }

    public static function outsiders(): array
    {
        return [
            'editar accesos' => ['/admin/equipo/actualizar', ['name' => 'Otro', 'types' => ['director'], 'permissions' => ['events.manage'], 'active' => true]],
            'cambiar clave' => ['/admin/equipo/clave', ['password' => 'nuevaclave']],
            'eliminar' => ['/admin/equipo/eliminar', []],
        ];
    }

    public function test_editing_keeps_the_functions_the_superadmin_gave_that_the_editor_does_not_hold(): void
    {
        $super = User::factory()->superadmin()->create();
        $director = User::factory()->administrator(['director'], ['events.manage', 'media.manage'], $super)->create();
        $child = User::factory()->administrator(['director', 'visuales'], ['events.manage', 'design.manage'], $director)->create();

        $this->actingAs($director)
            ->postJson(self::ADMIN.'/admin/equipo/actualizar', ['id' => $child->id, 'name' => $child->name, 'types' => ['director'], 'permissions' => ['media.manage', 'expenses.manage'], 'active' => true])
            ->assertOk();

        $child->refresh();
        $this->assertEqualsCanonicalizing(['director', 'visuales'], $child->admin_types);
        $this->assertEqualsCanonicalizing(['design.manage', 'media.manage'], $child->permissions);
    }

    public function test_taking_a_function_from_an_administrator_takes_it_from_everyone_he_created(): void
    {
        $super = User::factory()->superadmin()->create();
        $director = User::factory()->administrator(['director'], ['events.manage', 'media.manage'], $super)->create();
        $child = User::factory()->administrator(['director'], ['events.manage', 'media.manage'], $director)->create();
        $grandchild = User::factory()->administrator(['director'], ['events.manage'], $child)->create();

        $this->actingAs($super)
            ->postJson(self::ADMIN.'/admin/equipo/actualizar', ['id' => $director->id, 'name' => $director->name, 'types' => ['director'], 'permissions' => ['media.manage'], 'active' => true])
            ->assertOk();

        $this->assertSame(['media.manage'], $child->fresh()->permissions);
        $this->assertSame([], $grandchild->fresh()->permissions);
    }

    public function test_deleting_an_account_hands_the_accounts_it_created_to_whoever_deleted_it(): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage'])->create();
        $child = User::factory()->administrator(['director'], ['events.manage'], $director)->create();
        $grandchild = User::factory()->administrator(['director'], [], $child)->create();

        $this->actingAs($director)->postJson(self::ADMIN.'/admin/equipo/eliminar', ['id' => $child->id])->assertOk();

        $this->assertNull($child->fresh());
        $this->assertSame($director->id, $grandchild->fresh()->created_by);
    }

    public function test_a_servidor_de_red_does_not_open_equipo_y_accesos(): void
    {
        $red = User::factory()->administrator(['red'], ['reports.submit', 'servers.create'])->create(['role' => 'red_leader']);

        $this->actingAs($red)->postJson('http://localhost/admin/equipo', ['name' => 'X', 'username' => 'x.cuenta', 'password' => 'secreto1'])
            ->assertForbidden()
            ->assertJson(['error' => 'Solo los administradores pueden hacer esto.']);
        $this->assertDatabaseMissing('users', ['username' => 'x.cuenta']);
    }
}
