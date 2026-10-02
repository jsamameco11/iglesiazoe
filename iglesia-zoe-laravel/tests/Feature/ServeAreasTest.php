<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\ServeArea;
use App\Models\ServeRegistration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ServeAreasTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
    }

    public function test_default_areas_reach_the_home_carousel_the_menu_and_their_own_page(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Home')
                ->where('serveAreas.0.slug', 'pastoral')
                ->where('serveAreas.0.tagline', 'Acompañando vidas, edificando fe')
                ->where('serveAreas.2.teams', ['Ujieres', 'Visuales', 'Multimedia']));

        $this->get('/involucrate/atmosfera')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('ServeArea')
                ->where('area.name', 'Atmósfera')
                ->has('serveAreas', count(config('zoe.serve_areas'))));

        ServeArea::query()->where('slug', 'alabanza')->update(['active' => false]);
        LoadPublicSite::flush();

        $this->get('/involucrate/alabanza')->assertNotFound();
        $this->get('/involucrate/no-existe')->assertNotFound();
    }

    public function test_a_person_registers_to_serve_and_lands_in_the_inbox(): void
    {
        $area = ServeArea::query()->where('slug', 'atmosfera')->sole();
        $base = [
            'serve_area_id' => $area->id,
            'first_name' => 'María',
            'last_name' => 'Quispe',
            'age' => '24',
            'marital_status' => 'Soltero(a)',
            'phone' => '987 654 321',
        ];

        $this->postJson('/involucrate', [...$base, 'team' => 'Cocina'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Elige un equipo de la lista.');
        $this->postJson('/involucrate', [...$base, 'serve_area_id' => 'otra'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Elige un área de servicio de la lista.');
        $this->postJson('/involucrate', [...$base, 'phone' => 'llámame'])->assertUnprocessable();

        $this->postJson('/involucrate', [...$base, 'team' => 'Visuales', 'email' => 'Maria@Correo.pe', 'notes' => 'Sé editar video.'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $registration = ServeRegistration::query()->sole();
        $this->assertSame('Atmósfera', $registration->area_name);
        $this->assertSame('Visuales', $registration->team);
        $this->assertSame('María Quispe', $registration->full_name);
        $this->assertSame('maria@correo.pe', $registration->email);

        $leader = $this->user('lider', ['inbox.serve']);
        $this->actingAs($leader)->get(self::ADMIN.'/admin/formularios/servidores')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Formularios')
                ->where('rows.0.area', 'Atmósfera')
                ->where('rows.0.team', 'Visuales')
                ->where('rows.0.network.key', 'K'));

        $this->actingAs($this->user('otro', ['inbox.visits']))->get(self::ADMIN.'/admin/formularios/servidores')->assertRedirect('/admin');
    }

    public function test_admin_creates_edits_reorders_and_deletes_an_area(): void
    {
        $admin = $this->superadmin();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate', ['name' => 'Otra', 'slug' => 'pastoral', 'active' => '1'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Ya existe otra área con la dirección «pastoral».');
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate', ['name' => 'Misiones', 'cta_url' => 'javascript:alert(1)'])
            ->assertUnprocessable();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate', [
            'name' => 'Misiones y Alcance',
            'tagline' => 'Llevando esperanza',
            'teams' => "Hospitales\nPenales, Aires libres\n\nHospitales",
            'active' => '1',
            'image' => UploadedFile::fake()->image('misiones.jpg', 900, 800),
        ])->assertOk()->assertJsonPath('message', 'Área creada.');

        $area = ServeArea::query()->where('slug', 'misiones-y-alcance')->sole();
        $this->assertSame(['Hospitales', 'Penales', 'Aires libres'], $area->teams);
        $this->assertStringStartsWith('/media/involucrate/', $area->image_path);
        $this->assertSame(ServeArea::query()->max('sort_order'), $area->sort_order);

        $this->get('/involucrate/misiones-y-alcance')->assertOk();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate/orden', ['id' => $area->id, 'direction' => 'up'])->assertOk();
        $this->assertSame(count(config('zoe.serve_areas')), $area->fresh()->sort_order);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate', ['id' => $area->id, 'name' => 'Misiones', 'slug' => 'misiones', 'teams' => 'Hospitales'])
            ->assertOk();
        $area->refresh();
        $this->assertSame('misiones', $area->slug);
        $this->assertFalse($area->active);
        $this->get('/involucrate/misiones')->assertNotFound();

        $this->actingAs($admin)->get(self::ADMIN.'/admin/involucrate')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Involucrate')->has('areas', count(config('zoe.serve_areas')) + 1));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/involucrate/eliminar', ['id' => $area->id])->assertOk();
        $this->assertNull($area->fresh());
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

    private function user(string $username, array $permissions): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['visuales'],
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
