<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioListener;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RadioTest extends TestCase
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

    public function test_each_radio_area_has_its_own_permission(): void
    {
        $this->assertEqualsCanonicalizing(Permissions::RADIO, array_values(array_intersect(Permissions::forTypes(['visuales']), Permissions::RADIO)));
        $this->assertEmpty(array_intersect(Permissions::forTypes(['atmosfera']), Permissions::RADIO));

        $visuales = $this->admin('visuales', ['visuales']);
        foreach (['/admin/radio', '/admin/radio/programacion', '/admin/radio/biblioteca', '/admin/radio/ajustes'] as $page) {
            $this->actingAs($visuales)->get(self::ADMIN.$page)->assertOk();
        }
        $this->actingAs($visuales)->get(self::ADMIN.'/admin/radio')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Consola')->where('config.name', 'Radio Zoe'));

        $scheduler = $this->admin('programador', ['atmosfera'], ['radio.schedule']);
        $this->actingAs($scheduler)->get(self::ADMIN.'/admin/radio/programacion')->assertOk();
        $this->actingAs($scheduler)->get(self::ADMIN.'/admin/radio')->assertRedirect('/admin');
        $this->actingAs($scheduler)->getJson(self::ADMIN.'/admin/radio/senal')->assertForbidden();
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/ajustes', [])->assertForbidden();

        $other = $this->admin('atmosfera', ['atmosfera']);
        $this->actingAs($other)->get(self::ADMIN.'/admin/radio/biblioteca')->assertRedirect('/admin');
    }

    public function test_uploading_only_stores_the_audio_and_nothing_goes_on_air(): void
    {
        $admin = $this->admin('visuales', ['visuales']);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Cuán grande es Él',
            'artist' => 'Coro Zoe',
            'kind' => 'musica',
            'duration' => '245.4',
            'rotation' => '1',
            'audio' => UploadedFile::fake()->create('cuan-grande.mp3', 300, 'audio/mpeg'),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('ok', true);

        $track = RadioTrack::query()->sole();
        $this->assertSame('musica', $track->kind);
        $this->assertSame(245.4, $track->duration);
        $this->assertFalse($track->rotation);
        $this->assertFalse($track->duck);
        $this->assertStringStartsWith('/media/radio/musica/', $track->file_path);
        $this->assertSame('library', Station::autopilot()['level'], 'It is not added to the continuous music: it only sounds as the last resort, when the radio has no other music.');

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Retiro de jóvenes',
            'kind' => 'anuncio',
            'duration' => '30',
            'audio' => UploadedFile::fake()->create('retiro.mp3', 50, 'audio/mpeg'),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertTrue(RadioTrack::query()->where('kind', 'anuncio')->sole()->duck);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Documento',
            'artist' => 'Coro Zoe',
            'kind' => 'musica',
            'duration' => '10',
            'audio' => UploadedFile::fake()->create('notas.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertSame(2, RadioTrack::query()->count());
    }

    public function test_the_continuous_music_is_chosen_in_the_schedule(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $first = $this->track('Canción 1', 'musica', 200, false);
        $second = $this->track('Canción 2', 'musica', 200, false);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion/rotacion', ['tracks' => [$first->id]])->assertOk();
        $this->assertTrue($first->fresh()->rotation);
        $this->assertFalse($second->fresh()->rotation);
        auth()->logout();
        $this->getJson(self::SITE.'/radio/estado')->assertJsonPath('queue.0.title', 'Canción 1');
    }

    public function test_the_timeline_rejects_overlaps_appends_and_pushes_blocks_when_going_on_air_now(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $song = $this->track('Canción', 'musica', 180);
        $spot = $this->track('Anuncio del retiro', 'anuncio', 30);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:00', 'tracks' => [$song->id, $spot->id],
        ])->assertOk();
        $this->assertSame(2, RadioSlot::query()->count());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:02', 'tracks' => [$song->id],
        ])->assertUnprocessable()->assertJsonPath('error', fn ($error) => str_contains($error, 'Canción'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'end', 'type' => 'vivo', 'title' => 'Tarde de oración', 'minutes' => 30, 'bed' => '1',
        ])->assertOk();
        $live = RadioSlot::query()->where('kind', 'vivo')->sole();
        $this->assertSame('16:03:30', $live->starts_at->setTimezone(Station::TZ)->format('H:i:s'));
        $this->assertTrue($live->bed);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '14:00', 'tracks' => [$song->id],
        ])->assertUnprocessable();

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:59:00', Station::TZ));
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/lanzar', ['tracks' => [$spot->id, $spot->id, $spot->id]])->assertOk();

        $first = RadioSlot::query()->where('radio_track_id', $song->id)->sole();
        $this->assertSame('16:00:30', $first->starts_at->setTimezone(Station::TZ)->format('H:i:s'));
        $this->assertSame('16:04:00', $live->fresh()->starts_at->setTimezone(Station::TZ)->format('H:i:s'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion/copiar', [
            'date' => '2026-10-02', 'targets' => ['2026-10-03', '2026-10-04'],
        ])->assertOk();
        $this->assertSame(18, RadioSlot::query()->count());
    }

    public function test_overlay_layers_play_on_top_without_moving_the_main_program(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $song = $this->track('Canción', 'musica', 180);
        $spot = $this->track('Anuncio del retiro', 'anuncio', 30, false, true);
        $chime = $this->track('Campana', 'efecto', 3, false);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:00', 'tracks' => [$song->id],
        ])->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:01', 'layer' => 1, 'volume' => 80, 'tracks' => [$spot->id],
        ])->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:01:10', 'layer' => 1, 'tracks' => [$chime->id],
        ])->assertUnprocessable()->assertJsonPath('error', fn ($error) => str_contains($error, 'capa 1'));
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:01:10', 'layer' => 2, 'duck' => '1', 'tracks' => [$chime->id],
        ])->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'end', 'layer' => 1, 'type' => 'vivo', 'title' => 'En vivo', 'minutes' => 10,
        ])->assertUnprocessable();

        $overlay = RadioSlot::query()->where('radio_track_id', $spot->id)->sole();
        $this->assertSame(1, $overlay->layer);
        $this->assertSame(80, $overlay->volume);
        $this->assertTrue($overlay->duck);
        $this->assertTrue(RadioSlot::query()->where('radio_track_id', $chime->id)->sole()->duck);

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 16:00:30', Station::TZ));
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/lanzar', ['tracks' => [$chime->id]])->assertOk();
        $this->assertSame('16:01:00', $overlay->fresh()->starts_at->setTimezone(Station::TZ)->format('H:i:s'));

        auth()->logout();
        $state = $this->getJson(self::SITE.'/radio/estado')->assertOk();
        $state->assertJsonPath('queue.0.title', 'Canción')->assertJsonPath('queue.1.title', 'Campana');
        $state->assertJsonPath('layers.0.title', 'Anuncio del retiro')->assertJsonPath('layers.0.lane', '1')->assertJsonPath('layers.0.volume', 80);
    }

    public function test_everybody_hears_the_same_program_with_music_filling_the_gaps(): void
    {
        $songs = collect(range(1, 4))->map(fn ($n) => $this->track("Canción {$n}", 'musica', 200 + $n));
        $program = $this->track('Prédica del domingo', 'programa', 1800);
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 14:50:00', Station::TZ)->utc(),
            'duration' => 1800, 'kind' => 'programa', 'radio_track_id' => $program->id, 'title' => $program->title,
        ]);

        $state = $this->getJson(self::SITE.'/radio/estado')->assertOk()->json();
        $this->assertSame('Prédica del domingo', $state['queue'][0]['title']);
        $this->assertEqualsWithDelta(600, $state['queue'][0]['seek'], 0.01);
        $this->assertSame('musica', $state['queue'][1]['kind']);
        $this->assertSame(CarbonImmutable::parse('2026-10-02 15:20:00', Station::TZ)->getTimestampMs(), $state['queue'][1]['start']);
        $this->assertEquals(0, $state['queue'][1]['seek']);
        $this->assertContains($state['previous']['title'], $songs->pluck('title')->all());

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:25:00', Station::TZ));
        $a = $this->getJson(self::SITE.'/radio/estado')->json('queue.0');
        $b = $this->getJson(self::SITE.'/radio/estado')->json('queue.0');
        $this->assertSame($a['id'], $b['id']);
        $this->assertContains($a['title'], $songs->pluck('title')->all());

        $this->get(self::SITE.'/radio')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Radio')
            ->where('radio.name', 'Radio Zoe')
            ->has('program', 2)
            ->where('program.0.date', '2026-10-02'));
    }

    public function test_continuous_music_crossfades_the_songs(): void
    {
        $this->track('Canción 1', 'musica', 200);
        $this->track('Canción 2', 'musica', 200);
        Station::saveConfig(['crossfade' => 5]);

        $queue = $this->getJson(self::SITE.'/radio/estado')->json('queue');
        $this->assertSame($queue[0]['origin'] + 195000, $queue[1]['origin']);
        $this->assertSame($queue[1]['start'] + 5000, $queue[0]['end']);
    }

    public function test_the_console_plays_pads_and_players_on_top_of_the_program(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $applause = $this->track('Aplausos', 'efecto', 4, false);
        $spot = $this->track('Anuncio', 'anuncio', 30, false, true);
        $other = $this->track('Otro anuncio', 'anuncio', 20, false, true);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/botonera', ['tracks' => [$applause->id]])
            ->assertOk()->assertJsonPath('pads.0.title', 'Aplausos');
        $this->actingAs($admin)->get(self::ADMIN.'/admin/radio')->assertInertia(fn (AssertableInertia $page) => $page->has('pads', 1));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $applause->id, 'lane' => 'pad'])->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $spot->id, 'lane' => 'A', 'volume' => 70])->assertOk();
        $layer = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $other->id, 'lane' => 'A', 'duck' => '0'])
            ->assertOk()->json('layer');
        $this->assertFalse($layer['duck']);

        auth()->logout();
        $layers = collect($this->getJson(self::SITE.'/radio/estado')->assertJsonPath('mix.duck', 0.25)->json('layers'));
        $this->assertSame(['Aplausos', 'Otro anuncio'], $layers->pluck('title')->all());

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'update', 'layer' => $layer['id'], 'volume' => 40, 'duck' => '1'])
            ->assertOk()->assertJsonPath('layer.volume', 40)->assertJsonPath('layer.duck', true);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'stop', 'lane' => 'A'])
            ->assertOk()->assertJsonPath('stopped', [$layer['id']]);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $spot->id, 'lane' => 'Z'])->assertUnprocessable();

        CarbonImmutable::setTestNow(CarbonImmutable::now()->addSeconds(5));
        auth()->logout();
        $this->getJson(self::SITE.'/radio/estado')->assertJsonPath('layers', []);
    }

    public function test_background_beds_loop_and_change_with_a_crossfade(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $pad = $this->track('Pad suave', 'musica', 40, false);
        $other = $this->track('Pad cálido', 'musica', 50, false);

        $first = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $pad->id, 'lane' => 'F1', 'volume' => 60, 'loop' => '1', 'fade_in' => 3, 'fade_out' => 3])
            ->assertOk()->json('layer');
        $this->assertTrue($first['loop']);
        $this->assertEquals(3, $first['fade_in']);
        $this->assertSame(40000, $first['length']);
        $this->assertGreaterThan($first['start'] + 3600 * 1000, $first['end']);

        $second = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'play', 'id' => $other->id, 'lane' => 'F1', 'loop' => '1', 'fade_in' => 5])
            ->assertOk()->json('layer');

        auth()->logout();
        $layers = collect($this->getJson(self::SITE.'/radio/estado')->json('layers'))->keyBy('id');
        $this->assertTrue($layers[$first['id']]['fading']);
        $this->assertSame($second['start'] + 5000, $layers[$first['id']]['end']);
        $this->assertArrayNotHasKey('fading', $layers[$second['id']]);

        $faded = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/capa', ['action' => 'stop', 'lane' => 'F1', 'fade' => 2])
            ->assertOk()->json('faded');
        $this->assertContains($second['id'], array_column($faded, 'id'));

        CarbonImmutable::setTestNow(CarbonImmutable::now()->addSeconds(6));
        auth()->logout();
        $this->getJson(self::SITE.'/radio/estado')->assertJsonPath('layers', []);
    }

    public function test_the_console_goes_live_and_connects_a_listener_through_the_handshake(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $listener = '6f1c3a52-8d2e-4b7a-9c1d-2e3f4a5b6c7d';

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'mix', 'mic' => '1'])->assertStatus(409);
        $session = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'host' => 'Pastor Luis'])
            ->assertOk()->json('live.session');
        $this->assertNotEmpty($session);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'mix', 'bed' => '1', 'mic' => '1', 'overlay' => 50])->assertOk();

        auth()->logout();
        $state = $this->getJson(self::SITE.'/radio/estado?oyente='.$listener)->assertOk();
        $state->assertJsonPath('live.on', true)->assertJsonPath('live.mic', true)->assertJsonPath('live.host', 'Pastor Luis')
            ->assertJsonPath('mix.music', 0.22)->assertJsonPath('mix.fx', 0.45);
        $this->postJson(self::SITE.'/radio/voz', ['oyente' => $listener, 'session' => $session])->assertOk();

        $signal = $this->actingAs($admin)->getJson(self::ADMIN.'/admin/radio/senal')->assertOk();
        $signal->assertJsonPath('pending', [$listener]);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/senal/oferta', ['id' => $listener, 'sdp' => 'v=0 offer'])->assertJsonPath('ok', true);

        auth()->logout();
        $this->getJson(self::SITE.'/radio/estado?oyente='.$listener)->assertJsonPath('voice.offer', 'v=0 offer');
        $this->postJson(self::SITE.'/radio/voz/respuesta', ['oyente' => $listener, 'session' => $session, 'sdp' => 'v=0 answer'])->assertOk();

        $this->actingAs($admin)->getJson(self::ADMIN.'/admin/radio/senal')
            ->assertJsonPath('answers.0.id', $listener)->assertJsonPath('answers.0.answer', 'v=0 answer');
        $this->assertSame('connected', RadioListener::query()->find($listener)->state);

        CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinute());
        auth()->logout();
        $this->getJson(self::SITE.'/radio/estado')->assertJsonPath('live.on', false)->assertJsonPath('mix.music', fn ($music) => (float) $music === 1.0);
    }

    public function test_a_song_repeats_only_when_it_is_switched_into_the_continuous_music(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $song = RadioTrack::query()->create(['kind' => 'musica', 'title' => 'Sublime gracia', 'file_path' => '/media/radio/musica/sublime.mp3', 'duration' => 200, 'active' => true]);
        $this->track('En rotación', 'musica', 180);
        $spot = $this->track('Cuña', 'anuncio', 30, false);
        $this->assertFalse($song->fresh()->rotation);
        $this->assertNotContains($song->id, array_column(Station::state()['queue'], 'track'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/biblioteca/rotacion', ['id' => $song->id, 'on' => '1'])->assertOk()->assertJsonPath('ok', true);
        $this->assertTrue($song->fresh()->rotation);
        $this->assertContains($song->id, array_column(Station::state()['queue'], 'track'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/biblioteca/rotacion', ['id' => $spot->id, 'on' => '1'])->assertStatus(422);
        $this->assertFalse($spot->fresh()->rotation);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/biblioteca/rotacion', ['id' => $song->id, 'on' => '0'])->assertOk();
        $this->assertFalse($song->fresh()->rotation);
        $this->assertNotContains($song->id, array_column(Station::state()['queue'], 'track'));
    }

    public function test_the_console_stops_a_repeating_song_and_pauses_the_continuous_music(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $loop = $this->track('Audio repetido', 'musica', 25);
        $this->track('Otra canción', 'musica', 180);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'autofill', 'on' => '0'])
            ->assertOk()->assertJsonPath('config.autofill', false)->assertJsonPath('radio.queue', []);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'autofill', 'on' => '1'])
            ->assertOk()->assertJsonPath('config.autofill', true);

        $response = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'drop', 'id' => $loop->id])->assertOk();
        $this->assertFalse($loop->fresh()->rotation);
        $this->assertNotContains($loop->id, array_column($response->json('radio.queue'), 'track'));
        $this->assertNotEmpty($response->json('radio.queue'));

        $scheduler = $this->admin('programador', ['atmosfera'], ['radio.schedule']);
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'autofill', 'on' => '0'])->assertForbidden();
    }

    private function track(string $title, string $kind, float $duration, bool $rotation = true, bool $duck = false): RadioTrack
    {
        return RadioTrack::query()->create([
            'kind' => $kind,
            'title' => $title,
            'file_path' => '/media/radio/'.$kind.'/'.str($title)->slug().'.mp3',
            'duration' => $duration,
            'rotation' => $rotation,
            'duck' => $duck,
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
