<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioEpisode;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RadioEpisodesTest extends TestCase
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

    public function test_episodes_have_their_own_permission(): void
    {
        $this->assertContains('radio.episodes', Permissions::forTypes(['visuales']));
        $this->actingAs($this->admin('visuales', ['visuales']))->get(self::ADMIN.'/admin/radio/episodios')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Episodios')->where('maxDescription', 400));

        $editor = $this->admin('editor', ['atmosfera'], ['radio.episodes']);
        $this->actingAs($editor)->get(self::ADMIN.'/admin/radio/episodios')->assertOk();
        $this->actingAs($editor)->get(self::ADMIN.'/admin/radio/biblioteca')->assertRedirect('/admin');

        $other = $this->admin('atmosfera', ['atmosfera']);
        $this->actingAs($other)->get(self::ADMIN.'/admin/radio/episodios')->assertRedirect('/admin');
        $this->actingAs($other)->postJson(self::ADMIN.'/admin/radio/episodios', [])->assertForbidden();
    }

    public function test_a_library_audio_becomes_an_episode_on_the_public_radio_page(): void
    {
        $track = $this->track('Programa del domingo');
        $admin = $this->admin('visuales', ['visuales']);

        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio/episodios?audio='.$track->id)
            ->assertInertia(fn (AssertableInertia $page) => $page->where('prefill', $track->id));

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/episodios', [
            'track_id' => $track->id,
            'title' => 'La fe que mueve montañas',
            'program' => 'Mañanas con Zoe',
            'description' => 'Una conversación sobre la fe en tiempos difíciles.',
            'aired_on' => '2026-10-01',
            'published' => '1',
            'cover' => UploadedFile::fake()->image('caratula.jpg', 600, 600),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('ok', true);

        $episode = RadioEpisode::query()->sole();
        $this->assertSame($track->id, $episode->radio_track_id);
        $this->assertStringStartsWith('/media/radio/caratulas/', $episode->cover_path);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/episodios', [
            'track_id' => $track->id,
            'title' => 'Borrador',
            'aired_on' => '2026-10-02',
            'published' => '0',
        ], ['Accept' => 'application/json'])->assertOk();

        auth()->logout();
        $this->get(self::SITE.'/radio')->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Radio')
            ->has('episodes', 1)
            ->where('episodes.0.title', 'La fe que mueve montañas')
            ->where('episodes.0.program', 'Mañanas con Zoe')
            ->where('episodes.0.description', 'Una conversación sobre la fe en tiempos difíciles.')
            ->where('episodes.0.src', $track->file_path)
            ->where('episodes.0.cover', $episode->cover_path)
            ->where('episodes.0.aired_on', '2026-10-01'));
    }

    public function test_an_episode_can_bring_its_own_audio_and_the_library_keeps_it(): void
    {
        $admin = $this->admin('visuales', ['visuales']);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/episodios', [
            'title' => 'Jóvenes en la radio',
            'program' => 'Generación Zoe',
            'aired_on' => '2026-10-02',
            'duration' => '1800',
            'audio' => UploadedFile::fake()->create('jovenes.mp3', 400, 'audio/mpeg'),
        ], ['Accept' => 'application/json'])->assertOk();

        $track = RadioTrack::query()->sole();
        $this->assertSame('programa', $track->kind);
        $this->assertSame('Generación Zoe', $track->artist);
        $this->assertFalse($track->rotation);
        $this->assertTrue(RadioEpisode::query()->sole()->published);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/episodios', [
            'title' => 'Sin audio',
            'aired_on' => '2026-10-02',
        ])->assertStatus(422)->assertJsonPath('error', 'Elige el audio del episodio: uno de la biblioteca o sube uno nuevo.');

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/episodios', [
            'track_id' => $track->id,
            'title' => 'Muy largo',
            'aired_on' => '2026-10-02',
            'description' => str_repeat('a', 401),
        ])->assertStatus(422)->assertJsonPath('message', 'La descripción es corta: hasta 400 caracteres.');
        $this->assertSame(1, RadioEpisode::query()->count());
    }

    public function test_uploading_to_the_library_can_publish_the_audio_as_an_episode(): void
    {
        $admin = $this->admin('visuales', ['visuales']);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Palabra de vida',
            'artist' => 'Pastor Juan',
            'kind' => 'programa',
            'duration' => '1500',
            'audio' => UploadedFile::fake()->create('palabra.mp3', 300, 'audio/mpeg'),
            'episode' => '1',
            'episode_description' => 'Enseñanza del domingo.',
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('message', 'Audio guardado en la biblioteca y publicado como episodio en la página de la radio.');

        $episode = RadioEpisode::query()->sole();
        $this->assertSame('Palabra de vida', $episode->title);
        $this->assertSame('Pastor Juan', $episode->program);
        $this->assertSame('Enseñanza del domingo.', $episode->description);
        $this->assertSame('2026-10-02', $episode->aired_on->toDateString());

        $librarian = $this->admin('bibliotecario', ['atmosfera'], ['radio.library']);
        $this->actingAs($librarian)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Sin permiso de episodios',
            'kind' => 'programa',
            'duration' => '60',
            'audio' => UploadedFile::fake()->create('otro.mp3', 50, 'audio/mpeg'),
            'episode' => '1',
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame(1, RadioEpisode::query()->count());

        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio/biblioteca')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('tracks', fn ($tracks) => collect($tracks)->firstWhere('title', 'Palabra de vida')['episodes'] === 1));
    }

    public function test_removing_an_episode_keeps_the_audio_and_deleting_the_audio_removes_the_episode(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $first = RadioEpisode::query()->create(['radio_track_id' => $this->track('Uno')->id, 'title' => 'Uno', 'aired_on' => '2026-10-01']);
        $second = RadioEpisode::query()->create(['radio_track_id' => $this->track('Dos')->id, 'title' => 'Dos', 'aired_on' => '2026-10-01']);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/episodios/eliminar', ['id' => $first->id])->assertOk();
        $this->assertModelMissing($first);
        $this->assertSame(2, RadioTrack::query()->count());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/biblioteca/eliminar', ['id' => $second->radio_track_id])->assertOk();
        $this->assertModelMissing($second);
    }

    private function track(string $title): RadioTrack
    {
        return RadioTrack::query()->create([
            'kind' => 'programa',
            'title' => $title,
            'file_path' => '/media/radio/programa/'.str()->slug($title).'.mp3',
            'duration' => 1200,
            'rotation' => false,
            'active' => true,
        ]);
    }

    private function admin(string $username, array $types, ?array $permissions = null): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => $permissions ?? Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
