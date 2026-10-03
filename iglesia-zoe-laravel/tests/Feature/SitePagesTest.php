<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Models\Ministry;
use App\Models\SitePage;
use App\Models\SiteSection;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class SitePagesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_every_public_page_and_section_has_a_row(): void
    {
        $pages = collect(config('zoe.pages'));

        $this->assertEqualsCanonicalizing($pages->pluck('key')->all(), SitePage::query()->pluck('key')->all());
        $this->assertSame($pages->sum(fn (array $page) => count($page['sections'] ?? [])), SiteSection::query()->count());
        $this->assertSame('serve', SitePage::query()->find('baptism')->parent_key);
        $this->assertSame('El latido celular', SiteSection::query()->where('page_key', 'home')->where('key', 'cells')->value('name'));
    }

    public function test_names_already_edited_in_textos_move_into_the_tables(): void
    {
        SiteSetting::query()->create(['key' => 'site', 'value' => [
            'visitCta' => 'Ven este domingo',
            'aboutKicker' => 'Quiénes somos',
            'copy' => ['nav.give' => 'Ofrendas', 'nav.giveNote' => '  ', 'prayer.kicker' => 'Oramos juntos', 'footer.give' => 'Generosidad', 'visit.title' => 'Te esperamos'],
        ], 'updated_at' => now()]);
        $catalog = require database_path('migrations/2026_10_03_051512_create_site_pages_and_sections_tables.php');

        $catalog->down();
        $catalog->up();

        $this->assertSame(['Ofrendas', 'Generosidad'], [SitePage::query()->find('give')->name, SitePage::query()->find('give')->note]);
        $this->assertSame('Ven este domingo', SitePage::query()->find('visit')->name);
        $this->assertSame('Quiénes somos', SitePage::query()->find('about')->kicker);
        $this->assertSame('Oramos juntos', SiteSection::query()->where('page_key', 'contact')->where('key', 'prayer')->value('name'));
        $this->assertSame(['copy' => ['visit.title' => 'Te esperamos']], SiteSetting::query()->find('site')->value);
    }

    public function test_a_renamed_page_and_section_show_on_the_public_site(): void
    {
        $this->actingAs($this->account(['content.manage']))
            ->postJson(self::ADMIN.'/admin/paginas', [
                'key' => 'contact',
                'name' => 'Peticiones',
                'note' => 'Te escuchamos',
                'kicker' => '',
                'sections' => ['prayer' => 'Oramos por ti', 'form' => 'Cuéntanos', 'visit' => 'Ven a vernos'],
            ])
            ->assertOk();

        auth()->forgetGuards();
        $this->get('http://localhost/contacto')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('sitePages', fn ($pages) => collect($pages)->firstWhere('key', 'contact') === [
                'key' => 'contact',
                'parent' => null,
                'path' => '/contacto',
                'name' => 'Peticiones',
                'note' => 'Te escuchamos',
                'kicker' => '',
                'sections' => [
                    ['key' => 'prayer', 'name' => 'Oramos por ti'],
                    ['key' => 'form', 'name' => 'Cuéntanos'],
                    ['key' => 'visit', 'name' => 'Ven a vernos'],
                ],
            ]));
    }

    public function test_the_panel_rejects_blank_names_and_unknown_pages(): void
    {
        $editor = $this->actingAs($this->account(['content.manage']));

        $editor->postJson(self::ADMIN.'/admin/paginas', ['key' => 'give', 'name' => '  ', 'sections' => ['ways' => 'Formas de dar']])
            ->assertStatus(422)
            ->assertJson(['error' => 'Escribe el nombre de la página.']);
        $editor->postJson(self::ADMIN.'/admin/paginas', ['key' => 'give', 'name' => 'Dar', 'sections' => ['ways' => '']])
            ->assertStatus(422);
        $editor->postJson(self::ADMIN.'/admin/paginas', ['key' => 'inventada', 'name' => 'Nueva'])
            ->assertNotFound();

        $this->assertSame('Dar', SitePage::query()->find('give')->name);
        $this->assertSame('Formas de dar', SiteSection::query()->where('page_key', 'give')->value('name'));
    }

    public function test_only_content_editors_can_rename_pages(): void
    {
        $outsider = $this->account(['inbox.visits']);

        $this->actingAs($outsider)->get(self::ADMIN.'/admin/paginas')->assertRedirect('/admin');
        $this->actingAs($outsider)->postJson(self::ADMIN.'/admin/paginas', ['key' => 'give', 'name' => 'Ofrendas', 'sections' => ['ways' => 'X']]);

        $this->assertSame('Dar', SitePage::query()->find('give')->name);
    }

    public function test_the_discipleship_ministry_is_renamed_to_grupos_celulares_unless_the_panel_renamed_it(): void
    {
        $ministry = Ministry::query()->where('slug', 'redes-de-discipulado')->firstOrFail();
        $rename = require database_path('migrations/2026_10_03_051513_rename_redes_de_discipulado_to_grupos_celulares.php');

        $ministry->update(['name' => 'Redes de Discipulado']);
        $rename->up();
        $this->assertSame('Grupos Celulares', $ministry->fresh()->name);

        $ministry->update(['name' => 'Casas de Paz']);
        $rename->up();
        $this->assertSame('Casas de Paz', $ministry->fresh()->name);
    }

    /** @param  list<string>  $permissions */
    private function account(array $permissions): User
    {
        return User::query()->create([
            'name' => 'Editor',
            'username' => 'editor',
            'email' => 'editor@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => [],
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
