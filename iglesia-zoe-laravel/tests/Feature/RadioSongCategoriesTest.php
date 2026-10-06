<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Text;
use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Every song that is uploaded comes out classified: a clean name and author, a year when one is likely and always a genre. */
class RadioSongCategoriesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.music.musicbrainz_gap_ms' => 0]);
        Http::preventStrayRequests();
    }

    public function test_a_song_with_a_co_author_no_database_credits_is_still_identified(): void
    {
        Http::fake($this->montesanto());

        $result = $this->identify(['title' => 'Derramo el perfume', 'artist' => 'Montesanto', 'featured' => ['Invitado Nuevo'], 'duration' => '335.2'])
            ->assertOk()->json('result');

        $this->assertTrue($result['found']);
        $this->assertSame(['Invitado Nuevo', 'Averly Morillo'], $result['featured']);
        $this->assertSame('Bautizados En Fuego (LIVE)', $result['album']);
    }

    public function test_a_song_nobody_knows_still_gets_a_clean_name_and_the_radios_general_genre_marked_to_review(): void
    {
        $this->fakeNothingFound();

        $this->identify(['title' => 'La Bondad de Dios Video de Letras', 'artist' => 'Grupo Inventado'])
            ->assertOk()
            ->assertJsonPath('result.found', false)
            ->assertJsonPath('result.title', 'La Bondad de Dios')
            ->assertJsonPath('result.artist', 'Grupo Inventado')
            ->assertJsonPath('result.genres.0.name', 'Música cristiana')
            ->assertJsonPath('result.guessed', ['genres']);
    }

    public function test_co_authors_come_out_once_without_copy_numbers_or_live_labels(): void
    {
        $this->fakeNothingFound();

        $this->identify(['title' => 'Derramo el perfume', 'artist' => 'Montesanto', 'featured' => ['Averly Morillo (1)', 'Averly Morillo', 'Manny Montes (2)', 'Coalo Zamorano (Live)']])
            ->assertOk()
            ->assertJsonPath('result.featured', ['Averly Morillo', 'Manny Montes', 'Coalo Zamorano']);
    }

    public function test_a_cover_takes_the_genres_of_who_sang_it_first(): void
    {
        $this->fakeNothingFound();

        $this->identify(['title' => 'Tus Cuerdas de Amor (Julio Melgar - Cover)', 'artist' => 'Nezareth'])
            ->assertOk()
            ->assertJsonPath('result.title', 'Tus Cuerdas de Amor')
            ->assertJsonPath('result.genres', MusicCatalog::artist('Julio Melgar')->genres->map->brief()->all())
            ->assertJsonPath('result.guessed', []);
    }

    public function test_an_author_with_channel_labels_is_read_as_the_catalog_artist(): void
    {
        $this->fakeNothingFound();

        $this->identify(['title' => 'No me avergüenzo', 'artist' => 'Miel San Marcos - En Vivo'])
            ->assertOk()->assertJsonPath('result.artist', 'Miel San Marcos')->assertJsonPath('result.artist_info.known', true);
        $this->identify(['title' => 'Gracias', 'artist' => 'MarcosWittVEVO'])
            ->assertOk()->assertJsonPath('result.artist', 'Marcos Witt');
    }

    public function test_on_a_tie_between_two_artists_the_christian_version_wins(): void
    {
        $single = ['trackName' => 'Amor Sin Condición', 'collectionName' => 'Amor Sin Condición - Single', 'trackCount' => 1, 'trackTimeMillis' => 231000];
        Http::fake([
            'itunes.apple.com/search*' => Http::response(['results' => [
                $this->appleSong([...$single, 'trackId' => 1, 'collectionId' => 1, 'artistName' => 'Banda Secular', 'primaryGenreName' => 'K-Pop']),
                $this->appleSong([...$single, 'trackId' => 2, 'collectionId' => 2, 'artistName' => 'Coro de Alabanza', 'primaryGenreName' => 'Christian']),
            ]]),
            'api.deezer.com/*' => Http::response(['data' => []]),
            'musicbrainz.org/*' => Http::response(['recordings' => []]),
            'www.wikidata.org/*' => Http::response(['search' => []]),
        ]);

        $this->identify(['title' => 'Amor Sin Condición', 'duration' => '231'])
            ->assertOk()->assertJsonPath('result.found', true)->assertJsonPath('result.artist', 'Coro de Alabanza');
    }

    public function test_names_and_authors_lose_the_labels_videos_and_channels_add(): void
    {
        $this->assertSame('Libre Soy', Text::cleanTitle('Libre Soy Video Oficial Radical Live'));
        $this->assertSame('Eres todo poderoso', Text::cleanTitle('Eres todo poderoso con letra'));
        $this->assertSame('Renuévame', Text::cleanTitle('01 - Renuévame HD'));
        $this->assertSame('10.000 Razones', Text::cleanTitle('10.000 Razones'));
        $this->assertSame('Miel San Marcos', Text::cleanArtist('Miel San Marcos (En Vivo)'));
        $this->assertSame('Hillsong Worship', Text::cleanArtist('Hillsong Worship - Topic'));
        $this->assertSame('Marcos Witt', Text::cleanArtist('Marcos Witt Oficial'));
        $this->assertSame(['Julio Melgar'], Text::coverOf('Tus Cuerdas de Amor (Julio Melgar - Cover)'));
        $this->assertSame(['Jesus I Need You de Hillsong Worship', 'Hillsong Worship'], Text::coverOf('Jesús Te Necesito (Jesus I Need You de Hillsong Worship - Cover en español)'));
        $this->assertSame(['Marcos Witt'], Text::coverOf('Renuévame [Cover de Marcos Witt]'));
        $this->assertSame([], Text::coverOf('Renuévame (En Vivo)'));
    }

    private function fakeNothingFound(): void
    {
        Http::fake(['*' => Http::response(['results' => [], 'data' => [], 'recordings' => [], 'search' => []])]);
    }

    /** iTunes, Deezer and MusicBrainz answers for «Derramo el perfume» of Montesanto, whose guest two of them credit. */
    private function montesanto(): array
    {
        return [
            'itunes.apple.com/search*' => Http::response(['results' => [$this->appleSong([])]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 11, 'type' => 'track', 'title' => 'Derramo el Perfume (Live)', 'duration' => 335,
                'artist' => ['id' => 5, 'name' => 'Montesanto'],
                'album' => ['id' => 721749611, 'title' => 'Bautizados En Fuego (LIVE)', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/x/1000x1000.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'nb_tracks' => 10, 'release_date' => '2023-10-20', 'genres' => ['data' => []]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Montesanto', 'role' => 'Main'], ['name' => 'Averly Morillo', 'role' => 'Featured']]]),
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
            'primaryGenreName' => 'Christian',
            ...$values,
        ];
    }

    private function identify(array $fields): TestResponse
    {
        return $this->actingAs($this->admin())->postJson(self::ADMIN.'/admin/radio/biblioteca/identificar', $fields);
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
