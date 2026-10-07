<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Design\NormalizeDesign;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DesignEditorTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_the_editor_lists_every_page_with_a_preview_address_and_the_illustrations(): void
    {
        $this->actingAs($this->superadmin())->get(self::ADMIN.'/admin/diseno')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Diseno')
                ->has('pages', count(config('design.pages')))
                ->where('pages.0.key', 'Home')
                ->where('pages.0.url', config('zoe.site_url').'/')
                ->has('art', count(config('design.art')))
                ->where('stored.fonts.heading.name', 'Montserrat')
                ->where('stored.fonts.accent.name', 'Fredoka'));
    }

    public function test_publishing_keeps_only_valid_rules(): void
    {
        $design = [
            'palette' => ['accent' => '#AA3300', 'ink' => 'red'],
            'fonts' => ['heading' => ['name' => 'Young Serif'], 'text' => 'Inter', 'accent' => 'Comic Sans'],
            'sizes' => ['title' => 9],
            'pages' => [
                'Home' => [
                    'background' => '#F7F1E8',
                    'titleFont' => 'accent',
                    'textFont' => 'serif',
                    'sections' => [
                        'essence' => ['background' => '#112233', 'hidden' => true, 'title' => 1.2],
                        'Bad Key!' => ['background' => '#000000'],
                        'cells' => ['titleColor' => 'nope'],
                    ],
                ],
                'Secreta' => ['background' => '#000000'],
            ],
            'art' => [
                'acceso' => ['colors' => ['sky' => '#FFFFFF', 'hacker' => '#000000'], 'speed' => 7, 'hidden' => true],
                'write' => ['still' => true, 'hidden' => true],
                'inventado' => ['still' => true],
            ],
        ];

        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode($design)])
            ->assertOk();

        $saved = LoadPublicSite::design();
        $this->assertSame('#aa3300', $saved['palette']['accent']);
        $this->assertSame(config('design.defaults.palette.ink'), $saved['palette']['ink']);
        $this->assertSame(['name' => 'Young Serif', 'slug' => 'young-serif', 'kind' => 'serif', 'local' => false], $saved['fonts']['heading']);
        $this->assertSame('Fredoka', $saved['fonts']['accent']['name']);
        $this->assertEquals(1.4, $saved['sizes']['title']);
        $this->assertSame(['Home'], array_keys($saved['pages']));
        $this->assertSame('accent', $saved['pages']['Home']['titleFont']);
        $this->assertArrayNotHasKey('textFont', $saved['pages']['Home']);
        $this->assertSame(['essence'], array_keys($saved['pages']['Home']['sections']));
        $this->assertSame(['background' => '#112233', 'title' => 1.2, 'hidden' => true], $saved['pages']['Home']['sections']['essence']);
        $this->assertSame(['hidden' => true, 'speed' => 3.0, 'colors' => ['sky' => '#ffffff']], $saved['art']['acceso']);
        $this->assertSame(['still' => true], $saved['art']['write']);
        $this->assertArrayNotHasKey('inventado', $saved['art']);

        auth()->forgetGuards();
        $this->get('http://localhost/')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('design.pages.Home.background', '#f7f1e8')
            ->where('design.fontHref', 'https://fonts.bunny.net/css?family=young-serif:400,400i,500,600,700&display=swap'));
    }

    public function test_designs_saved_before_the_visual_editor_still_load(): void
    {
        $design = NormalizeDesign::run([
            'fonts' => ['heading' => 'Lora', 'text' => 'Inter'],
            'pages' => ['ministries' => ['heading' => 'Lora', 'titleColor' => '#123456']],
        ]);

        $this->assertSame('Lora', $design['fonts']['heading']['name']);
        $this->assertSame(['titleColor' => '#123456', 'titleFont' => 'heading'], $design['pages']['Ministries']);
        $this->assertSame($design['pages']['Ministries'], $design['pages']['Ministry']);
        $this->assertSame('', NormalizeDesign::fontHref(NormalizeDesign::run([])));
    }

    public function test_restoring_brings_back_the_original_design(): void
    {
        SiteSetting::query()->create(['key' => 'design', 'value' => NormalizeDesign::run(['palette' => ['accent' => '#000000']]), 'updated_at' => now()]);
        $this->assertSame('#000000', LoadPublicSite::design()['palette']['accent']);

        $this->actingAs($this->superadmin())->postJson(self::ADMIN.'/admin/diseno/restaurar')->assertOk();

        $this->assertSame(config('design.defaults.palette.accent'), LoadPublicSite::design()['palette']['accent']);
    }

    public function test_a_signed_in_designer_can_preview_the_panel_login(): void
    {
        $designer = $this->superadmin();

        $this->actingAs($designer)->get(self::ADMIN.'/acceso')->assertRedirect();
        $this->actingAs($designer)->get(self::ADMIN.'/acceso?vista-diseno=1')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('AccesoAdmin'));
    }

    public function test_the_weekly_notice_does_not_cover_the_login_preview(): void
    {
        SiteSetting::query()->create([
            'key' => 'weekly_notice',
            'value' => ['enabled' => true, 'points' => [['title' => 'Envía tu informe', 'text' => '']]],
            'updated_at' => now(),
        ]);

        $this->get('http://localhost/acceso')->assertInertia(fn (AssertableInertia $page) => $page->where('notice.points.0.title', 'Envía tu informe'));
        $this->get('http://localhost/acceso?vista-diseno=1')->assertInertia(fn (AssertableInertia $page) => $page->where('notice', null));
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
