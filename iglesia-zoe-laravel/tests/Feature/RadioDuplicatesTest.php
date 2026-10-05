<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\SameSong;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioArtist;
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

    public function test_the_same_song_is_only_uploaded_again_when_asked_and_other_versions_go_in_freely(): void
    {
        Storage::fake(config('filesystems.media'));
        $this->track(['title' => 'Renuévame', 'artist' => 'Marcos Witt', 'duration' => 245.4]);

        $this->upload(['title' => 'Renuevame', 'artist' => 'Marcos Witt'])
            ->assertStatus(409)->assertJsonPath('error', 'Esta canción ya está en la biblioteca: «Renuévame» de Marcos Witt. Quítala de la lista o marca «Subir igual» si de verdad quieres otra copia.');
        $this->assertSame(1, RadioTrack::query()->count());

        $this->upload(['title' => 'Renuévame (En Vivo)', 'artist' => 'Marcos Witt', 'duration' => '312'])->assertOk();
        $this->upload(['title' => 'Renuevame', 'artist' => 'Marcos Witt', 'duplicate_ok' => '1'])->assertOk();
        $this->assertSame(3, RadioTrack::query()->count());
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
