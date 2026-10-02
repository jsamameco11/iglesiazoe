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

    public function test_visuales_runs_the_radio_and_others_need_the_permission(): void
    {
        $this->assertContains('radio.manage', Permissions::forTypes(['visuales']));
        $this->assertNotContains('radio.manage', Permissions::forTypes(['atmosfera']));

        $visuales = $this->admin('visuales', ['visuales']);
        foreach (['/admin/radio', '/admin/radio/programacion', '/admin/radio/biblioteca', '/admin/radio/ajustes'] as $page) {
            $this->actingAs($visuales)->get(self::ADMIN.$page)->assertOk();
        }
        $this->actingAs($visuales)->get(self::ADMIN.'/admin/radio')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Consola')->where('config.name', 'Radio Zoe'));

        $other = $this->admin('atmosfera', ['atmosfera']);
        $this->actingAs($other)->get(self::ADMIN.'/admin/radio')->assertRedirect('/admin');
        $this->actingAs($other)->getJson(self::ADMIN.'/admin/radio/senal')->assertForbidden();
    }

    public function test_audio_is_uploaded_to_the_library_and_rejects_other_files(): void
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
        $this->assertTrue($track->rotation);
        $this->assertStringStartsWith('/media/radio/musica/', $track->file_path);

        $this->actingAs($admin)->post(self::ADMIN.'/admin/radio/biblioteca', [
            'title' => 'Documento',
            'kind' => 'musica',
            'duration' => '10',
            'audio' => UploadedFile::fake()->create('notas.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertSame(1, RadioTrack::query()->count());
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
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'date' => '2026-10-02', 'mode' => 'now', 'tracks' => [$spot->id, $spot->id, $spot->id],
        ])->assertOk();

        $first = RadioSlot::query()->where('radio_track_id', $song->id)->sole();
        $this->assertSame('16:00:30', $first->starts_at->setTimezone(Station::TZ)->format('H:i:s'));
        $this->assertSame('16:04:00', $live->fresh()->starts_at->setTimezone(Station::TZ)->format('H:i:s'));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion/copiar', [
            'date' => '2026-10-02', 'targets' => ['2026-10-03', '2026-10-04'],
        ])->assertOk();
        $this->assertSame(18, RadioSlot::query()->count());
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

    public function test_the_console_goes_live_and_connects_a_listener_through_the_handshake(): void
    {
        $admin = $this->admin('visuales', ['visuales']);
        $fx = $this->track('Aplausos', 'efecto', 4);
        $listener = '6f1c3a52-8d2e-4b7a-9c1d-2e3f4a5b6c7d';

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'mix', 'music' => 20])->assertStatus(409);
        $session = $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'host' => 'Pastor Luis'])
            ->assertOk()->json('live.session');
        $this->assertNotEmpty($session);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'mix', 'bed' => '1', 'mic' => '1'])->assertOk();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/efecto', ['id' => $fx->id])->assertOk();

        auth()->logout();
        $state = $this->getJson(self::SITE.'/radio/estado?oyente='.$listener)->assertOk();
        $state->assertJsonPath('live.on', true)->assertJsonPath('live.mic', true)->assertJsonPath('live.host', 'Pastor Luis')
            ->assertJsonPath('mix.music', 0.22)->assertJsonPath('live.fx.0.title', 'Aplausos');
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

    private function track(string $title, string $kind, float $duration): RadioTrack
    {
        return RadioTrack::query()->create([
            'kind' => $kind,
            'title' => $title,
            'file_path' => '/media/radio/'.$kind.'/'.str($title)->slug().'.mp3',
            'duration' => $duration,
            'rotation' => true,
            'active' => true,
        ]);
    }

    private function admin(string $username, array $types): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
