<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioSpotifyPlaylist;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Changing what the automatic music plays (a list, random songs or a Spotify playlist) never cuts
 * a song: the change lands on a song boundary at least the lead time ahead.
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

    public function test_when_the_song_on_air_ends_before_the_lead_the_next_one_finishes_too(): void
    {
        $this->actingAs($this->admin(['radio.console']))->postJson(self::ADMIN.'/admin/radio/musica-continua', [
            'action' => 'source', 'playlist' => $this->new->id, 'shuffle' => '0',
        ])->assertOk()
            ->assertJsonPath('autopilot.label', 'B')
            ->assertJsonPath('autopilot.pending.label', 'A')
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'empieza a las 15:05:52'));

        $queue = $this->state('queue');
        $this->assertSame(['A 1', 'A 2', 'B 1'], array_slice(array_column($queue, 'title'), 0, 3), 'A 1 has a minute left: A 2 plays to its end before the change.');
        $this->assertSame($this->ms('15:05:56'), $queue[1]['end'], 'The last song of the old list is not cut.');
        $this->assertSame($this->ms('15:05:52'), $queue[2]['start'], 'The new list fades in over its last seconds.');
    }

    public function test_the_lead_is_editable_down_to_thirty_seconds(): void
    {
        $settings = $this->admin(['radio.settings'], 'ajustes');
        $payload = ['name' => 'Radio Zoe', 'bed_level' => 22, 'fx_level' => 90, 'duck_level' => 25, 'crossfade' => 4, 'max_voice' => 60, 'autofill' => '1', 'on_air' => '1'];
        $this->actingAs($settings)->postJson(self::ADMIN.'/admin/radio/ajustes', [...$payload, 'switch_lead' => 29])->assertStatus(422);
        $this->actingAs($settings)->postJson(self::ADMIN.'/admin/radio/ajustes', [...$payload, 'switch_lead' => 30])->assertOk();

        $since = Station::switchAutopilot($this->new->id, false);

        $this->assertSame($this->ms('15:00:56'), $since, 'With 30 s of lead the change lands when A 1 ends.');
        $this->assertSame(['A 1', 'B 1'], array_slice(array_column($this->state('queue'), 'title'), 0, 2));
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

    public function test_a_spotify_playlist_takes_over_at_a_song_boundary_and_hands_back_after_the_lead(): void
    {
        $spotify = RadioSpotifyPlaylist::query()->create(['spotify_id' => '37i9dQZF1DWYcaB2B11tq2', 'name' => 'Clásicos Cristianos', 'published' => true, 'sort_order' => 0]);
        $scheduler = $this->admin(['radio.schedule']);
        $this->actingAs($scheduler)->get(self::ADMIN.'/admin/radio/programacion')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('spotifyPlaylists.0.name', 'Clásicos Cristianos'));

        $this->actingAs($scheduler)->postJson(self::ADMIN.'/admin/radio/programacion/piloto', ['spotify' => $spotify->id])->assertOk();
        $this->assertSame('spotify', Station::autopilot()['mode']);
        $state = $this->state();
        $this->assertNull($state['source']['spotify'], 'The station music plays until the change.');
        $this->assertSame('Clásicos Cristianos', $state['source']['next']['name']);
        $this->assertSame($this->ms('15:05:52'), $state['source']['since']);
        $this->assertSame(['A 1', 'A 2'], array_column($state['queue'], 'title'), 'The station falls silent after the song that fades into Spotify.');

        $this->at('15:06:00');
        $state = $this->state();
        $this->assertSame('Clásicos Cristianos', $state['source']['spotify']['name']);
        $this->assertSame([], $state['queue']);
        $this->assertSame([], $state['fallback'], 'No reserve songs play over Spotify.');

        $this->at('15:10:00');
        $since = Station::switchAutopilot($this->old->id, false);
        $this->assertSame($this->ms('15:15:00'), $since, 'Spotify songs are unknown to the station: the change is due after the lead.');
        $state = $this->state();
        $this->assertSame('Clásicos Cristianos', $state['source']['spotify']['name']);
        $this->assertSame('A 1', $state['queue'][0]['title']);
        $this->assertSame($this->ms('15:15:00'), $state['queue'][0]['start']);
    }

    /** What a listener receives (as a guest: signed-in admins are sent to their own door). */
    private function state(?string $key = null): mixed
    {
        auth()->guard('web')->forgetUser();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json($key);
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
