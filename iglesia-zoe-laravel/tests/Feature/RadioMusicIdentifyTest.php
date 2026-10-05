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
use Inertia\Testing\AssertableInertia;
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

    public function test_another_cut_of_the_song_never_wins_and_a_guest_of_one_database_is_not_a_co_author(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackId' => 1, 'trackName' => 'Oceans (Sped Up)', 'artistName' => 'Hillsong UNITED', 'collectionName' => 'Oceans (Sped Up) - Single', 'trackCount' => 1, 'releaseDate' => '2023-01-01T12:00:00Z', 'trackTimeMillis' => 536000]),
                $this->appleSong(['trackId' => 2, 'trackName' => 'Oceans (feat. Guest Star)', 'artistName' => 'Hillsong UNITED', 'collectionName' => 'Zion (Deluxe Edition)', 'trackCount' => 18, 'releaseDate' => '2014-01-01T12:00:00Z', 'trackTimeMillis' => 536000]),
                $this->appleSong(['trackId' => 3, 'trackName' => 'Oceans', 'artistName' => 'Hillsong UNITED', 'collectionName' => 'Zion', 'trackCount' => 13, 'releaseDate' => '2013-02-22T12:00:00Z', 'trackTimeMillis' => 536000]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 31, 'type' => 'track', 'title' => 'Oceans', 'duration' => 536,
                'artist' => ['id' => 7, 'name' => 'Hillsong UNITED'],
                'album' => ['id' => 5151, 'title' => 'Zion', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/z/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 13, 'release_date' => '2013-02-22', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Hillsong UNITED', 'role' => 'Main']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => []]),
        ]);

        $result = $this->identify(['title' => 'Oceans', 'artist' => 'Hillsong United', 'duration' => '536'])->assertOk()->json('result');

        $this->assertSame(['Oceans', 'Hillsong UNITED', [], 'Zion', 2013], [$result['title'], $result['artist'], $result['featured'], $result['album'], $result['year']]);
    }

    public function test_a_file_name_with_its_author_and_a_handle_inside_finds_the_author_and_the_co_author(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackName' => 'Gracias / Tu Fidelidad (feat. Un Corazón)', 'artistName' => 'Marcos Witt', 'collectionName' => 'Legado', 'trackCount' => 12, 'releaseDate' => '2025-05-02T12:00:00Z', 'trackTimeMillis' => 325000]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 41, 'type' => 'track', 'title' => 'Gracias / Tu Fidelidad', 'duration' => 325,
                'artist' => ['id' => 8, 'name' => 'Marcos Witt'],
                'album' => ['id' => 6161, 'title' => 'Legado', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/l/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 12, 'release_date' => '2025-05-02', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Marcos Witt', 'role' => 'Main'], ['name' => 'Un Corazón', 'role' => 'Featured']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => []]),
        ]);

        $result = $this->identify(['title' => 'Marcos Witt Gracias Tu Fidelidad feat. @uncorazonorg (Videoclip Oficial)', 'duration' => '325'])->assertOk()->json('result');

        $this->assertSame(['Gracias / Tu Fidelidad', 'Marcos Witt', ['Un Corazón'], 'Legado', 2025], [$result['title'], $result['artist'], $result['featured'], $result['album'], $result['year']]);
    }

    public function test_a_medley_is_not_a_co_author_and_the_asked_author_stays_first_when_credited_with_another(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackName' => 'Eterno (Con Cuando los Santos Marchen Ya) [Live]', 'artistName' => 'Christine D\'Clario', 'collectionName' => 'Eterno (Live)', 'trackCount' => 14, 'releaseDate' => '2013-01-01T12:00:00Z', 'trackTimeMillis' => 363000]),
                $this->appleSong(['trackId' => 2, 'trackName' => 'Dios De Pactos', 'artistName' => 'Adoración & Miel San Marcos', 'collectionName' => 'Adoración Vol. 1', 'trackCount' => 13, 'releaseDate' => '2022-11-04T12:00:00Z', 'trackTimeMillis' => 276000]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 51, 'type' => 'track', 'title' => 'Eterno (Con Cuando los Santos Marchen Ya)', 'duration' => 363,
                'artist' => ['id' => 9, 'name' => 'Christine D\'Clario'],
                'album' => ['id' => 7171, 'title' => 'Eterno (Live)', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/e/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 14, 'release_date' => '2013-01-01', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Christine D\'Clario', 'role' => 'Main']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => []]),
        ]);

        $medley = $this->identify(['title' => 'Eterno', 'artist' => 'Christine D\'Clario'])->assertOk()->json('result');
        $shared = $this->identify(['title' => 'Dios de pactos', 'artist' => 'Miel San Marcos'])->assertOk()->json('result');

        $this->assertSame(['Christine D\'Clario', [], 'Eterno (Live)', 2013], [$medley['artist'], $medley['featured'], $medley['album'], $medley['year']]);
        $this->assertSame(['Miel San Marcos', ['Adoración']], [$shared['artist'], $shared['featured']]);
    }

    public function test_a_compilation_recording_lends_no_credits_and_the_year_is_the_original_editions(): void
    {
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackId' => 1, 'trackName' => '10,000 Reasons (Bless the Lord)', 'artistName' => 'Matt Redman & Steve Angrisano', 'collectionName' => 'Spirit & Song: Disc M', 'collectionArtistName' => 'Various Artists', 'trackCount' => 18, 'releaseDate' => '2013-01-01T12:00:00Z', 'trackTimeMillis' => 300000]),
                $this->appleSong(['trackId' => 2, 'trackName' => '10,000 Reasons (Bless the Lord)', 'artistName' => 'Matt Redman', 'collectionName' => '10,000 Reasons', 'trackCount' => 11, 'releaseDate' => '2011-04-04T12:00:00Z', 'trackTimeMillis' => 343000]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 61, 'type' => 'track', 'title' => '10,000 Reasons (Bless the Lord)', 'duration' => 343,
                'artist' => ['id' => 10, 'name' => 'Matt Redman'],
                'album' => ['id' => 8181, 'title' => '10,000 Reasons', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/r/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 11, 'release_date' => '2013-09-01', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Matt Redman', 'role' => 'Main']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => [[
                'id' => 'b1f3c2a0-0000-4000-8000-000000000003', 'score' => 100, 'title' => '10,000 Reasons (Bless the Lord)', 'length' => 343300,
                'artist-credit' => [['name' => 'Matt Redman', 'artist' => ['id' => 'b1f3c2a0-0000-4000-8000-0000000000dd']]],
                'releases' => [
                    ['title' => '10,000 Reasons', 'status' => 'Official', 'track-count' => 11, 'release-group' => ['id' => 'rg-3', 'primary-type' => 'Album']],
                    ['title' => '10,000 Reasons', 'date' => '2012-06-01', 'status' => 'Official', 'track-count' => 15, 'release-group' => ['id' => 'rg-3', 'primary-type' => 'Album']],
                ],
            ]]]),
        ]);

        $result = $this->identify(['title' => '10,000 Reasons (Bless the Lord)', 'artist' => 'Matt Redman'])->assertOk()->json('result');

        $this->assertSame(['Matt Redman', [], '10,000 Reasons', 2011], [$result['artist'], $result['featured'], $result['album'], $result['year']]);
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

        $this->assertLessThan(0.8, Text::titleSimilarity('Tú Eres Santo', 'Tú eres'));
        $this->assertLessThan(0.8, Text::titleSimilarity('Eres Tú', 'Tú eres'));
        $this->assertLessThan(0.8, Text::titleSimilarity('Jesus What A Beautiful Name', 'What a Beautiful Name'));
        $this->assertGreaterThanOrEqual(0.9, Text::titleSimilarity('Oceans (Where Feet May Fail)', 'Oceans'));
        $this->assertGreaterThanOrEqual(0.9, Text::titleSimilarity('Graves Into Gardens', 'Graves into Garden'));
        $this->assertSame(['sped up'], Text::cuts('Oceans (Where Feet May Fail) (Sped Up)'));
        $this->assertSame(['performance track'], Text::cuts('Who Am I (High without background vocals) (Performance Track)'));
        $this->assertSame(['redux'], Text::cuts('Oceans (Where Feet May Fail) [Redux]'));
        $this->assertSame([], Text::cuts('Renuévame (En Vivo) [Video Oficial]'));
        $this->assertSame([], Text::featuredIn('Eterno (Con Cuando los Santos Marchen Ya) [Live]', $known));
        $this->assertSame(['Cuando los Santos Marchen Ya'], Text::mentionedIn('Eterno (Con Cuando los Santos Marchen Ya) [Live]', $known));
        $this->assertSame(['@uncorazonorg'], Text::featuredIn('Gracias Tu Fidelidad feat. @uncorazonorg (Videoclip Oficial)', $known));
        $this->assertTrue(Text::handleOf('@uncorazonorg', 'Un Corazón'));
        $this->assertFalse(Text::handleOf('@uncorazonorg', 'Un Cora'));
        $this->assertSame('Gracias Tu Fidelidad', Text::withoutName('Marcos Witt - Gracias Tu Fidelidad', 'Marcos Witt'));
        $this->assertSame('Alaben', Text::withoutName('Alaben - for KING & COUNTRY', 'for KING & COUNTRY'));
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

    /** «Danzo en el río» of Miel San Marcos: live on iTunes and Deezer, without the label on MusicBrainz. */
    private function mielSanMarcos(): array
    {
        return [
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong(['trackName' => 'Danzo en el Río (feat. Josh Morales) [En Vivo]', 'artistName' => 'Miel San Marcos', 'collectionName' => 'Pentecostés (En Vivo)', 'trackCount' => 21, 'releaseDate' => '2017-11-10T12:00:00Z', 'trackTimeMillis' => 281800]),
            ]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 21, 'type' => 'track', 'title' => 'Danzo en el Río (En Vivo)', 'duration' => 282,
                'artist' => ['id' => 6, 'name' => 'MIEL SAN MARCOS'],
                'album' => ['id' => 4242, 'title' => 'Pentecostés (En Vivo)', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/y/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 21, 'release_date' => '2017-11-10', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Miel San Marcos', 'role' => 'Main'], ['name' => 'Josh Morales', 'role' => 'Featured']]]),
            'musicbrainz.org/ws/2/recording*' => Http::response(['recordings' => [[
                'id' => 'b1f3c2a0-0000-4000-8000-000000000003', 'score' => 100, 'title' => 'Danzo en el río', 'length' => 281000,
                'artist-credit' => [['name' => 'Miel San Marcos', 'artist' => ['id' => 'b1f3c2a0-0000-4000-8000-0000000000dd']]],
                'releases' => [['title' => 'Pentecostés', 'date' => '2017-11-10', 'status' => 'Official', 'track-count' => 21, 'release-group' => ['id' => 'rg-3', 'primary-type' => 'Album', 'secondary-types' => []]]],
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
