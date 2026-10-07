<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Models\Sermon;
use App\Models\User;
use App\Models\VisitPlan;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('geo_countries')->insert(['code' => 'PE', 'name' => 'Perú', 'dial' => '51', 'region_label' => 'Departamento', 'city_label' => 'Provincia', 'district_label' => 'Distrito']);
    }

    public function test_home_renders_the_brand_sections_with_the_latest_sermons_and_the_radio_right_after(): void
    {
        foreach (range(1, 4) as $day) {
            Sermon::query()->create(['title' => "Mensaje $day", 'sermon_date' => "2026-09-0$day", 'published' => true]);
        }

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Home')
                ->where('settings.heroTitle', config('zoe.settings.heroTitle'))
                ->has('ministries', 4)
                ->has('sermons', 3)
                ->where('sermons.0.title', 'Mensaje 4')
                ->missing('radio')
                ->loadDeferredProps(fn (AssertableInertia $reload) => $reload->has('radio.on_air')));
    }

    public function test_visitors_never_receive_the_church_phone_but_the_panel_keeps_it(): void
    {
        foreach (['/', '/visita', '/contacto', '/radio'] as $path) {
            $this->get($path)
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->where('settings.email', config('zoe.settings.email'))
                    ->missing('settings.phone'));
        }

        $superadmin = User::query()->create([
            'name' => 'Super',
            'username' => 'super',
            'email' => 'super@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Superadmin,
            'admin_types' => [],
            'permissions' => [],
            'active' => true,
        ]);
        $this->actingAs($superadmin)->get('http://admin.localhost/admin/contenido')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('settings.phone', config('zoe.settings.phone')));
    }

    public function test_a_visit_without_email_or_place_is_planned_for_the_chosen_service(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-01 12:00', 'America/Lima'));

        $this->postJson('/visita', $this->visit(['service' => config('zoe.settings.wednesday')]))
            ->assertOk()
            ->assertJson(['ok' => true]);

        $visit = VisitPlan::query()->sole();
        $this->assertSame('Ana Torres', $visit->full_name);
        $this->assertSame('+51 987654321', $visit->phone);
        $this->assertNull($visit->email);
        $this->assertNull($visit->country_code);
        $this->assertNull($visit->region);
        $this->assertSame('2026-10-07', $visit->visit_date->toDateString());
    }

    public function test_a_visit_keeps_the_place_when_the_person_shares_it(): void
    {
        $region = DB::table('geo_regions')->insertGetId(['country_code' => 'PE', 'name' => 'Lambayeque']);
        DB::table('geo_cities')->insert(['region_id' => $region, 'name' => 'Chiclayo']);

        $this->postJson('/visita', $this->visit([
            'email' => 'Ana@Correo.com',
            'country_code' => 'PE',
            'region' => 'Lambayeque',
            'city' => 'Chiclayo',
        ]))->assertOk();

        $visit = VisitPlan::query()->sole();
        $this->assertSame('ana@correo.com', $visit->email);
        $this->assertSame(['PE', 'Lambayeque', 'Chiclayo'], [$visit->country_code, $visit->region, $visit->city]);
        $this->assertTrue($visit->visit_date->isSunday());
    }

    public function test_a_visit_needs_the_profile_and_a_real_service(): void
    {
        $this->postJson('/visita', $this->visit(['service' => '']))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Completa el campo servicio al que asistirás.');
        $this->postJson('/visita', $this->visit(['service' => 'Sábado 3:00 a.m.']))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Elige una opción válida en servicio al que asistirás.');
        $this->postJson('/visita', $this->visit(['phone' => '']))
            ->assertStatus(422)
            ->assertJsonPath('error', 'Completa el campo celular.');
        $this->postJson('/visita', $this->visit(['country_code' => 'PE', 'region' => 'Lambayeque']))
            ->assertStatus(422);

        $this->assertSame(0, VisitPlan::query()->count());
    }

    private function visit(array $overrides = []): array
    {
        return [
            'first_name' => 'Ana',
            'last_name' => 'Torres',
            'phone_code' => '51',
            'phone' => '987654321',
            'sex' => 'Femenino',
            'age' => 27,
            'marital_status' => 'Soltero(a)',
            'service' => config('zoe.settings.sunday'),
            ...$overrides,
        ];
    }
}
