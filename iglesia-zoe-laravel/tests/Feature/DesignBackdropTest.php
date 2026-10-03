<?php

namespace Tests\Feature;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DesignBackdropTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
    }

    public function test_page_and_band_backgrounds_and_typography_keep_only_safe_values(): void
    {
        $this->publish([
            'pages' => [
                'Home' => [
                    'background2' => '#223344',
                    'gradient' => 450,
                    'video' => '/media/medios/diseno/fondo.mp4',
                    'overlay' => 2,
                    'titleWeight' => 650,
                    'titleTracking' => 0.04,
                    'text_size' => 1.1,
                    'sections' => [
                        'essence' => [
                            'image' => '/media/medios/diseno/franja.gif',
                            'imageFit' => 'contain',
                            'imageX' => 140,
                            'overlayColor' => '#ABCDEF',
                            'fixed' => true,
                            'textLeading' => 9,
                            'titleUpper' => true,
                            'text_size' => 1.2,
                        ],
                        'cells' => [
                            'image' => 'https://otro-sitio.com/foto.jpg',
                            'video' => '/media/medios/diseno/no-es-video.jpg',
                            'imageFit' => 'stretch',
                            'titleItalic' => 'yes',
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $home = LoadPublicSite::design()['pages']['Home'];
        $this->assertSame('#223344', $home['background2']);
        $this->assertSame(360, $home['gradient']);
        $this->assertSame('/media/medios/diseno/fondo.mp4', $home['video']);
        $this->assertEquals(0.85, $home['overlay']);
        $this->assertSame(700, $home['titleWeight']);
        $this->assertEquals(0.04, $home['titleTracking']);
        $this->assertEquals(1.1, $home['text_size']);
        $this->assertSame([
            'overlayColor' => '#abcdef',
            'text_size' => 1.2,
            'image' => '/media/medios/diseno/franja.gif',
            'imageFit' => 'contain',
            'imageX' => 100,
            'textLeading' => 2.4,
            'fixed' => true,
            'titleUpper' => true,
        ], $home['sections']['essence']);
        $this->assertArrayNotHasKey('cells', $home['sections']);
    }

    public function test_background_uploads_accept_pictures_gifs_and_videos_only(): void
    {
        $designer = $this->designer();

        $gif = $this->actingAs($designer)->post(self::ADMIN.'/admin/diseno/fondo', ['file' => UploadedFile::fake()->image('fondo.gif')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('kind', 'image')
            ->json('src');
        $this->assertStringStartsWith('/media/medios/diseno/', $gif);
        $this->assertTrue(MediaLibrary::publicDisk()->exists(MediaLibrary::keyOf($gif)));

        $this->actingAs($designer)->post(self::ADMIN.'/admin/diseno/fondo', ['file' => UploadedFile::fake()->create('fondo.mp4', 512, 'video/mp4')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('kind', 'video');

        $this->actingAs($designer)->post(self::ADMIN.'/admin/diseno/fondo', ['file' => UploadedFile::fake()->create('virus.php', 4, 'application/x-php')], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->actingAs($this->account(['media.manage']))->post(self::ADMIN.'/admin/diseno/fondo', ['file' => UploadedFile::fake()->image('fondo.jpg')], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_replaced_and_restored_backgrounds_free_their_files(): void
    {
        $designer = $this->designer();
        $upload = fn (string $name) => $this->actingAs($designer)->post(self::ADMIN.'/admin/diseno/fondo', ['file' => UploadedFile::fake()->image($name)], ['Accept' => 'application/json'])->json('src');
        $first = $upload('uno.jpg');
        $second = $upload('dos.jpg');
        $disk = MediaLibrary::publicDisk();

        $this->publish(['pages' => ['Home' => ['image' => $first]]], $designer)->assertOk();
        $this->publish(['pages' => ['Home' => ['image' => $second]]], $designer)->assertOk();
        $this->assertFalse($disk->exists(MediaLibrary::keyOf($first)));
        $this->assertTrue($disk->exists(MediaLibrary::keyOf($second)));

        $this->actingAs($designer)->postJson(self::ADMIN.'/admin/diseno/restaurar')->assertOk();
        $this->assertFalse($disk->exists(MediaLibrary::keyOf($second)));
    }

    public function test_publishing_sweeps_old_uploads_of_discarded_drafts(): void
    {
        $disk = MediaLibrary::publicDisk();
        $disk->put('medios/diseno/abandonada.jpg', 'x');
        $disk->put('medios/diseno/reciente.jpg', 'x');
        $disk->put('medios/diseno/en-uso.jpg', 'x');
        touch($disk->path('medios/diseno/abandonada.jpg'), now()->subDays(2)->getTimestamp());
        touch($disk->path('medios/diseno/en-uso.jpg'), now()->subDays(2)->getTimestamp());

        $this->publish(['pages' => ['Home' => ['image' => '/media/medios/diseno/en-uso.jpg']]])->assertOk();

        $this->assertFalse($disk->exists('medios/diseno/abandonada.jpg'));
        $this->assertTrue($disk->exists('medios/diseno/reciente.jpg'));
        $this->assertTrue($disk->exists('medios/diseno/en-uso.jpg'));
    }

    public function test_the_editor_receives_the_photos_and_videos_of_every_page(): void
    {
        $this->actingAs($this->designer())->get(self::ADMIN.'/admin/diseno')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Diseno')->has('mediaOverrides'));
    }

    private function publish(array $design, ?User $user = null)
    {
        return $this->actingAs($user ?? $this->designer())->postJson(self::ADMIN.'/admin/diseno', ['design' => json_encode($design)]);
    }

    private function designer(): User
    {
        return $this->account(['design.manage'], 'disenador');
    }

    private function account(array $permissions, string $username = 'medios'): User
    {
        return User::query()->firstOrCreate(['username' => $username], [
            'name' => ucfirst($username),
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => [],
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
