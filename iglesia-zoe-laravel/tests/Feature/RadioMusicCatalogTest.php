<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Catalog\Artists;
use App\Domain\Radio\Catalog\Genres;
use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Text;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioArtist;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/** The genres (musical styles) and artists that classify the songs of the radio. */
class RadioMusicCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_the_library_starts_with_hundreds_of_genres_and_the_christian_artists_with_their_genres(): void
    {
        $this->assertGreaterThanOrEqual(200, RadioGenre::query()->count());
        foreach (array_keys(Genres::FAMILIES) as $family) {
            $this->assertTrue(RadioGenre::query()->where('family', $family)->exists(), "La familia {$family} no tiene géneros.");
        }

        $owners = [];
        foreach (Genres::all() as $genres) {
            foreach ($genres as [$name, $aliases]) {
                foreach ([$name, ...$aliases] as $alias) {
                    $owner = $owners[Text::key($alias)] ?? $name;
                    $this->assertSame($name, $owner, "«{$alias}» es nombre de {$owner} y de {$name}.");
                    $owners[Text::key($alias)] = $name;
                }
            }
        }
        foreach (Genres::CHRISTIAN as $secular => $christian) {
            $this->assertSame([$secular, $christian], [MusicCatalog::genre($secular)?->name, MusicCatalog::genre($christian)?->name]);
        }

        $this->assertSame(count(Artists::all()), RadioArtist::query()->where('source', 'catalogo')->count());
        foreach (Artists::all() as [$name, $kind, $country, $genres]) {
            $artist = MusicCatalog::artist($name);
            $this->assertSame($genres, $artist->genres->pluck('name')->all(), "Géneros de {$name}.");
        }
        $this->assertSame(['agrupacion', 'VE', ['Pop rock alternativo', 'Pop progresivo']], [MusicCatalog::artist('Montesanto')->kind, MusicCatalog::artist('Montesanto')->country, MusicCatalog::artist('Montesanto')->genres->pluck('name')->all()]);
        $this->assertTrue(MusicCatalog::artist('Daddy Yankee')->convert);
        $this->assertSame('Héctor Delgado', MusicCatalog::artist('Hector el Father')->name);
    }

    public function test_genre_tags_of_the_internet_land_on_the_spanish_genre(): void
    {
        $this->assertSame('Pop progresivo', MusicCatalog::genre('progressive pop')->name);
        $this->assertSame('Pop rock alternativo', MusicCatalog::genre('Alternative Pop/Rock')->name);
        $this->assertSame('Rap cristiano', MusicCatalog::genre('Christian hip hop')->name);
        $this->assertSame('Trap cristiano', MusicCatalog::genre('Christian trap music')->name);
        $this->assertSame('Cristiana contemporánea (CCM)', MusicCatalog::genre('contemporary Christian music')->name);
        $this->assertSame('Música cristiana', MusicCatalog::genre('Christian & Gospel')->name);
        $this->assertNull(MusicCatalog::genre('Latin'));
    }

    public function test_reloading_the_catalog_adds_nothing_twice_and_keeps_the_admin_changes(): void
    {
        $montesanto = MusicCatalog::artist('Montesanto');
        MusicCatalog::attachGenres($montesanto, RadioGenre::query()->where('name', 'Adoración')->get());

        $this->artisan('radio:catalog')->expectsOutputToContain('0 géneros y 0 artistas agregados.')->assertSuccessful();

        $this->assertSame(['Adoración'], $montesanto->genres()->pluck('name')->all());
    }

    public function test_the_admin_adds_edits_and_removes_genres_and_artists(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio/catalogo')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Catalogo')
                ->has('genres', RadioGenre::query()->count())->has('artists', RadioArtist::query()->count())->where('families', Genres::FAMILIES));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/genero', ['name' => 'Worship pop', 'family' => 'cristiana', 'aliases' => 'pop worship, pop de adoración'])->assertOk();
        $created = RadioGenre::query()->where('name', 'Worship pop')->sole();
        $this->assertTrue($created->custom);
        $this->assertSame($created->id, MusicCatalog::genre('pop de adoración')->id);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/genero', ['name' => 'Christian rock', 'family' => 'cristiana'])
            ->assertUnprocessable()->assertJsonPath('error', '«Christian rock» ya es otro nombre de «Rock cristiano».');

        $worship = RadioGenre::query()->where('name', 'Adoración')->sole();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/artista', [
            'name' => 'Grupo Nuevo', 'aliases' => 'GN', 'kind' => 'agrupacion', 'country' => 'pe', 'genre_ids' => [$created->id, $worship->id],
        ])->assertOk();
        $artist = MusicCatalog::artist('gn');
        $this->assertSame(['Grupo Nuevo', 'PE', 'manual'], [$artist->name, $artist->country, $artist->source]);
        $this->assertSame(['Worship pop', 'Adoración'], $artist->genres->pluck('name')->all());
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/artista', ['id' => $artist->id, 'name' => 'Grupo Nuevo', 'aliases' => 'Marcos Witt'])
            ->assertUnprocessable()->assertJsonPath('error', '«Marcos Witt» ya es un nombre de Marcos Witt.');

        $song = RadioTrack::query()->create(['kind' => 'musica', 'title' => 'Canción', 'artist' => 'Grupo Nuevo', 'file_path' => '/media/radio/musica/a.mp3', 'duration' => 200, 'rotation' => false, 'duck' => false, 'active' => true]);
        $song->genres()->attach($created->id, ['position' => 0]);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/genero/eliminar', ['id' => $created->id])
            ->assertOk()->assertJsonPath('message', 'Género eliminado y quitado de 1 canción.');
        $this->assertSame([], $song->genres()->pluck('name')->all());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/catalogo/artista/eliminar', ['id' => $artist->id])->assertOk();
        $this->assertNull(RadioArtist::query()->find($artist->id));
        $this->assertNotNull($song->fresh());
    }

    private function admin(): User
    {
        return User::query()->create([
            'username' => 'visuales',
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
