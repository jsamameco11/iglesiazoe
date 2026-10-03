<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Support\SiteVersion;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class SiteVersionTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_pages_carry_the_site_version_and_the_check_is_never_cached(): void
    {
        $version = SiteVersion::current();

        $this->get('http://localhost/')->assertInertia(fn (AssertableInertia $page) => $page->where('siteVersion', $version));
        $response = $this->get('http://localhost/site-version')
            ->assertOk()
            ->assertExactJson(['version' => $version]);

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertEmpty($response->headers->getCookies());
    }

    public function test_publishing_from_the_admin_moves_the_site_version(): void
    {
        $admin = $this->superadmin();
        $before = SiteVersion::current();

        $this->travel(2)->seconds();
        $this->actingAs($admin)->get(self::ADMIN.'/admin/diseno')->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/diseno', ['design' => 'no es json'])->assertStatus(422);
        $this->assertSame($before, SiteVersion::current());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode(['palette' => ['accent' => '#b85a2e']])])->assertOk();
        $published = SiteVersion::current();
        $this->assertGreaterThan((int) $before, (int) $published);

        $this->travel(2)->seconds();
        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => ['brand' => 'Zoe'], 'updated_at' => now()]);
        $this->assertGreaterThan((int) $published, (int) SiteVersion::current());
    }

    public function test_only_changes_to_public_sections_move_the_site_version(): void
    {
        foreach (['eventos', 'equipo', 'radio'] as $section) {
            Route::middleware('web')->post("/admin/$section/prueba", fn () => response()->json(['ok' => true]));
        }
        $admin = $this->superadmin();
        $before = SiteVersion::current();

        $this->travel(2)->seconds();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/equipo/prueba')->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/prueba')->assertOk();
        $this->assertSame($before, SiteVersion::current());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos/prueba')->assertOk();
        $this->assertGreaterThan((int) $before, (int) SiteVersion::current());
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
