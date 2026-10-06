<?php

namespace Tests\Feature;

use App\Domain\Inbox\Inbox;
use App\Domain\Shared\Enums\Role;
use App\Models\PrayerRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PrayerBubbleTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    public function test_a_prayer_can_ask_to_be_prayed_for_on_the_radio(): void
    {
        $this->pray('Ana', onAir: true);
        $this->pray('Luis');

        $super = $this->user('super', Role::Superadmin, [], []);
        $onAir = PrayerRequest::query()->where('first_name', 'Ana')->sole();

        $this->assertTrue($onAir->on_air);
        $this->assertFalse(PrayerRequest::query()->where('first_name', 'Luis')->sole()->on_air);
        $this->assertSame('Petición de oración para orar al aire · RED K', Inbox::headline('oraciones', $onAir)['title']);
        $this->actingAs($super)->get(self::ADMIN.'/admin/formularios/oraciones')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('rows.0.full_name', 'Luis Torres')
                ->where('rows.0.on_air', false)
                ->where('rows.1.on_air', true));
    }

    public function test_each_request_stays_in_the_bubble_until_that_account_removes_it(): void
    {
        $this->pray('Ana', onAir: true);
        $this->pray('Luis');
        $super = $this->user('super', Role::Superadmin, [], []);
        $intercessor = $this->user('intercesion', Role::Admin, ['atmosfera'], ['inbox.prayers']);
        $ana = PrayerRequest::query()->where('first_name', 'Ana')->sole();

        $this->actingAs($super)->get(self::ADMIN.'/admin/formularios/visitas')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('inbox.prayers.total', 2)
                ->where('inbox.prayers.onAir', 1)
                ->where('inbox.prayers.items.0.full_name', 'Luis Torres')
                ->where('inbox.prayers.items.1.request', 'Por la salud de mi mamá, gracias.')
                ->where('inbox.prayers.items.1.on_air', true));

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/formularios/oraciones/quitar', ['ids' => [$ana->id]])
            ->assertOk()
            ->assertJsonPath('removed', 1)
            ->assertJsonPath('prayers.total', 1)
            ->assertJsonPath('prayers.onAir', 0);
        $this->actingAs($super)->postJson(self::ADMIN.'/admin/formularios/oraciones/quitar', ['ids' => [$ana->id]])->assertJsonPath('removed', 0);

        $this->actingAs($intercessor)->getJson(self::ADMIN.'/admin/formularios/novedades')->assertJsonPath('prayers.total', 2);
        $this->actingAs($super)->get(self::ADMIN.'/admin/formularios/oraciones')->assertInertia(fn (AssertableInertia $page) => $page->has('rows', 2));

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/formularios/oraciones/quitar', ['all' => '1'])->assertOk()->assertJsonPath('prayers.total', 0);
        $this->actingAs($super)->getJson(self::ADMIN.'/admin/formularios/novedades')->assertJsonPath('prayers.total', 0);

        $this->pray('Rosa');
        $this->actingAs($super)->getJson(self::ADMIN.'/admin/formularios/novedades')
            ->assertJsonPath('prayers.total', 1)
            ->assertJsonPath('prayers.items.0.full_name', 'Rosa Torres');
    }

    public function test_only_accounts_that_receive_prayers_get_the_bubble(): void
    {
        $this->pray('Ana');
        $visits = $this->user('visitas', Role::Admin, ['atmosfera'], ['inbox.visits']);
        $ana = PrayerRequest::query()->sole();

        $this->actingAs($visits)->getJson(self::ADMIN.'/admin/formularios/novedades')->assertOk()->assertJsonPath('prayers', null);
        $this->actingAs($visits)->postJson(self::ADMIN.'/admin/formularios/oraciones/quitar', ['ids' => [$ana->id]])->assertForbidden();
        $this->actingAs($visits)->get(self::ADMIN.'/admin/formularios/visitas')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('inbox.prayers', null));
    }

    private function pray(string $name, bool $onAir = false): void
    {
        auth()->forgetGuards();
        $this->postJson(self::SITE.'/contacto', array_filter([
            'first_name' => $name,
            'last_name' => 'Torres',
            'age' => 22,
            'marital_status' => 'Soltero(a)',
            'request' => 'Por la salud de mi mamá, gracias.',
            'on_air' => $onAir ? '1' : null,
        ]))->assertOk();
        $this->travel(1)->seconds();
    }

    private function user(string $username, Role $role, array $types, array $permissions): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => $role,
            'admin_types' => $types,
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
