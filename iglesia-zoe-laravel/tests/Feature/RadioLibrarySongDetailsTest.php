<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Songs of the library carry their author, co-authors, album, genres, year and cover; only the name and the author are required. */
class RadioLibrarySongDetailsTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:00:00', Station::TZ));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_song_is_saved_with_its_co_authors_album_genre_year_and_cover(): void
    {
        $this->upload([
            'title' => '  Renuévame ',
            'artist' => 'Marcos Witt',
            'featured' => ['Danilo Montero', '', 'Coalo Zamorano (1)', 'danilo montero', 'Marcos Witt', 'Coalo Zamorano'],
            'album' => 'Sigues siendo Dios',
            'genre_ids' => [RadioGenre::query()->where('name', 'Adoración')->value('id')],
            'year' => '2004',
            'cover' => UploadedFile::fake()->image('caratula.jpg', 600, 600),
        ])->assertOk()->assertJsonPath('ok', true);

        $track = RadioTrack::query()->sole();
        $this->assertSame('Renuévame', $track->title);
        $this->assertSame(['Danilo Montero', 'Coalo Zamorano'], $track->featured);
        $this->assertSame('Sigues siendo Dios', $track->album);
        $this->assertSame(['Adoración'], $track->genres->pluck('name')->all());
        $this->assertSame(2004, $track->year);
        $this->assertStringStartsWith('/media/radio/caratulas/', $track->cover_path);
        Storage::disk(config('filesystems.media'))->assertExists(str($track->cover_path)->after('/media/')->toString());

        auth()->guard('web')->forgetUser();
        $this->getJson(self::SITE.'/radio/estado')->assertOk()
            ->assertJsonPath('queue.0.title', 'Renuévame')
            ->assertJsonPath('queue.0.artist', 'Marcos Witt, Danilo Montero, Coalo Zamorano');
    }

    public function test_a_song_needs_its_name_and_author_but_an_announcement_does_not_need_an_author(): void
    {
        $this->upload(['title' => 'Renuévame'])->assertUnprocessable()->assertJsonPath('error', 'Escribe el autor de la canción.');
        $this->upload(['title' => ' ', 'artist' => 'Marcos Witt'])->assertUnprocessable();
        $this->upload(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'featured' => ['A', 'B', 'C', 'D', 'E']])
            ->assertUnprocessable()->assertJsonPath('error', 'Una canción tiene hasta 4 coautores.');
        $this->upload(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'year' => '204'])->assertUnprocessable();
        $this->assertSame(0, RadioTrack::query()->count());

        $this->upload(['title' => 'Retiro de jóvenes', 'kind' => 'anuncio', 'album' => 'No aplica', 'featured' => ['Nadie']])->assertOk();
        $announcement = RadioTrack::query()->sole();
        $this->assertNull($announcement->artist);
        $this->assertNull($announcement->album);
        $this->assertNull($announcement->featured);
    }

    public function test_the_cover_is_replaced_removed_and_deleted_with_the_song(): void
    {
        $disk = Storage::disk(config('filesystems.media'));
        $this->upload(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'cover' => UploadedFile::fake()->image('uno.png', 300, 300)])->assertOk();
        $track = RadioTrack::query()->sole();
        $first = str($track->cover_path)->after('/media/')->toString();

        $this->edit($track, ['cover' => UploadedFile::fake()->image('dos.jpg', 300, 300)])->assertOk();
        $second = str($track->fresh()->cover_path)->after('/media/')->toString();
        $disk->assertMissing($first);
        $disk->assertExists($second);

        $this->edit($track, ['cover' => UploadedFile::fake()->create('notas.pdf', 20, 'application/pdf')])->assertUnprocessable();
        $disk->assertExists($second);

        $this->edit($track, ['remove_cover' => '1', 'featured' => ['Danilo Montero']])->assertOk();
        $this->assertNull($track->fresh()->cover_path);
        $this->assertSame(['Danilo Montero'], $track->fresh()->featured);
        $disk->assertMissing($second);

        $this->edit($track, ['cover' => UploadedFile::fake()->image('tres.webp', 300, 300)])->assertOk();
        $third = str($track->fresh()->cover_path)->after('/media/')->toString();
        $this->actingAs($this->admin())->postJson(self::ADMIN.'/admin/radio/biblioteca/eliminar', ['id' => $track->id])->assertOk();
        $disk->assertMissing($third);
    }

    public function test_an_audio_the_server_rejected_for_its_size_gets_a_clear_message(): void
    {
        $this->upload([
            'title' => 'Renuévame',
            'artist' => 'Marcos Witt',
            'audio' => new UploadedFile('', 'cancion.mp3', 'audio/mpeg', UPLOAD_ERR_INI_SIZE, true),
        ])->assertUnprocessable()->assertJsonPath('error', 'El servidor no aceptó el archivo porque pesa demasiado. Expórtalo en MP3 (128–192 kbps) e inténtalo de nuevo.');

        $this->assertSame(0, RadioTrack::query()->count());
    }

    private function upload(array $fields): TestResponse
    {
        return $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca', [
            'kind' => 'musica',
            'duration' => '245.4',
            'audio' => UploadedFile::fake()->create('cancion.mp3', 300, 'audio/mpeg'),
            ...$fields,
        ], ['Accept' => 'application/json']);
    }

    private function edit(RadioTrack $track, array $fields): TestResponse
    {
        $track->refresh();

        return $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca', [
            'id' => $track->id,
            'title' => $track->title,
            'artist' => $track->artist,
            'kind' => $track->kind,
            'active' => '1',
            ...$fields,
        ], ['Accept' => 'application/json']);
    }

    private function admin(): User
    {
        return User::query()->firstOrCreate(['username' => 'visuales'], [
            'name' => 'Visuales',
            'email' => 'visuales@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['visuales'],
            'permissions' => Permissions::forTypes(['visuales']),
            'active' => true,
        ]);
    }
}
