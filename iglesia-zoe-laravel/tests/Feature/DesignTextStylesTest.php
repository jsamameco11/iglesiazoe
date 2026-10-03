<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DesignTextStylesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_the_editor_offers_the_repertoire_in_eight_or_more_categories_of_fifteen_or_more(): void
    {
        $this->actingAs($this->superadmin())->get(self::ADMIN.'/admin/diseno')
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) {
                $categories = collect($page->toArray()['props']['fontCategories']);
                $fonts = collect($page->toArray()['props']['fonts']);

                $this->assertGreaterThanOrEqual(8, $categories->count());
                $categories->each(fn (array $category) => $this->assertGreaterThanOrEqual(15, $fonts->where('category', $category['key'])->count(), $category['label']));
                $this->assertSame([], $fonts->pluck('category')->diff($categories->pluck('key'))->values()->all(), 'Every font belongs to a listed category.');
                $this->assertSame($fonts->count(), $fonts->pluck('name')->unique()->count());
            });
    }

    public function test_publishing_keeps_only_valid_text_styles_and_loads_their_fonts(): void
    {
        $texts = [
            'hero:1.2' => ['font' => ['name' => 'Great Vibes'], 'size' => 9, 'align' => 'center', 'box' => 'block', 'weight' => 640, 'italic' => true, 'label' => ' <b>Vida</b>   en abundancia '],
            '~:3.1' => ['font' => 'heading', 'align' => 'justify', 'box' => 'block'],
            'cells:2' => ['font' => 'Comic Sans', 'size' => 1, 'label' => 'Solo etiqueta'],
            'Bad Key:1' => ['size' => 1.2],
            'hero:0.1' => ['size' => 1.2],
        ];

        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode(['pages' => ['Home' => ['texts' => $texts]]])])
            ->assertOk();

        $saved = LoadPublicSite::design()['pages']['Home']['texts'];
        $this->assertSame(['hero:1.2', '~:3.1'], array_keys($saved));
        $this->assertSame([
            'font' => ['name' => 'Great Vibes', 'slug' => 'great-vibes', 'kind' => 'script', 'local' => false],
            'size' => 2.5,
            'align' => 'center',
            'box' => 'block',
            'weight' => 600,
            'italic' => true,
            'label' => 'Vida en abundancia',
        ], $saved['hero:1.2']);
        $this->assertSame(['font' => 'heading'], $saved['~:3.1'], 'Unknown alignments are dropped together with their box.');

        auth()->forgetGuards();
        $this->get('http://localhost/')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('design.fontHref', 'https://fonts.bunny.net/css?family=great-vibes:400,400i,500,600,700&display=swap'));
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
