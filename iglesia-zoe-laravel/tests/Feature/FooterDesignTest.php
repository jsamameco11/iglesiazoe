<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class FooterDesignTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_publishing_the_footer_keeps_only_valid_choices_and_every_page_receives_them(): void
    {
        $footer = [
            'background' => '#1E2A33',
            'logo' => '/media/medios/diseno/logo.png',
            'logoPlace' => 'beside',
            'logoSize' => 400,
            'brand' => ['color' => '#FFFFFF', 'size' => 1.32, 'align' => 'center'],
            'slogan' => ['size' => 9, 'align' => 'justify'],
            'titles' => ['color' => 'white', 'size' => 1],
            'links' => ['align' => 'right'],
            'inventado' => ['color' => '#000000'],
        ];

        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode(['footer' => $footer])])
            ->assertOk();

        $this->assertSame([
            'background' => '#1e2a33',
            'logo' => '/media/medios/diseno/logo.png',
            'logoPlace' => 'beside',
            'logoSize' => 160,
            'brand' => ['color' => '#ffffff', 'size' => 1.3, 'align' => 'center'],
            'slogan' => ['size' => 1.8],
            'links' => ['align' => 'right'],
        ], LoadPublicSite::design()['footer']);

        auth()->forgetGuards();
        foreach (['/', '/contacto'] as $path) {
            $this->get('http://localhost'.$path)->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
                ->where('design.footer.logoPlace', 'beside')
                ->where('design.footer.brand.align', 'center'));
        }
    }

    public function test_a_logo_from_outside_the_library_or_an_unknown_place_is_dropped(): void
    {
        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode(['footer' => ['logo' => 'https://otro.sitio/logo.png', 'logoPlace' => 'flotando']])])
            ->assertOk();

        $this->assertArrayNotHasKey('footer', LoadPublicSite::design());
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
