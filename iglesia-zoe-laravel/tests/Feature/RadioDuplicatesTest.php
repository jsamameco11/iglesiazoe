<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\SameSong;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioArtist;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Songs about to be uploaded are compared with the library and among themselves, with a verdict and its reasons. */
class RadioDuplicatesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_the_same_song_written_another_way_is_the_same_song(): void
    {
        $library = ['title' => 'Gracias Tu Fidelidad', 'artist' => 'Marcos Witt', 'featured' => ['Un Corazón'], 'album' => 'Gracias', 'year' => 2021, 'duration' => 301.2];

        $fromFileName = SameSong::verdict(['title' => 'Marcos Witt Gracias Tu Fidelidad (Videoclip Oficial)', 'artist' => 'Un Corazón', 'duration' => 302.5], $library);
        $this->assertSame(SameSong::SAME, $fromFileName['verdict']);
        $this->assertSame(['mismo nombre', 'mismo autor', 'duración casi igual (5:03 y 5:01)'], $fromFileName['reasons']);

        $byCode = SameSong::verdict(['title' => 'Gracias (Tu Fidelidad)', 'artist' => 'Marcos Witt', 'ids' => ['isrc' => 'usa2b2100123']], [...$library, 'ids' => ['isrc' => 'USA2B2100123']]);
        $this->assertSame(SameSong::SAME, $byCode['verdict']);
        $this->assertSame('mismo código ISRC', $byCode['reasons'][0]);

        RadioArtist::query()->where('name', 'Miel San Marcos')->update(['aliases' => ['MSM']]);
        MusicCatalog::forget();
        $alias = SameSong::verdict(['title' => 'Danzo en el Río', 'artist' => 'MSM', 'duration' => 290.4], ['title' => 'Danzo En El Rio', 'artist' => 'Miel San Marcos', 'duration' => 290.1]);
        $this->assertSame(['verdict' => SameSong::SAME, 'reasons' => ['mismo nombre', 'mismo autor', 'misma duración (4:50)']], $alias);
    }

    public function test_another_cut_or_recording_of_the_song_is_another_version_and_a_doubtful_one_is_a_possible_duplicate(): void
    {
        $studio = ['title' => 'Oceans (Where Feet May Fail)', 'artist' => 'Hillsong UNITED', 'album' => 'Zion', 'year' => 2013, 'duration' => 534.0];

        $live = SameSong::verdict(['title' => 'Oceans (Where Feet May Fail) [Live]', 'artist' => 'Hillsong UNITED', 'album' => 'Live in Miami', 'year' => 2012, 'duration' => 548.0], $studio);
        $this->assertSame(SameSong::VERSION, $live['verdict']);
        $this->assertContains('solo una es en vivo', $live['reasons']);

        $acoustic = SameSong::verdict(['title' => 'Oceans (Acoustic)', 'artist' => 'Hillsong UNITED', 'duration' => 401.0], $studio);
        $this->assertSame(SameSong::VERSION, $acoustic['verdict']);
        $this->assertContains('solo una es acústica', $acoustic['reasons']);

        $anotherRecording = SameSong::verdict(['title' => 'Oceans', 'artist' => 'Hillsong UNITED', 'album' => 'Zion (Deluxe)', 'year' => 2013, 'duration' => 480.0], $studio);
        $this->assertSame(SameSong::VERSION, $anotherRecording['verdict']);
        $this->assertContains('duración distinta (8:00 y 8:54)', $anotherRecording['reasons']);

        $videoIntro = SameSong::verdict(['title' => 'Oceans', 'artist' => 'Hillsong United', 'duration' => 546.0], $studio);
        $this->assertSame(SameSong::MAYBE, $videoIntro['verdict']);
    }

    public function test_different_songs_get_no_verdict(): void
    {
        $song = ['title' => 'Tú eres', 'artist' => 'Marcos Witt', 'duration' => 250.0];

        $this->assertNull(SameSong::verdict(['title' => 'Eres tú', 'artist' => 'Marcos Witt', 'duration' => 250.0], $song));
        $this->assertNull(SameSong::verdict(['title' => 'Tú eres Santo', 'artist' => 'Marcos Witt', 'duration' => 250.0], $song));
        $this->assertNull(SameSong::verdict(['title' => 'Tú eres', 'artist' => 'Jesús Adrián Romero', 'duration' => 281.0], $song));
        $this->assertNull(SameSong::verdict(['title' => 'Tu Fidelidad', 'artist' => 'Marcos Witt', 'duration' => 301.0], ['title' => 'Gracias Tu Fidelidad', 'artist' => 'Marcos Witt', 'duration' => 301.0]));
        $this->assertNull(SameSong::verdict(['title' => 'Agnus Dei (Parte 2)', 'artist' => 'Marcos Witt', 'duration' => 250.0], ['title' => 'Agnus Dei (Parte 1)', 'artist' => 'Marcos Witt', 'duration' => 250.0]));
        $this->assertNull(SameSong::verdict(['title' => 'Salmo 121', 'artist' => 'Marcos Witt', 'duration' => 250.0], ['title' => 'Salmo 21', 'artist' => 'Marcos Witt', 'duration' => 250.0]));
    }

    public function test_a_track_number_or_a_single_named_after_the_song_does_not_hide_the_same_song(): void
    {
        $album = ['title' => 'Me Diste Vida', 'artist' => 'Josh Morales', 'album' => 'Tiempo de Fiesta', 'year' => 2020, 'duration' => 270.0];

        $this->assertSame(SameSong::SAME, SameSong::verdict(['title' => '07. Me Diste Vida', 'artist' => 'Josh Morales', 'album' => 'Me Diste Vida - Single', 'year' => 2019, 'duration' => 270.6], $album)['verdict']);
        $this->assertSame(SameSong::SAME, SameSong::verdict(
            ['title' => 'Alive (Studio Version)', 'artist' => 'Hillsong Young & Free', 'album' => 'Youth Revival (Live)', 'duration' => 250.0],
            ['title' => 'Alive', 'artist' => 'Hillsong Young & Free', 'album' => 'Youth Revival', 'duration' => 250.4],
        )['verdict']);
    }

    public function test_an_upload_is_compared_with_the_library_and_with_the_songs_before_it(): void
    {
        $track = $this->track(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'album' => 'Renuévame', 'year' => 1999, 'duration' => 245.4]);

        $response = $this->actingAs($this->admin())->postJson(self::ADMIN.'/admin/radio/biblioteca/duplicados', ['songs' => [
            ['key' => 'a', 'title' => 'Renuevame (Audio Oficial)', 'artist' => 'Marcos Witt', 'duration' => 245.9],
            ['key' => 'b', 'title' => 'Sobrenatural', 'artist' => 'Marcos Witt', 'duration' => 300.0],
            ['key' => 'c', 'title' => 'Sobrenatural', 'artist' => 'Marcos Witt', 'duration' => 300.8],
            ['key' => 'd', 'title' => 'Renuévame (En Vivo)', 'artist' => 'Marcos Witt', 'duration' => 312.0],
        ]])->assertOk();

        $response->assertJsonPath('results.a.0.verdict', SameSong::SAME)->assertJsonPath('results.a.0.track.id', $track->id)
            ->assertJsonPath('results.b', [])
            ->assertJsonPath('results.c.0.verdict', SameSong::SAME)->assertJsonPath('results.c.0.batch', 'b')
            ->assertJsonPath('results.d.0.verdict', SameSong::VERSION)->assertJsonPath('results.d.0.track.id', $track->id);
    }

    public function test_a_long_upload_sent_as_json_judges_only_the_songs_asked_for_with_the_rest_as_the_songs_before_them(): void
    {
        $this->track(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'duration' => 245.4]);
        $songs = collect(range(1, 150))->map(fn (int $number) => ['key' => "s{$number}", 'title' => "Canción número {$number}", 'artist' => 'Coro Zoe', 'featured' => [], 'album' => '', 'year' => '', 'duration' => 200 + $number, 'identity' => null])->all();
        $songs[] = ['key' => 'repeat', 'title' => 'Canción número 7', 'artist' => 'Coro Zoe', 'featured' => [], 'album' => '', 'year' => '', 'duration' => 207.4, 'identity' => null];
        $songs[] = ['key' => 'library', 'title' => 'Renuevame', 'artist' => 'Marcos Witt', 'featured' => [], 'album' => '', 'year' => '', 'duration' => 245.9, 'identity' => null];

        $response = $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca/duplicados', [
            'songs' => json_encode($songs),
            'judge' => json_encode(['repeat', 'library']),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(['repeat', 'library'], array_keys($response->json('results')));
        $response->assertJsonPath('results.repeat.0.verdict', SameSong::SAME)->assertJsonPath('results.repeat.0.batch', 's7')
            ->assertJsonPath('results.library.0.verdict', SameSong::SAME)->assertJsonPath('results.library.0.track.title', 'Renuévame');
    }

    public function test_the_same_song_is_only_uploaded_again_when_asked_and_other_versions_go_in_freely(): void
    {
        Storage::fake(config('filesystems.media'));
        $this->track(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'duration' => 245.4]);

        $this->upload(['title' => 'Renuevame', 'artist' => 'Marcos Witt'])
            ->assertStatus(409)->assertJsonPath('error', 'Esta canción ya está en la biblioteca: «Renuévame» de Marcos Witt. Elige en su tarjeta qué hacer: no subirla, reemplazar la que ya está o guardar ambas.');
        $this->assertSame(1, RadioTrack::query()->count());

        $live = $this->upload(['title' => 'Renuévame (En Vivo)', 'artist' => 'Marcos Witt', 'duration' => '312'])->assertOk();
        $live->assertJsonPath('id', RadioTrack::query()->where('title', 'Renuévame (En Vivo)')->value('id'));
        $this->upload(['title' => 'Renuevame', 'artist' => 'Marcos Witt', 'duplicate_ok' => '1'])->assertOk();
        $this->assertSame(3, RadioTrack::query()->count());
    }

    public function test_replacing_a_repeated_song_swaps_its_audio_and_keeps_its_details_and_schedule(): void
    {
        $disk = Storage::fake(config('filesystems.media'));
        $disk->put('radio/musica/vieja.mp3', 'audio viejo');
        $track = $this->track(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'file_path' => '/media/radio/musica/vieja.mp3', 'duration' => 240, 'rotation' => true]);
        $slot = RadioSlot::query()->create(['starts_at' => now()->addDay(), 'duration' => 240, 'kind' => 'musica', 'radio_track_id' => $track->id, 'title' => $track->title]);

        $this->upload(['id' => $track->id, 'replace_audio' => '1', 'title' => 'Renuevame (Official Audio)', 'artist' => 'Marcos Witt', 'album' => 'Sigues siendo Dios', 'year' => '2010'])
            ->assertOk()->assertJsonPath('message', 'Audio reemplazado: «Renuévame» suena ahora con el archivo nuevo y conserva sus datos, su rotación y su programación.');

        $track->refresh();
        $this->assertSame(1, RadioTrack::query()->count());
        $this->assertSame(['Renuévame', 'Marcos Witt', 'Sigues siendo Dios', 2010, true], [$track->title, $track->artist, $track->album, $track->year, $track->rotation]);
        $this->assertNotSame('/media/radio/musica/vieja.mp3', $track->file_path);
        $this->assertEqualsWithDelta(245.6, $track->duration, 0.01);
        $this->assertEqualsWithDelta(245.6, $slot->refresh()->duration, 0.01);
        $disk->assertMissing('radio/musica/vieja.mp3');
    }

    public function test_only_the_library_reviews_duplicates(): void
    {
        $other = User::query()->create(['username' => 'atmosfera', 'name' => 'Atmósfera', 'email' => 'atmosfera@iglesiacristianazoe.pe', 'password' => 'secreto1', 'role' => Role::Admin, 'admin_types' => ['atmosfera'], 'permissions' => Permissions::forTypes(['atmosfera']), 'active' => true]);

        $this->actingAs($other)->post(self::ADMIN.'/admin/radio/biblioteca/duplicados', ['songs' => []])->assertRedirect('/admin');
    }

    private function track(array $fields): RadioTrack
    {
        return RadioTrack::query()->create(['kind' => 'musica', 'file_path' => '/media/radio/musica/cancion.mp3', 'active' => true, ...$fields]);
    }

    private function upload(array $fields): TestResponse
    {
        return $this->actingAs($this->admin())->post(self::ADMIN.'/admin/radio/biblioteca', [
            'kind' => 'musica',
            'duration' => '245.6',
            'audio' => UploadedFile::fake()->create('cancion.mp3', 300, 'audio/mpeg'),
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
