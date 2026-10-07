<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Capture;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioEpisode;
use App\Models\RadioRecording;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RadioCaptureTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake(config('filesystems.media'));
        Process::fake();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:00:00', Station::TZ));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_finished_transmission_is_saved_as_programa_grabado_and_published_as_an_episode(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Domingo en Zoe',
            'program' => 'Mañanas con Zoe',
            'description' => 'Hablamos de la fe que sostiene en la semana.',
            'publish' => '1',
            'cover' => UploadedFile::fake()->image('caratula.jpg', 80, 80),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('message', 'Guardado como Programa grabado y publicado como episodio en la página de la radio.');

        $track = RadioTrack::query()->sole();
        $this->assertSame('programa', $track->kind);
        $this->assertSame('Domingo en Zoe', $track->title);
        $this->assertSame('Mañanas con Zoe', $track->artist);
        $this->assertTrue($track->active);
        $this->assertFalse($track->rotation);
        $this->assertTrue($track->duck);
        $this->assertGreaterThanOrEqual(1, $track->duration);
        $this->assertStringStartsWith('/media/radio/programa/', $track->file_path);
        $this->assertStringEndsWith('.webm', $track->file_path);
        Storage::disk(config('filesystems.media'))->assertExists(substr($track->file_path, strlen('/media/')));

        $episode = RadioEpisode::query()->sole();
        $this->assertTrue($episode->published);
        $this->assertSame($track->id, $episode->radio_track_id);
        $this->assertSame('Hablamos de la fe que sostiene en la semana.', $episode->description);
        $this->assertSame('Mañanas con Zoe', $episode->program);
        $this->assertSame('2026-10-02', $episode->aired_on->toDateString());
        $this->assertStringStartsWith('/media/radio/caratulas/', $episode->cover_path);
        $this->assertSame(Capture::SAVED, RadioRecording::query()->find($id)->status);
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Domingo en Zoe',
        ], ['Accept' => 'application/json'])->assertStatus(409);
        $this->assertSame(1, RadioTrack::query()->count());
        $this->assertFalse(Storage::disk('local')->exists('radio-recordings/'.$id.'/00000.part'));

        auth()->logout();
        $this->get(self::SITE.'/radio')->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Radio')
            ->has('episodes', 1)
            ->where('episodes.0.title', 'Domingo en Zoe')
            ->where('episodes.0.description', 'Hablamos de la fe que sostiene en la semana.')
            ->where('episodes.0.src', $track->file_path)
            ->where('episodes.0.cover', $episode->cover_path));
    }

    public function test_audio_without_episode_details_stays_in_the_library(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Reunión de oración',
            'publish' => '0',
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('message', 'Guardado como Programa grabado en la biblioteca. No aparece en la página hasta que lo publiques en Episodios.');

        $this->assertSame(1, RadioTrack::query()->count());
        $this->assertSame(0, RadioEpisode::query()->count());
    }

    public function test_a_description_without_publishing_keeps_the_episode_hidden(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Clase de discipulado',
            'description' => 'Repasamos el primer paso de la fe.',
            'publish' => '0',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertFalse(RadioEpisode::query()->sole()->published);
        auth()->logout();
        $this->get(self::SITE.'/radio')->assertInertia(fn (AssertableInertia $page) => $page->has('episodes', 0));
    }

    public function test_the_console_can_store_the_audio_without_the_episodes_permission(): void
    {
        $operator = $this->admin('locutor', ['visuales'], ['radio.console']);
        $id = $this->finish($operator);

        $this->actingAs($operator)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Culto grabado',
            'description' => 'Esto no debe crear un episodio.',
            'publish' => '1',
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('message', 'Audio guardado en la biblioteca como Programa grabado. Para mostrarlo en la página hace falta el permiso de Episodios.');

        $this->assertSame('programa', RadioTrack::query()->sole()->kind);
        $this->assertSame(0, RadioEpisode::query()->count());
    }

    public function test_chunks_keep_their_order_and_a_retry_does_not_duplicate_audio(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $session = Station::startLive('Host')['session'];
        $opened = $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'start',
            'session' => $session,
        ], ['Accept' => 'application/json'])->assertOk()->json('recording');

        $first = $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($opened['id'], 0, 5000), ['Accept' => 'application/json'])
            ->assertOk()->json('recording');
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($opened['id'], 0, 5000), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('code', 'have')->assertJsonPath('recording.bytes', $first['bytes']);
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($opened['id'], 2, 4000), ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'gap');
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($opened['id'], 1, 4000, false), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('recording.parts', 2);

        $other = $this->admin('otro', ['visuales']);
        $this->actingAs($other)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($opened['id'], 2, 1000), ['Accept' => 'application/json'])
            ->assertStatus(409);
    }

    public function test_invalid_or_too_short_audio_is_not_kept(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $session = Station::startLive('Host')['session'];
        $id = $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'start',
            'session' => $session,
        ], ['Accept' => 'application/json'])->assertOk()->json('recording.id');

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($id, 0, 100, false), ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->assertSame(0, RadioRecording::query()->find($id)->parts);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($id, 0, 100), ['Accept' => 'application/json'])->assertOk();
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'finish',
            'id' => $id,
            'duration' => '3',
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('recording.status', 'discarded');
        $this->assertSame(0, RadioTrack::query()->count());
    }

    public function test_a_ready_recording_blocks_the_next_one_until_it_is_saved_or_discarded(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);
        $session = Station::live()['session'];

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'start',
            'session' => $session,
        ], ['Accept' => 'application/json'])->assertStatus(409)->assertJsonPath('recording.status', 'ready');

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'discard',
            'id' => $id,
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame(Capture::DISCARDED, RadioRecording::query()->find($id)->status);
        $this->assertFalse(Storage::disk('local')->exists('radio-recordings/'.$id.'/00000.part'));

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'start',
            'session' => $session,
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('recording.status', 'recording');
    }

    public function test_a_deactivated_program_does_not_appear_as_an_episode(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);
        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'save',
            'id' => $id,
            'title' => 'Programa oculto',
            'description' => 'Quedó fuera de la página.',
            'publish' => '1',
        ], ['Accept' => 'application/json'])->assertOk();

        RadioTrack::query()->sole()->update(['active' => false]);
        auth()->logout();
        $this->get(self::SITE.'/radio')->assertInertia(fn (AssertableInertia $page) => $page->has('episodes', 0));
    }

    public function test_unsaved_recordings_are_purged_after_two_days(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $id = $this->finish($admin);
        RadioRecording::query()->whereKey($id)->update(['updated_at' => now()->subDays(3)]);

        $this->assertSame(1, Capture::purge());
        $this->assertSame(Capture::DISCARDED, RadioRecording::query()->find($id)->status);
        $this->assertFalse(Storage::disk('local')->exists('radio-recordings/'.$id.'/00000.part'));
    }

    public function test_the_console_shows_a_pending_capture_and_rejects_users_without_the_console(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('capture', null)
                ->where('canEpisodes', true)
                ->where('maxDescription', 400));

        $id = $this->finish($admin);
        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('capture.id', $id)->where('capture.status', 'ready'));

        $outsider = $this->admin('atmosfera', ['atmosfera']);
        $this->actingAs($outsider)->postJson(self::ADMIN.'/admin/radio/grabacion', ['action' => 'start'])->assertForbidden();
    }

    private function finish(User $user): string
    {
        $session = Station::startLive('Host')['session'];
        $id = $this->actingAs($user)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'start',
            'session' => $session,
        ], ['Accept' => 'application/json'])->assertOk()->json('recording.id');

        $this->actingAs($user)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($id, 0, 5000), ['Accept' => 'application/json'])->assertOk();
        $this->actingAs($user)->post(self::ADMIN.'/admin/radio/grabacion', $this->chunk($id, 1, 4000, false), ['Accept' => 'application/json'])->assertOk();
        $this->actingAs($user)->post(self::ADMIN.'/admin/radio/grabacion', [
            'action' => 'finish',
            'id' => $id,
            'duration' => '2',
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('recording.status', 'ready');

        return $id;
    }

    /** @return array<string, mixed> */
    private function chunk(string $id, int $index, int $bytes, bool $header = true): array
    {
        $body = ($header ? "\x1A\x45\xDF\xA3" : '').str_repeat('a', $bytes);

        return [
            'action' => 'chunk',
            'id' => $id,
            'index' => $index,
            'extension' => 'webm',
            'audio' => UploadedFile::fake()->createWithContent('tramo-'.$index.'.webm', $body),
        ];
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
