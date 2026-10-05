<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Text;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioArtist;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Songs are identified on the internet when they are uploaded: author, co-authors, exact album, year, cover and genres. */
class RadioMusicIdentifyTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const COVER = 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/85/cover.jpg/600x600bb.jpg';

    public function test_a_song_is_identified_with_its_co_authors_exact_album_year_cover_and_genres(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake($this->montesanto());

        $result = $this->identify(['title' => 'derramo el perfume', 'artist' => 'montesanto', 'duration' => '335.2'])
            ->assertOk()->json('result');

        $this->assertTrue($result['found']);
        $this->assertSame('alta', $result['confidence']);
        $this->assertSame('Derramo el perfume', $result['title']);
        $this->assertSame('Montesanto', $result['artist']);
        $this->assertSame(['Averly Morillo'], $result['featured']);
        $this->assertSame('Bautizados En Fuego (LIVE)', $result['album']);
        $this->assertSame(2023, $result['year']);
        $this->assertSame(self::COVER, $result['cover_url']);
        $this->assertSame(['Pop rock alternativo', 'Pop progresivo'], array_column($result['genres'], 'name'));
        $this->assertEqualsCanonicalizing(['itunes', 'deezer', 'musicbrainz', 'catalogo'], $result['sources']);
        $this->assertSame(['kind' => 'agrupacion', 'country' => 'VE', 'known' => true], array_intersect_key($result['artist_info'], array_flip(['kind', 'country', 'known'])));
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'wikidata.org'));
    }

    public function test_the_album_stays_empty_when_it_is_not_certain_and_genres_come_from_the_internet_in_their_christian_version(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackName' => 'Fuego en mi interior', 'artistName' => 'Los Testigos', 'collectionName' => 'Fuego en mi interior - Single', 'trackCount' => 1, 'releaseDate' => '2024-03-01T12:00:00Z', 'trackTimeMillis' => 200000]),
                $this->appleSong(['trackId' => 2, 'trackName' => 'Fuego en mi interior', 'artistName' => 'Los Testigos', 'collectionName' => 'Grandes Éxitos Cristianos', 'trackCount' => 20, 'releaseDate' => '2025-01-01T12:00:00Z', 'trackTimeMillis' => 200000]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => []]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => [[
                'id' => 'b1f3c2a0-0000-4000-8000-000000000001', 'score' => 100, 'title' => 'Fuego en mi interior', 'length' => 200400,
                'artist-credit' => [['name' => 'Los Testigos', 'artist' => ['id' => 'b1f3c2a0-0000-4000-8000-0000000000aa']]],
                'tags' => [['name' => 'reggaeton', 'count' => 2]],
                'releases' => [['title' => 'Lo mejor del año', 'date' => '2025', 'status' => 'Official', 'release-group' => ['id' => 'rg-2', 'primary-type' => 'Album', 'secondary-types' => ['Compilation']]]],
            ]]]),
            'musicbrainz.org/ws/2/artist/*' => Http::response(['type' => 'Group', 'country' => 'PE', 'genres' => [['name' => 'reggaeton', 'count' => 3]], 'tags' => []]),
            'www.wikidata.org/*' => Http::response(['search' => []]),
        ]);

        $result = $this->identify(['title' => 'Fuego en mi interior', 'artist' => 'Los Testigos', 'duration' => '200'])->assertOk()->json('result');

        $this->assertTrue($result['found']);
        $this->assertNull($result['album']);
        $this->assertNull($result['year']);
        $this->assertSame(['Reguetón cristiano'], array_column($result['genres'], 'name'));
        $this->assertSame(['kind' => 'agrupacion', 'country' => 'PE', 'known' => false], array_intersect_key($result['artist_info'], array_flip(['kind', 'country', 'known'])));
    }

    public function test_a_saved_song_keeps_its_genres_in_order_brings_its_cover_and_teaches_the_catalog_its_artists(): void
    {
        Storage::fake(config('filesystems.media'));
        Http::preventStrayRequests();
        Http::fake(['is1-ssl.mzstatic.com/*' => Http::response(UploadedFile::fake()->image('cover.png', 60, 60)->getContent(), 200, ['Content-Type' => 'image/png'])]);
        $progressive = RadioGenre::query()->where('name', 'Pop progresivo')->sole();
        $alternative = RadioGenre::query()->where('name', 'Pop rock alternativo')->sole();

        $this->upload([
            'title' => 'Derramo el perfume',
            'artist' => 'Montesanto',
            'featured' => ['Averly Morillo', 'Invitado Nuevo'],
            'genre_ids' => [$progressive->id, $alternative->id],
            'cover_url' => self::COVER,
            'identity' => json_encode(['confidence' => 'alta', 'score' => 0.97, 'sources' => ['itunes', 'deezer', 'hacker'], 'ids' => ['isrc' => 'QZ2J21510156', 'evil' => 'x'], 'artist' => ['kind' => 'agrupacion']]),
        ])->assertOk()->assertJsonPath('ok', true);

        $track = RadioTrack::query()->sole();
        $this->assertSame(['Pop progresivo', 'Pop rock alternativo'], $track->genres->pluck('name')->all());
        $this->assertStringStartsWith('/media/radio/caratulas/', $track->cover_path);
        Storage::disk(config('filesystems.media'))->assertExists(str($track->cover_path)->after('/media/')->toString());
        $this->assertSame(['confidence' => 'alta', 'score' => 0.97, 'sources' => ['itunes', 'deezer'], 'ids' => ['isrc' => 'QZ2J21510156'], 'artist' => ['kind' => 'agrupacion']], $track->identity);
        $this->assertNotNull($track->identified_at);
        $this->assertSame(1, RadioArtist::query()->where('name', 'Montesanto')->count());
        $this->assertSame('aprendido', RadioArtist::query()->where('name', 'Invitado Nuevo')->value('source'));

        $this->upload(['title' => 'Otra', 'artist' => 'Montesanto', 'cover_url' => 'https://example.com/cover.jpg'])->assertOk();
        $this->assertNull(RadioTrack::query()->where('title', 'Otra')->value('cover_path'));
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'example.com'));

        $this->upload(['title' => 'X', 'artist' => 'Y', 'genre_ids' => ['00000000-0000-4000-8000-000000000000']])
            ->assertUnprocessable()->assertJsonPath('error', 'Uno de los géneros ya no existe. Recarga la página.');
        $this->upload(['title' => 'X', 'artist' => 'Y', 'genre_ids' => RadioGenre::query()->limit(5)->pluck('id')->all()])
            ->assertUnprocessable()->assertJsonPath('error', 'Una canción tiene hasta 4 géneros.');
    }

    public function test_an_artist_learned_from_a_song_classifies_its_next_songs(): void
    {
        Storage::fake(config('filesystems.media'));
        $reggaeton = RadioGenre::query()->where('name', 'Reguetón cristiano')->sole();

        $this->upload([
            'title' => 'Fuego en mi interior',
            'artist' => 'Los Testigos',
            'genre_ids' => [$reggaeton->id],
            'identity' => json_encode(['artist' => ['kind' => 'agrupacion', 'country' => 'PE']]),
        ])->assertOk();

        $artist = MusicCatalog::artist('los testigos');
        $this->assertSame(['agrupacion', 'PE', 'aprendido'], [$artist->kind, $artist->country, $artist->source]);
        $this->assertSame(['Reguetón cristiano'], $artist->genres->pluck('name')->all());
    }

    public function test_a_saved_song_is_searched_with_what_the_form_says_now_and_falls_back_to_the_genre_of_its_file(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['results' => [], 'data' => [], 'recordings' => [], 'search' => []])]);
        $track = RadioTrack::query()->create(['kind' => 'musica', 'title' => 'Cancion sin nombre', 'artist' => 'Desconocido', 'file_path' => '/media/radio/musica/a.mp3', 'duration' => 200, 'rotation' => false, 'duck' => false, 'active' => true]);

        $this->identify(['id' => $track->id, 'title' => 'Mi refugio', 'artist' => 'Grupo Inventado', 'genre' => 'Christian & Gospel'])
            ->assertOk()
            ->assertJsonPath('result.found', false)
            ->assertJsonPath('result.genres.0.name', 'Música cristiana');

        Http::assertSent(fn (Request $request) => str_contains(urldecode($request->url()), 'Mi refugio'));
        Http::assertNotSent(fn (Request $request) => str_contains(urldecode($request->url()), 'Cancion sin nombre'));
    }

    public function test_only_the_library_identifies_songs_and_it_needs_their_name(): void
    {
        $other = User::query()->create([
            'username' => 'atmosfera', 'name' => 'Atmósfera', 'email' => 'atmosfera@iglesiacristianazoe.pe', 'password' => 'secreto1',
            'role' => Role::Admin, 'admin_types' => ['atmosfera'], 'permissions' => Permissions::forTypes(['atmosfera']), 'active' => true,
        ]);
        $this->actingAs($other)->post(self::ADMIN.'/admin/radio/biblioteca/identificar', ['title' => 'Renuévame'])->assertRedirect('/admin');
        $this->actingAs($other)->get(self::ADMIN.'/admin/radio/catalogo')->assertRedirect('/admin');

        $this->identify(['title' => 'R'])->assertUnprocessable()->assertJsonPath('error', 'Escribe el nombre de la canción para buscarla.');
    }

    public function test_the_command_completes_only_what_the_songs_of_the_library_are_missing(): void
    {
        Storage::fake(config('filesystems.media'));
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([...$this->montesanto(), 'is1-ssl.mzstatic.com/*' => Http::response(UploadedFile::fake()->image('cover.png', 60, 60)->getContent())]);
        $track = RadioTrack::query()->create([
            'kind' => 'musica', 'title' => 'Derramo el perfume', 'artist' => 'montesanto', 'album' => 'Mi álbum',
            'file_path' => '/media/radio/musica/a.mp3', 'duration' => 335.2, 'rotation' => false, 'duck' => false, 'active' => true,
        ]);

        $this->artisan('radio:identify', ['--missing' => true])->assertSuccessful();

        $track->refresh();
        $this->assertSame('Montesanto', $track->artist);
        $this->assertSame('Mi álbum', $track->album);
        $this->assertSame(2023, $track->year);
        $this->assertSame(['Averly Morillo'], $track->featured);
        $this->assertSame(['Pop rock alternativo', 'Pop progresivo'], $track->genres->pluck('name')->all());
        $this->assertNotNull($track->cover_path);
        $this->assertNotNull($track->identified_at);

        $this->artisan('radio:identify', ['--missing' => true])->expectsOutput('No hay canciones para identificar.')->assertSuccessful();
    }

    public function test_credits_and_song_names_are_read_the_way_people_write_them(): void
    {
        $known = MusicCatalog::joinedNames();

        $this->assertSame(['Majo y Dan', 'Marcos Witt', 'Funky'], Text::splitNames('Majo y Dan & Marcos Witt feat. Funky', $known));
        $this->assertSame(['for KING & COUNTRY', 'Lecrae'], Text::splitNames('for KING & COUNTRY x Lecrae', $known));
        $this->assertSame('Renuévame', Text::cleanTitle('Renuévame (En Vivo) [Video Oficial]'));
        $this->assertSame('Derramo el Perfume', Text::cleanTitle('Derramo el Perfume (feat. Averly Morillo) [Live]'));
        $this->assertSame(['Averly Morillo'], Text::featuredIn('Derramo el Perfume (feat. Averly Morillo) [Live]', $known));
        $this->assertSame(['Averly Morillo'], Text::mergeSpellings(['Averly Morillo', 'Arely Morillo', 'Averly Morillo'], fn () => false));
        $this->assertLessThan(0.8, Text::similarity('Santo', 'Ven Espíritu Santo'));
    }

    /** iTunes, Deezer and MusicBrainz answers for «Derramo el perfume» of Montesanto. */
    private function montesanto(): array
    {
        return [
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong([]),
                $this->appleSong(['trackId' => 2, 'collectionName' => 'Lo Mejor de la Adoración 2022', 'collectionArtistName' => 'Various Artists', 'trackCount' => 20, 'releaseDate' => '2022-01-01T12:00:00Z', 'artworkUrl100' => 'https://is1-ssl.mzstatic.com/image/thumb/other/100x100bb.jpg']),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 11, 'type' => 'track', 'title' => 'Derramo el Perfume (Live)', 'duration' => 335,
                'artist' => ['id' => 5, 'name' => 'Montesanto'],
                'album' => ['id' => 721749611, 'title' => 'Bautizados En Fuego (LIVE)', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/x/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 10, 'release_date' => '2023-10-20', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['isrc' => 'QZ2J21510156', 'contributors' => [['name' => 'Montesanto', 'role' => 'Main'], ['name' => 'Averly Morillo', 'role' => 'Featured']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => [[
                'id' => 'b1f3c2a0-0000-4000-8000-000000000002', 'score' => 100, 'title' => 'Derramo el perfume', 'length' => 335400,
                'artist-credit' => [
                    ['name' => 'Montesanto', 'joinphrase' => ' feat. ', 'artist' => ['id' => 'b1f3c2a0-0000-4000-8000-0000000000bb']],
                    ['name' => 'Arely Morillo', 'artist' => ['id' => 'b1f3c2a0-0000-4000-8000-0000000000cc']],
                ],
                'releases' => [['title' => 'Bautizados En Fuego (LIVE)', 'date' => '2023-10-20', 'status' => 'Official', 'track-count' => 10, 'release-group' => ['id' => 'rg-1', 'primary-type' => 'Album', 'secondary-types' => ['Live']]]],
            ]]]),
        ];
    }

    private function appleSong(array $values): array
    {
        return [
            'kind' => 'song',
            'trackId' => 1,
            'collectionId' => 9,
            'trackName' => 'Derramo el Perfume (feat. Averly Morillo) [Live]',
            'artistName' => 'Montesanto',
            'collectionName' => 'Bautizados En Fuego (LIVE)',
            'trackCount' => 10,
            'releaseDate' => '2021-05-15T12:00:00Z',
            'trackTimeMillis' => 335000,
            'artworkUrl100' => 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/85/cover.jpg/100x100bb.jpg',
            'primaryGenreName' => 'Christian',
            ...$values,
        ];
    }

    private function identify(array $fields): TestResponse
    {
        return $this->actingAs($this->admin())->postJson(self::ADMIN.'/admin/radio/biblioteca/identificar', $fields);
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
