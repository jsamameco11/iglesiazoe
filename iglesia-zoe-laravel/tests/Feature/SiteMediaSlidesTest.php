<?php

namespace Tests\Feature;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Enums\Role;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SiteMediaSlidesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private Filesystem $disk;

    protected function setUp(): void
    {
        parent::setUp();
        $this->disk = Storage::fake(config('filesystems.media'));
    }

    public function test_an_original_photo_becomes_the_main_photo_of_a_carousel_that_can_be_ordered_framed_and_promoted(): void
    {
        $admin = $this->superadmin();
        $original = ['id' => 'visit', 'base_src' => '/images/familia1.jpg', 'base_alt' => 'Familia de la iglesia'];

        foreach (['culto.jpg', 'celula.jpg'] as $name) {
            $this->actingAs($admin)->postJson(self::ADMIN.'/admin/medios/carrusel', [...$original, 'intent' => 'add', 'file' => UploadedFile::fake()->image($name, 1200, 900)])
                ->assertOk()
                ->assertJsonPath('ok', true);
        }

        $visit = $this->asset('visit');
        $this->assertSame('/images/familia1.jpg', $visit['src']);
        $this->assertSame('Familia de la iglesia', $visit['alt']);
        $this->assertCount(2, $visit['slides']);
        [$first, $second] = array_column($visit['slides'], 'src');
        $this->disk->assertExists(MediaLibrary::keyOf($first));
        $this->disk->assertExists(MediaLibrary::keyOf($second));

        $this->slides($admin, ['intent' => 'move', 'index' => 1, 'direction' => 'left']);
        $this->assertSame([$second, $first], array_column($this->asset('visit')['slides'], 'src'));

        $this->slides($admin, ['intent' => 'frame', 'index' => 0, 'alt' => 'Culto del domingo', 'posX' => 150, 'posY' => 30, 'zoom' => 400]);
        $this->assertSame(['src' => $second, 'alt' => 'Culto del domingo', 'posX' => 100, 'posY' => 30, 'zoom' => 220], $this->asset('visit')['slides'][0]);

        $this->slides($admin, ['intent' => 'promote', 'index' => 1]);
        $visit = $this->asset('visit');
        $this->assertSame($first, $visit['src']);
        $this->assertSame([$second, '/images/familia1.jpg'], array_column($visit['slides'], 'src'));

        $this->slides($admin, ['intent' => 'remove', 'index' => 1]);
        $this->assertSame([$second], array_column($this->asset('visit')['slides'], 'src'));

        $this->slides($admin, ['intent' => 'remove', 'index' => 3])
            ->assertJsonPath('error', 'Esa foto ya no está en el carrusel. Recarga la página.');
    }

    public function test_publishing_a_new_main_photo_keeps_the_carousel_and_restoring_deletes_its_files(): void
    {
        $admin = $this->superadmin();
        $this->publish($admin, 'serve-cover', UploadedFile::fake()->image('portada.jpg', 1600, 900));
        $this->slides($admin, ['id' => 'serve-cover', 'intent' => 'add', 'file' => UploadedFile::fake()->image('equipo.jpg', 1200, 900)], 'serve-cover');
        $slide = $this->asset('serve-cover')['slides'][0]['src'];

        $this->publish($admin, 'serve-cover', UploadedFile::fake()->image('nueva.jpg', 1600, 900));
        $this->assertSame([$slide], array_column($this->asset('serve-cover')['slides'], 'src'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/medios', ['id' => 'serve-cover', 'intent' => 'restore'])->assertOk();

        $this->assertNull($this->asset('serve-cover'));
        $this->disk->assertMissing(MediaLibrary::keyOf($slide));
    }

    public function test_the_carousel_only_takes_photos_on_single_photo_slots(): void
    {
        $admin = $this->superadmin();
        $photo = fn () => UploadedFile::fake()->image('foto.jpg', 800, 600);

        $this->slides($admin, ['id' => 'about-1', 'intent' => 'add', 'file' => $photo()], 'about-1')
            ->assertJsonPath('error', 'Esta sección no admite varias fotos.');
        $this->slides($admin, ['id' => 'visit', 'base_src' => 'https://example.com/foto.jpg', 'intent' => 'add', 'file' => $photo()], 'visit')
            ->assertJsonPath('error', 'Primero publica la foto principal de esta sección.');
        $this->slides($admin, ['id' => 'visit', 'base_src' => '/images/familia1.jpg', 'intent' => 'add', 'file' => UploadedFile::fake()->create('notas.pdf', 20, 'application/pdf')], 'visit')
            ->assertJsonPath('error', 'La foto debe ser JPG, PNG, WebP, GIF o AVIF.');

        $this->publish($admin, 'hero', UploadedFile::fake()->create('portada.mp4', 200, 'video/mp4'), 'video');
        $this->slides($admin, ['id' => 'hero', 'intent' => 'add', 'file' => $photo()], 'hero')
            ->assertJsonPath('error', 'El carrusel es solo para fotos: cambia la foto principal a una imagen y publícala.');

        $this->assertNull($this->asset('visit'));
        $this->assertArrayNotHasKey('slides', $this->asset('hero'));
    }

    /** @param  array<string, mixed>  $payload */
    private function slides(User $admin, array $payload, string $id = 'visit'): TestResponse
    {
        return $this->actingAs($admin)->postJson(self::ADMIN.'/admin/medios/carrusel', ['id' => $id, ...$payload])->assertOk();
    }

    private function publish(User $admin, string $id, UploadedFile $file, string $kind = 'image'): void
    {
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/medios', ['id' => $id, 'intent' => 'save', 'kind' => $kind, 'file' => $file, 'ratio' => '16/10', 'fit' => 'fill'])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    /** @return array<string, mixed>|null */
    private function asset(string $id): ?array
    {
        return SiteSetting::query()->where('key', 'media')->first()?->value['assets'][$id] ?? null;
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
