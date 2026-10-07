<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\SiteSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Changing what the automatic music plays (a list or random songs) never cuts
 * a song: the change lands when the song on air ends or at the song boundary the operator picks.
 *
 * The music starts at 14:50 after a program, with the list «A» in order and a 4 s crossfade:
 * A 1 (11 min) sounds from 14:50:00, A 2 from 15:00:56 and A 3 from 15:05:52.
 */
class RadioSourceSwitchTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    private RadioPlaylist $old;

    private RadioPlaylist $new;

    protected function setUp(): void
    {
        parent::setUp();
        $this->at('15:00:00');
        $this->old = $this->playlist('A', [660, 300, 300]);
        $this->new = $this->playlist('B', [200, 200]);
        $this->program('14:40:00', 600);
        Station::saveConfig(['auto_playlist' => $this->old->id, 'auto_shuffle' => false, 'crossfade' => 4]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_by_default_the_change_lands_when_the_song_on_air_ends(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $this->new->id, 'shuffle' => '0', 'when' => 'song',
        ])->assertOk()
            ->assertJsonPath('autopilot.label', 'B')
            ->assertJsonPath('autopilot.pending.label', 'A')
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'empieza a las 15:00:56, cuando termina «A 1»'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'B 1'], array_slice(array_column($queue, 'title'), 0, 2));
        $this->assertSame($this->ms('15:01:00'), $queue[0]['end'], 'The song on air is not cut.');
        $this->assertSame($this->ms('15:00:56'), $queue[1]['start'], 'The new list fades in over its last seconds.');
    }

    public function test_when_the_song_on_air_is_about_to_end_the_change_waits_for_the_next_one(): void
    {
        $this->at('15:00:40');

        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $this->new->id, 'shuffle' => '0',
        ])->assertOk()
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'empieza a las 15:05:52, cuando termina «A 2»'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'A 2', 'B 1'], array_slice(array_column($queue, 'title'), 0, 3), 'A 1 fades out in seconds: A 2 plays to its end before the change.');
        $this->assertSame($this->ms('15:05:56'), $queue[1]['end']);
    }

    public function test_the_operator_picks_the_song_boundary_where_the_change_lands(): void
    {
        $scheduler = $this->admin(['radio.schedule']);
        $points = $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['points' => '1'])->assertOk()->json('points');

        $this->assertSame([$this->ms('15:00:56'), $this->ms('15:05:52'), $this->ms('15:10:48')], array_slice(array_column($points, 'at'), 0, 3));
        $this->assertSame(['A 1', 'A 2', 'A 3'], array_slice(array_column(array_column($points, 'after'), 'title'), 0, 3));
        $this->assertSame('A', Station::autopilot()['label'], 'Asking for the points changes nothing.');

        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', [
            'playlist' => $this->new->id, 'shuffle' => '0', 'when' => 'at', 'at' => $points[2]['at'],
        ])->assertOk()
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'empieza a las 15:10:48, cuando termina «A 3»'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'A 2', 'A 3', 'B 1'], array_slice(array_column($queue, 'title'), 0, 4));
        $this->assertSame($this->ms('15:10:52'), $queue[2]['end'], 'The song before the chosen point plays to its end.');
    }

    public function test_a_point_that_is_not_a_song_boundary_is_refused(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $this->new->id, 'shuffle' => '0', 'when' => 'at', 'at' => $this->ms('15:03:00'),
        ])->assertStatus(409)->assertJsonPath('error', fn (string $error) => str_contains($error, 'Vuelve a elegir'));

        $this->assertSame($this->old->id, Station::config()['auto_playlist']);
        $this->assertNull(Station::autopilot()['pending']);
    }

    public function test_the_automatic_music_cannot_switch_to_a_list_without_songs(): void
    {
        $empty = RadioPlaylist::query()->create(['name' => 'Vacía', 'sort_order' => 3]);

        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $empty->id, 'shuffle' => '1',
        ])->assertStatus(409)->assertJsonPath('error', fn (string $error) => str_contains($error, '«Vacía» no tiene canciones'));

        $this->assertSame($this->old->id, Station::config()['auto_playlist']);
    }

    public function test_a_pending_change_can_be_cancelled(): void
    {
        $scheduler = $this->admin(['radio.schedule']);
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['playlist' => $this->new->id, 'shuffle' => '0'])->assertOk();

        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['cancel' => '1'])->assertOk()
            ->assertJsonPath('message', 'Cambio cancelado: sigue sonando A.');

        $this->assertSame(['A 1', 'A 2', 'A 3'], array_slice(array_column($this->state('queue'), 'title'), 0, 3));
        $this->assertNull(Station::autopilot()['pending']);
    }

    public function test_starting_the_automatic_music_plays_the_chosen_song_for_everyone_in_seconds(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'start', 'playlist' => $this->new->id, 'shuffle' => '0', 'first' => $this->track('B 2'),
        ])->assertOk()
            ->assertJsonPath('autopilot.label', 'B')
            ->assertJsonPath('autopilot.pending', null)
            ->assertJsonPath('message', fn (string $message) => str_contains($message, '«B 2»'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'B 2', 'B 1'], array_slice(array_column($queue, 'title'), 0, 3), 'The list plays from the chosen song on.');
        $this->assertSame($this->ms('15:00:07'), $queue[0]['end'], 'The song on air fades out under the first song instead of playing to its end.');
        $this->assertSame($this->ms('15:00:03'), $queue[1]['start'], 'It starts a few seconds ahead so every listener hears it from the beginning.');
        $this->assertEquals(0, $queue[1]['seek']);
    }

    public function test_starting_from_silence_puts_the_radio_on_air_with_the_chosen_song_first(): void
    {
        Station::saveConfig(['on_air' => false, 'autofill' => false]);

        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'start', 'playlist' => $this->old->id, 'shuffle' => '1', 'first' => $this->track('A 3'),
        ])->assertOk();

        $this->assertTrue(Station::config()['on_air']);
        $this->assertTrue(Station::config()['autofill']);
        $queue = $this->state('queue');
        $this->assertSame('A 3', $queue[0]['title'], 'Nothing was sounding, so nothing fades: the chosen song opens the shuffled list.');
        $this->assertSame($this->ms('15:00:03'), $queue[0]['start']);
        $this->assertEqualsCanonicalizing(['A 1', 'A 2'], array_column(array_slice($queue, 1, 2), 'title'));
    }

    public function test_the_starting_song_must_belong_to_the_chosen_list(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'start', 'playlist' => $this->old->id, 'shuffle' => '0', 'first' => $this->track('B 1'),
        ])->assertStatus(422);

        $this->assertSame($this->old->id, Station::config()['auto_playlist']);
        $this->assertSame('A 1', $this->state('queue')[0]['title']);
    }

    public function test_without_repeat_the_list_plays_to_its_last_song_and_then_the_radio_is_silent(): void
    {
        $console = $this->admin(['radio.console']);
        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'repeat', 'on' => '0'])->assertOk()
            ->assertJsonPath('autopilot.repeat', false)
            ->assertJsonPath('autopilot.until', $this->ms('15:10:48'))
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'termina a las 15:10'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'A 2', 'A 3'], array_column($queue, 'title'), 'After the last song of the list nothing else sounds.');
        $this->assertSame($this->ms('15:10:52'), $queue[2]['end'], 'The last song plays to its end.');

        $this->at('15:11:00');
        $this->assertSame([], $this->state('queue'));
        $this->assertTrue(Station::autopilot()['finished']);

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/musica-continua', ['action' => 'repeat', 'on' => '1'])->assertOk()
            ->assertJsonPath('autopilot.until', null);
        $queue = $this->state('queue');
        $this->assertSame('A 1', $queue[0]['title'], 'Turning repeat on after the silence starts the list over from its first song.');
        $this->assertSame($this->ms('15:11:03'), $queue[0]['start']);
    }

    public function test_the_automatic_mode_can_start_without_repeat(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'start', 'playlist' => $this->new->id, 'shuffle' => '0', 'repeat' => '0',
        ])->assertOk()
            ->assertJsonPath('autopilot.until', $this->ms('15:06:35'))
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'queda en silencio'));

        $this->assertSame(['A 1', 'B 1', 'B 2'], array_column($this->state('queue'), 'title'));
    }

    public function test_a_chosen_list_without_songs_cannot_start(): void
    {
        $empty = RadioPlaylist::query()->create(['name' => 'Vacía', 'sort_order' => 3]);

        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'start', 'playlist' => $empty->id,
        ])->assertStatus(409)->assertJsonPath('error', fn (string $error) => str_contains($error, '«Vacía» no tiene canciones'));
    }

    public function test_the_schedule_turns_the_automatic_music_off_and_on(): void
    {
        $scheduler = $this->admin(['radio.schedule']);
        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['on' => '0'])->assertOk();
        $this->assertSame([], $this->state('queue'), 'With the automatic mode off and nothing scheduled, nothing sounds.');

        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['on' => '1'])->assertOk();
        $this->assertSame('A 1', $this->state('queue')[0]['title']);
    }

    public function test_a_spotify_playlist_left_as_the_source_gives_way_to_the_library(): void
    {
        $setting = SiteSetting::query()->findOrFail('radio');
        $setting->value = [...$setting->value, 'auto_playlist' => null, 'auto_spotify' => (string) Str::uuid()];
        $setting->save();
        Cache::flush();

        $this->actingAs($this->admin(['radio.schedule']))->get(self::ADMIN.'/admin/radio/programacion')
            ->assertInertia(fn (AssertableInertia $page) => $page->missing('spotifyPlaylists'));
        $this->assertSame('aleatorio', Station::autopilot()['mode']);

        $state = $this->state();
        $this->assertArrayNotHasKey('source', $state);
        $this->assertNotSame([], $state['queue']);
        $this->assertSame([], array_diff(array_column($state['queue'], 'title'), ['A 1', 'A 2', 'A 3', 'B 1', 'B 2']), 'Only library songs reach the listeners.');
        $this->assertStringNotContainsStringIgnoringCase('spotify', json_encode($state));
    }

    /** What a listener receives (as a guest: signed-in admins are sent to their own door). */
    private function state(?string $key = null): mixed
    {
        auth()->guard('web')->forgetUser();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json($key);
    }

    private function track(string $title): string
    {
        return RadioTrack::query()->where('title', $title)->value('id');
    }

    /** @param  list<int>  $durations */
    private function playlist(string $name, array $durations): RadioPlaylist
    {
        $list = RadioPlaylist::query()->create(['name' => $name, 'sort_order' => RadioPlaylist::query()->count()]);
        foreach ($durations as $index => $seconds) {
            $title = $name.' '.($index + 1);
            $track = RadioTrack::query()->create([
                'kind' => 'musica', 'title' => $title, 'file_path' => '/media/radio/musica/'.str($title)->slug().'.mp3', 'duration' => $seconds, 'active' => true,
            ]);
            $list->tracks()->attach($track->id, ['position' => $index + 1]);
        }
        Station::flush();

        return $list;
    }

    private function program(string $time, int $seconds): void
    {
        $track = RadioTrack::query()->create([
            'kind' => 'programa', 'title' => 'Programa', 'file_path' => '/media/radio/programa/p.mp3', 'duration' => $seconds, 'active' => true,
        ]);
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ)->utc(), 'duration' => $seconds,
            'kind' => 'programa', 'radio_track_id' => $track->id, 'title' => 'Programa',
        ]);
    }

    private function at(string $time): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ));
    }

    private function ms(string $time): int
    {
        return CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ)->getTimestampMs();
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
