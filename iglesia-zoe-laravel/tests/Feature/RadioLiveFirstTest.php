<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RadioLiveFirstTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        $this->at('15:00:00');
        $this->track('Canción', 240, rotation: true);
        $this->track('Otra', 250, rotation: true);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_the_automatic_music_plays_a_list_or_random_songs(): void
    {
        $list = RadioPlaylist::query()->create(['name' => 'Alabanza', 'sort_order' => 0]);
        $list->tracks()->attach($this->track('Alabanza 1', 200)->id, ['position' => 1]);
        $console = $this->admin(['radio.console']);

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $list->id, 'shuffle' => '0',
        ])->assertOk()->assertJsonPath('autopilot.label', 'Alabanza')->assertJsonPath('autopilot.shuffle', false)
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'lista «Alabanza» en orden'));

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => '', 'shuffle' => '0',
        ])->assertOk()->assertJsonPath('autopilot.label', 'Canciones aleatorias')->assertJsonPath('autopilot.shuffle', true)
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'canciones aleatorias'));
    }

    public function test_the_console_warns_about_what_starts_within_fifteen_minutes(): void
    {
        $this->slot('15:10:00', 'Aviso de la cena', 120);
        $this->slot('15:30:00', 'Prédica', 600, 'programa');

        $upcoming = $this->signal('upcoming');
        $this->assertCount(1, $upcoming);
        $this->assertSame('Aviso de la cena', $upcoming[0]['title']);
        $this->assertSame($this->ms('15:10:00'), $upcoming[0]['start']);
        $this->assertFalse($upcoming[0]['held']);

        $this->at('15:16:00');
        $this->assertSame(['Prédica'], array_column($this->signal('upcoming'), 'title'), 'What already started is no longer a warning.');
    }

    public function test_scheduled_audios_wait_for_the_live_transmission_and_play_when_it_ends(): void
    {
        $this->slot('15:10:00', 'Aviso de la cena', 120);
        $this->slot('15:12:00', 'Prédica', 600, 'programa');
        $this->slot('15:27:00', 'Cierre', 60);
        $console = $this->admin(['radio.console']);
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'host' => 'Ana'])->assertOk();

        $this->at('15:11:00');
        $queue = $this->signal('radio.queue');
        $this->assertNotContains('Aviso de la cena', array_column($queue, 'title'), 'The live transmission stays on top.');
        $upcoming = $this->signal('upcoming');
        $this->assertSame(['Aviso de la cena', 'Prédica'], array_column($upcoming, 'title'));
        $this->assertTrue($upcoming[0]['held']);

        $this->at('15:20:00');
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'stop'])->assertOk();

        $resumed = $this->ms('15:20:00') + 400;
        $this->assertSame($resumed, $this->startOf('Aviso de la cena'), 'The held audios go on air when the host hangs up.');
        $this->assertSame($resumed + 120000, $this->startOf('Prédica'));
        $this->assertSame($resumed + 720000, $this->startOf('Cierre'), 'What came next is pushed back.');
        $this->assertContains('Aviso de la cena', array_column($this->state('queue'), 'title'));
    }

    public function test_the_warning_reprograms_a_block(): void
    {
        $slot = $this->slot('15:10:00', 'Aviso de la cena', 120);
        $this->slot('15:40:00', 'Prédica', 600, 'programa');
        $console = $this->admin(['radio.console']);

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/reprogramar', ['id' => $slot->id, 'mode' => 'shift', 'minutes' => 15])
            ->assertOk()->assertJsonPath('message', '«Aviso de la cena» quedó para las 15:25.');
        $this->assertSame($this->ms('15:25:00'), $this->startOf('Aviso de la cena'));

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/reprogramar', ['id' => $slot->id, 'mode' => 'at', 'time' => '15:39'])
            ->assertStatus(422)->assertJsonPath('error', fn (string $error) => str_starts_with($error, 'Se cruza con «Prédica»'));
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/reprogramar', ['id' => $slot->id, 'mode' => 'at', 'time' => '14:00'])
            ->assertStatus(422)->assertJsonPath('error', 'Esa hora ya pasó. Elige una hora futura.');
        $this->assertSame($this->ms('15:25:00'), $this->startOf('Aviso de la cena'));

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/reprogramar', ['id' => $slot->id, 'mode' => 'at', 'time' => '18:30'])->assertOk();
        $this->assertSame($this->ms('18:30:00'), $this->startOf('Aviso de la cena'));
    }

    /** What the console receives on each heartbeat. */
    private function signal(string $key): mixed
    {
        return $this->actingAs($this->admin(['radio.console'], 'consola'))->getJson(self::ADMIN.'/admin/radio/senal')->assertOk()->json($key);
    }

    /** What a listener receives (as a guest: signed-in admins are sent to their own door). */
    private function state(string $key): mixed
    {
        auth()->guard('web')->forgetUser();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json($key);
    }

    private function startOf(string $title): int
    {
        return RadioSlot::query()->where('title', $title)->sole()->starts_at->getTimestampMs();
    }

    private function slot(string $time, string $title, float $seconds, string $kind = 'anuncio'): RadioSlot
    {
        $track = RadioTrack::query()->create([
            'kind' => $kind, 'title' => $title, 'file_path' => '/media/radio/'.$kind.'/'.str($title)->slug().'.mp3', 'duration' => $seconds, 'active' => true,
        ]);

        return RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ)->utc(),
            'duration' => $seconds, 'kind' => $kind, 'radio_track_id' => $track->id, 'title' => $title,
        ]);
    }

    private function track(string $title, float $duration, bool $rotation = false): RadioTrack
    {
        return RadioTrack::query()->create([
            'kind' => 'musica',
            'title' => $title,
            'file_path' => '/media/radio/musica/'.str($title)->slug().'.mp3',
            'duration' => $duration,
            'rotation' => $rotation,
            'active' => true,
        ]);
    }

    private function at(string $time, string $date = '2026-10-02'): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse("{$date} {$time}", Station::TZ));
    }

    private function ms(string $time, string $date = '2026-10-02'): int
    {
        return CarbonImmutable::parse("{$date} {$time}", Station::TZ)->getTimestampMs();
    }

    private function admin(array $permissions, string $username = 'radio'): User
    {
        return User::query()->firstOrCreate(['username' => $username], [
            'name' => ucfirst($username),
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['atmosfera'],
            'permissions' => array_values(array_intersect($permissions, Permissions::RADIO)),
            'active' => true,
        ]);
    }
}
