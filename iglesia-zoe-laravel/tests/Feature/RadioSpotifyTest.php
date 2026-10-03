<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Spotify;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioSpotifyPlaylist;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RadioSpotifyTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const ID = '37i9dQZF1DXcBWIGoYBM5M';

    public function test_share_links_uris_and_bare_ids_are_understood(): void
    {
        foreach ([
            'https://open.spotify.com/playlist/'.self::ID.'?si=abc123',
            'https://open.spotify.com/intl-es/playlist/'.self::ID,
            'open.spotify.com/embed/playlist/'.self::ID,
            'spotify:playlist:'.self::ID,
            ' '.self::ID.' ',
        ] as $link) {
            $this->assertSame(self::ID, Spotify::playlistId($link), $link);
        }
        $this->assertNull(Spotify::playlistId('https://open.spotify.com/album/'.self::ID));
        $this->assertNull(Spotify::playlistId('https://example.com/playlist/'.self::ID));
    }

    public function test_the_library_adds_a_playlist_with_its_public_name_and_cover(): void
    {
        $this->spotifyKnows();
        $librarian = $this->admin(['radio.library']);

        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/spotify/buscar', ['link' => 'https://open.spotify.com/playlist/'.self::ID])
            ->assertOk()->assertJsonPath('name', 'Alabanza Zoe')->assertJsonPath('cover', 'https://i.scdn.co/image/portada');

        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/spotify', [
            'link' => 'spotify:playlist:'.self::ID, 'description' => 'Para empezar el día.',
        ])->assertOk()->assertJsonPath('ok', true);

        $playlist = RadioSpotifyPlaylist::query()->sole();
        $this->assertSame(self::ID, $playlist->spotify_id);
        $this->assertSame('Alabanza Zoe', $playlist->name);
        $this->assertSame('https://i.scdn.co/image/portada', $playlist->cover_url);
        $this->assertTrue($playlist->published);

        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/spotify', ['link' => self::ID, 'name' => 'Otra'])
            ->assertStatus(422)->assertJsonPath('error', 'Esa playlist ya está agregada como «Alabanza Zoe».');
    }

    public function test_bad_links_and_unknown_playlists_are_rejected(): void
    {
        Http::fake(['open.spotify.com/oembed*' => Http::response(['error' => 'not found'], 404)]);
        $librarian = $this->admin(['radio.library']);

        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/spotify', ['link' => 'https://youtube.com/watch?v=1'])
            ->assertStatus(422)->assertJsonPath('error', fn (string $error) => str_starts_with($error, 'Pega el enlace de una playlist'));
        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/spotify', ['link' => self::ID])
            ->assertStatus(422)->assertJsonPath('error', fn (string $error) => str_starts_with($error, 'Spotify no encuentra esa playlist'));
        $this->assertSame(0, RadioSpotifyPlaylist::query()->count());
    }

    public function test_only_the_library_area_manages_the_playlists(): void
    {
        $this->actingAs($this->admin(['radio.library']))->get(self::ADMIN.'/admin/radio/spotify')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Spotify'));

        $scheduler = $this->admin(['radio.schedule'], 'programador');
        $this->actingAs($scheduler)->getJson(self::ADMIN.'/admin/radio/spotify')->assertForbidden();
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/spotify', ['link' => self::ID])->assertForbidden();
    }

    public function test_the_radio_page_shows_only_published_playlists_in_order(): void
    {
        RadioSpotifyPlaylist::query()->create(['spotify_id' => '1111111111111111111111', 'name' => 'Segunda', 'sort_order' => 2]);
        RadioSpotifyPlaylist::query()->create(['spotify_id' => '2222222222222222222222', 'name' => 'Primera', 'sort_order' => 1]);
        RadioSpotifyPlaylist::query()->create(['spotify_id' => '3333333333333333333333', 'name' => 'Oculta', 'sort_order' => 0, 'published' => false]);

        $this->get('http://localhost/radio')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Radio')
            ->has('spotify', 2)
            ->where('spotify.0.name', 'Primera')
            ->where('spotify.0.url', 'https://open.spotify.com/playlist/2222222222222222222222')
            ->where('spotify.1.name', 'Segunda'));
    }

    private function spotifyKnows(): void
    {
        Http::fake(['open.spotify.com/oembed*' => Http::response([
            'title' => 'Alabanza Zoe', 'thumbnail_url' => 'https://i.scdn.co/image/portada',
        ])]);
    }

    private function admin(array $permissions, string $username = 'radio'): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['atmosfera'],
            'permissions' => array_values(array_intersect($permissions, Permissions::RADIO)),
            'active' => true,
        ]);
    }
}
