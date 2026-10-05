<?php

namespace Tests\Feature;

use App\Models\SiteSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HotMediaTest extends TestCase
{
    use RefreshDatabase;

    private const HERO = 'medios/site/hero/culto.mp4';

    private const VISIT = 'medios/site/visit/familia.jpg';

    private string $root;

    protected function setUp(): void
    {
        parent::setUp();
        $this->root = storage_path('framework/testing/hot-'.uniqid());
        config(['filesystems.media' => 'wasabi', 'filesystems.hot' => $this->root]);
        $wasabi = Storage::fake('wasabi');
        foreach (['images/banner.jpg', 'videos/siguientepaso.mp4', self::HERO, self::VISIT] as $key) {
            $wasabi->put($key, 'contenido de '.$key);
        }
        SiteSetting::withoutEvents(fn () => SiteSetting::query()->create(['key' => 'media', 'value' => $this->assets(self::HERO)]));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->root);
        parent::tearDown();
    }

    public function test_the_web_server_keeps_the_home_media_and_drops_what_nothing_links_to(): void
    {
        File::ensureDirectoryExists($this->root.'/media/medios/viejo');
        File::put($this->root.'/media/medios/viejo/foto.jpg', 'ya no se usa');

        $this->artisan('media:hot')->assertSuccessful();

        $this->assertStringEqualsFile($this->root.'/images/banner.jpg', 'contenido de images/banner.jpg');
        $this->assertFileExists($this->root.'/videos/siguientepaso.mp4');
        $this->assertStringEqualsFile($this->root.'/media/'.self::HERO, 'contenido de '.self::HERO);
        $this->assertFileDoesNotExist($this->root.'/media/'.self::VISIT);
        $this->assertFileDoesNotExist($this->root.'/media/medios/viejo/foto.jpg');
    }

    public function test_a_home_file_is_copied_after_its_first_redirect_and_other_files_stay_on_wasabi(): void
    {
        $this->withoutDefer();

        $this->get('/media/'.self::HERO)->assertRedirect();
        $this->get('/media/'.self::VISIT)->assertRedirect();

        $this->assertFileExists($this->root.'/media/'.self::HERO);
        $this->assertFileDoesNotExist($this->root.'/media/'.self::VISIT);
    }

    public function test_changing_a_home_photo_refreshes_the_web_server_copy(): void
    {
        $this->artisan('media:hot')->assertSuccessful();
        $this->withoutDefer();
        $replacement = 'medios/site/hero/nuevo.mp4';
        Storage::disk('wasabi')->put($replacement, 'nuevo');

        SiteSetting::query()->whereKey('media')->first()->update(['value' => $this->assets($replacement)]);

        $this->assertFileExists($this->root.'/media/'.$replacement);
        $this->assertFileDoesNotExist($this->root.'/media/'.self::HERO);
    }

    public function test_nothing_is_copied_when_files_live_on_the_local_disk(): void
    {
        config(['filesystems.media' => 'public']);

        $this->artisan('media:hot')->assertSuccessful();

        $this->assertDirectoryDoesNotExist($this->root);
    }

    /** @return array{assets: array<string, array{kind: string, src: string, poster?: string}>} */
    private function assets(string $heroKey): array
    {
        return ['assets' => [
            'hero' => ['kind' => 'video', 'src' => '/media/'.$heroKey, 'poster' => '/images/banner.jpg'],
            'visit' => ['kind' => 'image', 'src' => '/media/'.self::VISIT],
        ]];
    }
}
