<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Models\Devotional;
use App\Models\ServiceGallery;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GalleriesAndDevotionalsTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
    }

    public function test_admin_builds_an_album_and_it_reaches_the_public_gallery(): void
    {
        $admin = $this->superadmin();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria', ['kind' => 'otro', 'service_date' => '2026-09-27'])->assertUnprocessable();

        $id = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria', [
            'kind' => 'dominical',
            'service_date' => '2026-09-27',
            'summary' => 'Santa Cena y bautizos.',
            'active' => '1',
        ])->assertOk()->json('id');

        $gallery = ServiceGallery::query()->findOrFail($id);
        $this->assertSame('Culto dominical', $gallery->title);
        $this->assertSame('culto-dominical-27-09-2026', $gallery->slug);

        $this->visitor('/galeria')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Galleries')->has('galleries', 0));
        $this->visitor('/galeria/'.$gallery->slug)->assertNotFound();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria/foto', ['id' => $id, 'photo' => UploadedFile::fake()->create('nota.pdf', 10, 'application/pdf')])
            ->assertUnprocessable();

        $paths = [];
        foreach (['uno.jpg', 'dos.jpg', 'tres.png'] as $index => $name) {
            $response = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria/foto', ['id' => $id, 'photo' => UploadedFile::fake()->image($name, 1200, 800)])
                ->assertOk()
                ->assertJsonPath('count', $index + 1);
            $paths[] = $response->json('path');
        }
        $this->assertStringStartsWith('/media/galeria/2026/', $paths[0]);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria/portada', ['id' => $id, 'path' => $paths[2]])->assertOk();
        $this->assertSame([$paths[2], $paths[0], $paths[1]], $gallery->fresh()->photos);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria/foto/quitar', ['id' => $id, 'path' => $paths[1]])->assertOk();
        $this->assertSame([$paths[2], $paths[0]], $gallery->fresh()->photos);
        Storage::disk(config('filesystems.media'))->assertMissing(substr($paths[1], strlen('/media/')));

        $this->visitor('/galeria')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Galleries')
                ->where('galleries.0.cover', $paths[2])
                ->where('galleries.0.count', 2));
        $this->visitor('/galeria/'.$gallery->slug)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Gallery')->has('gallery.photos', 2));

        $this->actingAs($admin)->get(self::ADMIN.'/admin/galeria')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Galeria')->has('galleries', 1));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria', ['id' => $id, 'kind' => 'dominical', 'service_date' => '2026-09-27'])->assertOk();
        $this->visitor('/galeria/'.$gallery->slug)->assertNotFound();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/galeria/eliminar', ['id' => $id])->assertOk();
        $this->assertNull($gallery->fresh());
        Storage::disk(config('filesystems.media'))->assertMissing(substr($paths[0], strlen('/media/')));
    }

    public function test_gallery_admin_requires_content_permission(): void
    {
        $this->actingAs($this->user('lider', ['inbox.serve']))->get(self::ADMIN.'/admin/galeria')->assertRedirect('/admin');
        $this->actingAs($this->user('otro', ['inbox.visits']))->get(self::ADMIN.'/admin/devocionales')->assertRedirect('/admin');
    }

    public function test_devotionals_publish_on_their_date_and_admin_manages_them(): void
    {
        $admin = $this->superadmin();
        $today = now('America/Lima')->toDateString();
        $body = "Dios no se ha olvidado de ti.\n\nAun en el silencio, Él sigue obrando en tu vida.";

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/devocionales', ['title' => 'Breve', 'publish_on' => $today, 'body' => 'Muy corto.'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'El devocional es muy corto: escribe al menos un párrafo.');

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/devocionales', [
            'title' => 'Cuando Dios guarda silencio',
            'publish_on' => $today,
            'verse_ref' => 'Salmo 46:10',
            'verse_text' => 'Estad quietos, y conoced que yo soy Dios.',
            'body' => $body,
            'author' => 'Pastor Zoe',
            'active' => '1',
            'image' => UploadedFile::fake()->image('silencio.jpg', 1200, 800),
        ])->assertOk()->assertJsonPath('message', 'Devocional publicado.');
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/devocionales', [
            'title' => 'Fe para mañana',
            'publish_on' => now('America/Lima')->addDays(3)->toDateString(),
            'body' => $body,
            'active' => '1',
        ])->assertOk();

        $devotional = Devotional::query()->where('slug', 'cuando-dios-guarda-silencio')->sole();
        $this->assertStringStartsWith('/media/devocionales/', $devotional->image_path);

        $this->visitor('/devocionales')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Devotionals')
                ->has('devotionals', 1)
                ->where('devotionals.0.title', 'Cuando Dios guarda silencio')
                ->where('devotionals.0.verse_ref', 'Salmo 46:10'));
        $this->visitor('/devocionales/cuando-dios-guarda-silencio')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Devotional')->where('devotional.body', $body));
        $this->visitor('/devocionales/fe-para-manana')->assertNotFound();

        $this->actingAs($admin)->get(self::ADMIN.'/admin/devocionales')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Devocionales')->has('devotionals', 2));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/devocionales', [
            'id' => $devotional->id,
            'title' => 'Cuando Dios guarda silencio',
            'publish_on' => $today,
            'body' => $body,
            'remove_image' => '1',
        ])->assertOk();
        $devotional->refresh();
        $this->assertNull($devotional->image_path);
        $this->assertFalse($devotional->active);
        $this->visitor('/devocionales/cuando-dios-guarda-silencio')->assertNotFound();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/devocionales/eliminar', ['id' => $devotional->id])->assertOk();
        $this->assertNull($devotional->fresh());
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
