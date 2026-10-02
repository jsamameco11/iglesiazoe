<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Inbox\Inbox;
use App\Domain\Inbox\PushNotifier;
use App\Domain\Shared\Enums\Role;
use App\Models\ServeArea;
use App\Models\ServeRegistration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ServeInboxTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_the_serve_coordinator_type_only_opens_the_quiero_servir_tab(): void
    {
        $this->assertSame(['inbox.serve'], Permissions::forTypes(['voluntarios']));
        $this->assertSame(['inbox.serve'], Permissions::resolve(['voluntarios'], ['content.manage']));

        $coordinator = $this->account('coordina', ['voluntarios'], ['inbox.serve']);
        $this->actingAs($coordinator)->get(self::ADMIN.'/admin/formularios/servidores')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('title', 'Quiero servir')
                ->where('statuses', ServeRegistration::STATUSES)
                ->where('scope', null));
        $this->actingAs($coordinator)->get(self::ADMIN.'/admin/formularios/visitas')->assertRedirect('/admin');
    }

    public function test_a_scoped_account_only_sees_counts_and_is_notified_of_its_areas(): void
    {
        $musica = $this->area('musica');
        $visuales = $this->area('visuales');
        $singer = $this->register($musica, 'Lucía');
        $camera = $this->register($visuales, 'Pedro');

        $leader = $this->account('musica', ['atmosfera'], ['inbox.serve'], [$musica->id]);
        $everyone = $this->account('todos', ['voluntarios'], ['inbox.serve']);
        $outsider = $this->account('visitas', ['visuales'], ['inbox.visits']);

        $this->assertSame(1, Inbox::unread($leader)['servidores']);
        $this->assertSame(2, Inbox::unread($everyone)['servidores']);

        $this->actingAs($leader)->get(self::ADMIN.'/admin/formularios/servidores')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('rows', 1)
                ->where('rows.0.full_name', 'Lucía Quispe')
                ->where('rows.0.status', 'pendiente')
                ->where('scope', ['Música']));

        $this->assertTrue(Inbox::reaches($leader, 'servidores', $singer));
        $this->assertFalse(Inbox::reaches($leader, 'servidores', $camera));
        $this->assertTrue(Inbox::reaches($everyone, 'servidores', $camera));
        $this->assertFalse(Inbox::reaches($outsider, 'servidores', $singer));

        foreach ([$leader, $everyone, $outsider] as $user) {
            $user->pushSubscriptions()->create([
                'endpoint' => "https://push.example/{$user->username}",
                'endpoint_hash' => hash('sha256', "https://push.example/{$user->username}"),
                'public_key' => 'key',
                'auth_token' => 'token',
                'content_encoding' => 'aes128gcm',
            ]);
        }
        $endpoints = fn (ServeRegistration $row) => PushNotifier::recipients('servidores', $row)->pluck('endpoint')->sort()->values()->all();

        $this->assertSame(['https://push.example/musica', 'https://push.example/todos'], $endpoints($singer));
        $this->assertSame(['https://push.example/todos'], $endpoints($camera));
    }

    public function test_follow_up_status_is_saved_and_guarded_by_area(): void
    {
        $musica = $this->area('musica');
        $singer = $this->register($musica, 'Lucía');
        $camera = $this->register($this->area('visuales'), 'Pedro');
        $leader = $this->account('musica', ['atmosfera'], ['inbox.serve'], [$musica->id]);
        $url = self::ADMIN.'/admin/formularios/servidores/estado';

        $this->actingAs($leader)->postJson($url, ['id' => $singer->id, 'status' => 'contactado'])
            ->assertOk()
            ->assertJsonPath('message', 'Lucía quedó como «Contactado».');
        $singer->refresh();
        $this->assertSame('contactado', $singer->status);
        $this->assertSame('Musica', $singer->status_by);
        $this->assertNotNull($singer->status_at);

        $this->actingAs($leader)->postJson($url, ['id' => $singer->id, 'status' => 'archivado'])
            ->assertUnprocessable()
            ->assertJsonStructure(['error']);
        $this->actingAs($leader)->postJson($url, ['id' => $camera->id, 'status' => 'integrado'])
            ->assertForbidden();
        $this->assertSame('pendiente', $camera->fresh()->status);

        $this->actingAs($this->account('visitas', ['visuales'], ['inbox.visits']))
            ->postJson($url, ['id' => $singer->id, 'status' => 'integrado'])
            ->assertForbidden();
        $this->assertSame('contactado', $singer->fresh()->status);
    }

    public function test_equipo_saves_the_areas_only_with_the_quiero_servir_function(): void
    {
        $admin = $this->superadmin();
        $musica = $this->area('musica');
        $visuales = $this->area('visuales');

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/equipo', [
            'name' => 'Líder de Música',
            'username' => 'lider.musica',
            'password' => 'secreto1',
            'types' => ['voluntarios'],
            'serve_areas' => [$musica->id, 'no-existe'],
        ])->assertOk();

        $leader = User::query()->where('username', 'lider.musica')->sole();
        $this->assertSame([(string) $musica->id], $leader->serve_areas);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/equipo/actualizar', [
            'id' => $leader->id,
            'name' => 'Líder de Música',
            'types' => ['voluntarios'],
            'serve_areas' => [$musica->id, $visuales->id],
            'active' => '1',
        ])->assertOk();
        $this->assertEqualsCanonicalizing([(string) $musica->id, (string) $visuales->id], $leader->fresh()->serve_areas);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/equipo/actualizar', [
            'id' => $leader->id,
            'name' => 'Líder de Música',
            'types' => ['visuales'],
            'permissions' => ['inbox.visits'],
            'serve_areas' => [$musica->id],
            'active' => '1',
        ])->assertOk();
        $this->assertNull($leader->fresh()->serve_areas);

        $this->actingAs($admin)->get(self::ADMIN.'/admin/equipo')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('serveAreas', ServeArea::query()->count())
                ->where('accounts.1.serve_areas', []));
    }

    private function area(string $slug): ServeArea
    {
        return ServeArea::query()->where('slug', $slug)->sole();
    }

    private function register(ServeArea $area, string $name): ServeRegistration
    {
        return ServeRegistration::query()->create([
            'serve_area_id' => $area->id,
            'area_name' => $area->name,
            'team' => $area->teams[0] ?? null,
            'first_name' => $name,
            'last_name' => 'Quispe',
            'full_name' => "{$name} Quispe",
            'age' => 24,
            'marital_status' => 'Soltero(a)',
            'phone' => '987654321',
        ])->refresh();
    }

    private function account(string $username, array $types, array $permissions, ?array $areas = null): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => $permissions,
            'serve_areas' => $areas,
            'active' => true,
        ]);
    }

    private function superadmin(): User
    {
        return User::query()->create([
            'name' => 'Super',
            'username' => 'super',
            'email' => 'super@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Superadmin,
            'admin_types' => [],
            'permissions' => [],
            'active' => true,
        ]);
    }
}
