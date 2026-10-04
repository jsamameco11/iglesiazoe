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
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RadioAutomationTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        $this->at('15:00:00');
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_shuffled_playlist_plays_every_song_once_per_cycle_and_reshuffles_the_next(): void
    {
        $list = $this->playlist('Alabanza', 5);
        Station::saveConfig(['auto_playlist' => $list->id, 'auto_shuffle' => true, 'crossfade' => 0]);

        $titles = $this->songsFrom('15:00:00', 15);
        $first = array_slice($titles, 0, 5);
        $second = array_slice($titles, 5, 5);
        $third = array_slice($titles, 10, 5);
        $all = $list->tracks()->pluck('title')->all();

        foreach ([$first, $second, $third] as $cycle) {
            $this->assertEqualsCanonicalizing($all, $cycle, 'Each cycle plays every song of the list once.');
        }
        $this->assertNotSame($second[0], $first[4], 'A cycle never opens with the song that closed the previous one.');
        $this->assertNotSame($third[0], $second[4]);
        $this->assertNotEquals([$first, $second], [$second, $third], 'Each cycle draws a new order.');
    }

    public function test_an_ordered_playlist_follows_the_list_and_starts_over(): void
    {
        $list = $this->playlist('Adoración', 3);
        $this->track('Fuera de la lista', 200, rotation: true);
        Station::saveConfig(['auto_playlist' => $list->id, 'auto_shuffle' => false, 'crossfade' => 0]);

        $order = $list->tracks()->pluck('title')->all();
        $titles = $this->songsFrom('15:00:00', 7);
        $start = array_search($titles[0], $order, true);
        foreach ($titles as $index => $title) {
            $this->assertSame($order[($start + $index) % 3], $title);
        }
    }

    public function test_all_lists_join_every_playlist_and_the_continuous_music(): void
    {
        $a = $this->playlist('A', 2);
        $b = $this->playlist('B', 2);
        $this->track('Suelta', 200, rotation: true);
        $this->track('Apagada', 200, rotation: false);
        Station::saveConfig(['auto_playlist' => null, 'crossfade' => 0]);

        $titles = array_slice($this->songsFrom('15:00:00', 10), 0, 5);
        $this->assertEqualsCanonicalizing([...$a->tracks()->pluck('title'), ...$b->tracks()->pluck('title'), 'Suelta'], $titles);
    }

    public function test_an_automatic_period_plays_its_playlist_from_one_time_to_another(): void
    {
        $this->track('General', 200, rotation: true);
        $list = $this->playlist('Mañanas', 3);
        $admin = $this->admin(['radio.schedule']);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'type' => 'automatica', 'date' => '2026-10-02', 'mode' => 'at', 'time' => '16:00', 'until' => '18:00',
            'playlist' => $list->id, 'shuffle' => '1',
        ])->assertOk()->assertJsonPath('ok', true);

        $slot = RadioSlot::query()->sole();
        $this->assertSame(RadioSlot::AUTO, $slot->kind);
        $this->assertEquals(7200, $slot->duration);
        $this->assertSame('Música automática · Mañanas · aleatorio', $slot->title);

        $this->at('16:30:00');
        $queue = $this->state('queue');
        foreach (array_slice($queue, 0, 5) as $item) {
            $this->assertContains($item['title'], $list->tracks()->pluck('title')->all());
            $this->assertSame($slot->title, $item['block']);
        }

        $this->at('18:00:30');
        $after = $this->state('queue.0');
        $this->assertNull($after['block'], 'After the period the station music takes over.');
        $this->assertSame($this->ms('18:00:00'), $after['origin']);
    }

    public function test_a_long_automatic_period_is_split_but_plays_as_one(): void
    {
        $list = $this->playlist('Noche', 4);
        $admin = $this->admin(['radio.schedule']);
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/radio/programacion', [
            'type' => 'automatica', 'date' => '2026-10-02', 'mode' => 'at', 'time' => '20:00', 'until' => '08:00',
            'playlist' => $list->id, 'shuffle' => '0',
        ])->assertOk();

        $this->assertSame(2, RadioSlot::query()->count());
        $this->assertEquals(12 * 3600, RadioSlot::query()->sum('duration'));

        $this->at('01:59:00', '2026-10-03');
        $before = $this->state('queue');
        $this->at('02:01:00', '2026-10-03');
        $after = $this->state('queue');
        $this->assertSame(collect($before)->firstWhere('start', '>', $this->ms('02:00:00', '2026-10-03'))['id'] ?? null, $after[1]['id'] ?? null);
        $this->assertNotEquals(0.0, (float) $after[0]['seek'], 'The song on air at the boundary keeps playing.');
    }

    public function test_in_automatic_mode_a_live_block_cuts_the_music_only_while_the_host_is_connected(): void
    {
        $this->track('Canción', 240, rotation: true);
        $this->track('Otra', 250, rotation: true);
        $this->liveBlock('14:50:00', 60, 'Mañanas con Zoe');
        $console = $this->admin(['radio.console']);

        $state = $this->state();
        $this->assertSame('musica', $state['queue'][0]['kind'], 'Nobody is connected: the automatic music keeps playing.');
        $this->assertFalse($state['live']['cut']);

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'host' => 'Ana'])->assertOk();
        $state = $this->state();
        $this->assertTrue($state['live']['cut']);
        $this->assertSame('vivo', $state['queue'][0]['kind']);
        $this->assertNull($state['queue'][0]['src']);
        $this->assertSame('Mañanas con Zoe', $state['queue'][0]['title']);
        $back = $state['queue'][1];
        $this->assertSame('musica', $back['kind']);
        $this->assertSame($this->ms('15:50:00'), $back['start'], 'The music comes back by itself when the block ends.');
        $this->assertEquals(0, $back['seek']);

        $this->at('15:20:00');
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'stop'])->assertOk();
        $state = $this->state();
        $this->assertFalse($state['live']['cut']);
        $this->assertSame('musica', $state['queue'][0]['kind']);
        $this->assertSame($this->ms('15:20:00'), $state['queue'][0]['origin'], 'The music starts fresh when the host hangs up.');
    }

    public function test_in_manual_mode_only_the_operator_cuts_and_returns(): void
    {
        $this->track('Canción', 240, rotation: true);
        $this->track('Otra', 250, rotation: true);
        $this->liveBlock('14:50:00', 60, 'Programa');
        $console = $this->admin(['radio.console']);
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'mode', 'mode' => 'manual'])->assertOk();

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'cut', 'on' => '1'])
            ->assertStatus(409)->assertJsonPath('error', 'Abre la transmisión en vivo (micrófono) antes de cortar la música.');

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'host' => 'Ana'])->assertOk();
        $this->assertSame('musica', $this->state('queue.0.kind'), 'Manual mode waits for the operator.');

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'cut', 'on' => '1'])->assertOk();
        $state = $this->state();
        $this->assertTrue($state['live']['cut']);
        $this->assertSame('vivo', $state['queue'][0]['kind']);
        $this->assertCount(1, $state['queue'], 'A manual cut lasts until the operator returns.');

        $list = $this->playlist('Después', 3);
        $this->at('15:05:00');
        $this->actingAs($console)->getJson(self::ADMIN.'/admin/radio/senal')->assertOk();
        $this->assertTrue($this->state('live.cut'), 'The console heartbeat keeps the cut open.');
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'cut', 'on' => '0', 'playlist' => $list->id, 'shuffle' => '0',
        ])->assertOk();
        $state = $this->state();
        $this->assertFalse($state['live']['cut']);
        $this->assertSame($this->ms('15:05:00'), $state['queue'][0]['origin']);
        $this->assertSame($list->tracks()->first()->title, $state['queue'][0]['title'], 'It continues with the chosen list, in order.');
    }

    public function test_returning_to_the_music_during_a_live_block_is_not_undone_by_the_automatic_switch(): void
    {
        $this->track('Canción', 240, rotation: true);
        $this->liveBlock('14:50:00', 60, 'Programa');
        $console = $this->admin(['radio.console']);
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start'])->assertOk();
        $this->assertTrue($this->state('live.cut'));

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'cut', 'on' => '0'])->assertOk();
        $this->at('15:01:00');
        $this->assertFalse($this->state('live.cut'));
    }

    public function test_an_external_signal_takes_over_while_it_answers(): void
    {
        $this->track('Canción', 240, rotation: true);
        $this->liveBlock('14:50:00', 60, 'Desde OBS');
        Station::saveConfig(['live_source' => 'externo', 'live_url' => 'https://radio.example.com/vivo']);

        $status = 404;
        Http::fake(['radio.example.com/*' => function () use (&$status) {
            return Http::response('audio', $status);
        }]);
        $state = $this->state();
        $this->assertFalse($state['live']['cut']);
        $this->assertNull($state['live']['url']);

        $status = 200;
        $this->at('15:00:20');
        $state = $this->state();
        $this->assertTrue($state['live']['cut']);
        $this->assertTrue($state['live']['on']);
        $this->assertSame('https://radio.example.com/vivo', $state['live']['url']);
        $this->assertSame('vivo', $state['queue'][0]['kind']);
    }

    public function test_the_console_switches_the_automatic_music_when_the_song_on_air_ends(): void
    {
        $this->track('Vieja', 300, rotation: true);
        $list = $this->playlist('Nueva', 2);
        Station::saveConfig(['crossfade' => 0]);
        $console = $this->admin(['radio.console']);

        $current = $this->state('queue.0');
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $list->id, 'shuffle' => '0',
        ])->assertOk()->assertJsonPath('autopilot.label', 'Nueva');

        $queue = $this->state('queue');
        $this->assertSame($current['id'], $queue[0]['id'], 'The song on air finishes.');
        $this->assertContains($list->tracks()->first()->title, array_column($queue, 'title'), 'The new list follows at a song boundary (see RadioSourceSwitchTest).');
    }

    public function test_playlists_are_managed_from_the_library_area(): void
    {
        $songs = collect(range(1, 3))->map(fn ($n) => $this->track("Canción {$n}", 200));
        $librarian = $this->admin(['radio.library']);
        $this->actingAs($librarian)->get(self::ADMIN.'/admin/radio/listas')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Radio/Listas')->has('songs', 3));

        $id = $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/listas', [
            'name' => 'Alabanza', 'tracks' => [$songs[2]->id, $songs[0]->id],
        ])->assertOk()->json('id');
        $this->assertSame(['Canción 3', 'Canción 1'], RadioPlaylist::query()->find($id)->tracks()->pluck('title')->all());

        $scheduler = $this->admin(['radio.schedule'], 'programador');
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/listas', ['name' => 'Otra'])->assertForbidden();

        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['playlist' => $id, 'shuffle' => '1'])->assertOk();
        $this->assertSame($id, Station::config()['auto_playlist']);

        $this->actingAs($librarian)->postJson(self::ADMIN.'/admin/radio/listas/eliminar', ['id' => $id])->assertOk();
        $this->assertNull(Station::config()['auto_playlist']);
        $this->assertSame(0, RadioPlaylist::query()->count());
    }

    /** What a listener receives (as a guest: signed-in admins are sent to their own door). */
    private function state(?string $key = null): mixed
    {
        auth()->guard('web')->forgetUser();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json($key);
    }

    /** Titles of the automatic music right after a program that ends at $time, so the first cycle starts there. */
    private function songsFrom(string $time, int $count): array
    {
        $from = $this->ms($time);
        $program = RadioTrack::query()->create([
            'kind' => 'programa', 'title' => 'Programa', 'file_path' => '/media/radio/programa/p.mp3', 'duration' => 600, 'active' => true,
        ]);
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::createFromTimestampMs($from - 600000), 'duration' => 600,
            'kind' => 'programa', 'radio_track_id' => $program->id, 'title' => 'Programa',
        ]);
        $items = Station::items($from, $from + 6 * 3600000, true, $count + 1);

        return array_slice(array_column(array_values(array_filter($items, fn ($item) => $item['start'] >= $from)), 'title'), 0, $count);
    }

    private function playlist(string $name, int $songs): RadioPlaylist
    {
        $list = RadioPlaylist::query()->create(['name' => $name, 'sort_order' => RadioPlaylist::query()->count()]);
        foreach (range(1, $songs) as $n) {
            $list->tracks()->attach($this->track("{$name} {$n}", 180 + $n * 7)->id, ['position' => $n]);
        }
        Station::flush();

        return $list;
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

    private function liveBlock(string $time, int $minutes, string $title): RadioSlot
    {
        return RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ)->utc(),
            'duration' => $minutes * 60, 'kind' => RadioSlot::LIVE, 'title' => $title,
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
