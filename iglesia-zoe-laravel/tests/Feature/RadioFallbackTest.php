<?php

namespace Tests\Feature;

use App\Domain\Radio\Autopilot;
use App\Domain\Radio\RadioHealth;
use App\Domain\Radio\Station;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RadioFallbackTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:00:00', Station::TZ));
        Storage::fake(config('filesystems.media'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_a_chosen_list_without_playable_songs_leaves_the_radio_silent(): void
    {
        $chosen = $this->playlist('Alabanza', $this->track('Alabanza 1'));
        $this->playlist('Adoración', $this->track('Adoración 1'));
        $this->track('Suelta');
        Station::saveConfig(['auto_playlist' => $chosen->id, 'auto_shuffle' => false]);

        $this->assertSame('playlist', Station::autopilot()['level']);
        $this->assertSame('Alabanza 1', $this->onAir());

        $this->breakFile('Alabanza 1');
        $this->assertSame('none', Station::autopilot()['level'], 'Nothing that was not chosen sounds in its place.');
        $this->assertSame([], $this->listener()['queue']);
        $this->assertSame([], $this->listener()['fallback']);
    }

    public function test_random_songs_take_every_list_and_then_the_whole_library(): void
    {
        $this->playlist('Adoración', $this->track('Adoración 1'));
        $this->track('Suelta');

        $this->assertSame('lists', Station::autopilot()['level']);
        $this->assertSame('Adoración 1', $this->onAir());

        $this->breakFile('Adoración 1');
        $this->assertSame('library', Station::autopilot()['level'], 'Without playable lists, every song of the library plays.');
        $this->assertSame('Suelta', $this->onAir());

        $this->breakFile('Suelta');
        $this->assertSame('none', Station::autopilot()['level']);
        $this->assertSame([], $this->listener()['queue']);
    }

    public function test_random_songs_play_the_whole_library_when_no_song_is_in_a_list(): void
    {
        $this->track('Sin lista');

        $this->assertSame(Autopilot::LIBRARY, Station::autopilot()['level']);
        $this->assertSame('Sin lista', $this->onAir());
    }

    public function test_a_scheduled_audio_with_a_broken_file_gives_its_time_to_the_music(): void
    {
        $this->track('Canción');
        $notice = $this->track('Aviso', kind: 'anuncio');
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::now()->subMinute()->utc(), 'duration' => 180, 'kind' => 'anuncio',
            'radio_track_id' => $notice->id, 'title' => 'Aviso',
        ]);
        $this->assertSame('Aviso', $this->onAir());

        $this->breakFile('Aviso');
        $this->assertSame('Canción', $this->onAir());
    }

    public function test_listeners_get_reserve_songs_only_while_music_is_expected(): void
    {
        $this->track('Canción');
        $this->assertSame(['Canción'], array_column($this->listener()['fallback'], 'title'));

        Station::saveConfig(['autofill' => false]);
        $this->assertSame([], $this->listener()['fallback'], 'With the continuous music paused, silence is intended.');

        Station::saveConfig(['autofill' => true, 'auto_repeat' => false]);
        $this->assertSame([], $this->listener()['fallback'], 'A source that plays only once ends in silence.');
    }

    public function test_a_missing_file_leaves_the_air_only_after_two_checks_a_minute_apart_and_returns_when_it_is_back(): void
    {
        $this->library(4);
        $lost = $this->track('Perdida', withFile: false);

        $this->assertSame(RadioHealth::MISSING, RadioHealth::check($lost));
        $this->assertNull($lost->fresh()->file_problem, 'One failed check is not enough.');

        $this->travel(61)->seconds();
        RadioHealth::sweep();
        $this->assertSame(RadioHealth::MISSING, $lost->fresh()->file_problem);
        $this->assertNotContains('Perdida', array_column(Autopilot::songs(null, 0), 'title'));

        $this->putFile($lost);
        $this->travel(16)->minutes();
        RadioHealth::sweep();
        $this->assertNull($lost->fresh()->file_problem, 'A file that comes back returns to the air on its own.');
        $this->assertContains('Perdida', array_column(Autopilot::songs(null, 0), 'title'));
    }

    public function test_an_empty_file_is_not_audio(): void
    {
        $this->library(4);
        $empty = $this->track('Vacía', withFile: false);
        Storage::disk(config('filesystems.media'))->put($this->key($empty), 'x');

        RadioHealth::check($empty);
        $this->travel(61)->seconds();
        RadioHealth::check($empty);

        $this->assertSame(RadioHealth::EMPTY, $empty->fresh()->file_problem);
    }

    public function test_the_circuit_breaker_keeps_the_library_on_air_when_the_storage_loses_most_files(): void
    {
        $tracks = collect(range(1, 4))->map(fn (int $n) => $this->track("Canción {$n}", withFile: false));

        $tracks->each(fn (RadioTrack $track) => RadioHealth::check($track));
        $this->travel(61)->seconds();
        $tracks->each(fn (RadioTrack $track) => RadioHealth::check($track->fresh()));

        $this->assertSame(2, RadioHealth::brokenCount(), 'Never more than half of the library leaves the air.');
    }

    public function test_a_listener_report_alone_changes_nothing_but_the_storage_or_other_listeners_confirm_it(): void
    {
        config(['radio.verify_files' => true]);
        $this->withoutDefer();
        $this->library(4);
        $healthy = $this->track('Sana');
        $lost = $this->track('Perdida', withFile: false);

        $this->report($healthy, '10.0.0.1')->assertStatus(202);
        $this->assertNull($healthy->fresh()->file_problem, 'One listener failing with a file that exists is not enough.');

        $this->report($healthy, '10.0.0.2');
        $this->report($healthy, '10.0.0.3');
        $this->assertSame(RadioHealth::UNPLAYABLE, $healthy->fresh()->file_problem, 'Three different listeners failing with it are.');

        $this->report($lost, '10.0.0.1');
        $this->assertSame(RadioHealth::MISSING, $lost->fresh()->file_problem, 'A report the storage confirms takes the song off at once.');

        $this->postJson(self::SITE.'/radio/fallo', ['oyente' => $this->listenerId(), 'track' => 'no-existe'])->assertNotFound();
    }

    public function test_uploading_a_new_file_clears_the_health_record(): void
    {
        $track = $this->track('Canción');
        $track->forceFill(['file_problem' => RadioHealth::MISSING, 'file_problem_at' => now(), 'file_checked_at' => now()])->save();

        $track->update(['file_path' => '/media/radio/musica/nueva.mp3']);

        $this->assertNull($track->fresh()->file_problem);
        $this->assertNull($track->fresh()->file_checked_at);
    }

    /** Title of what sounds now for a listener. */
    private function onAir(): ?string
    {
        return $this->listener()['queue'][0]['title'] ?? null;
    }

    private function listener(): array
    {
        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json();
    }

    private function report(RadioTrack $track, string $address)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $address])
            ->postJson(self::SITE.'/radio/fallo', ['oyente' => $this->listenerId(), 'track' => $track->id]);
    }

    private function listenerId(): string
    {
        return '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
    }

    private function breakFile(string $title): void
    {
        RadioTrack::query()->where('title', $title)->sole()
            ->forceFill(['file_problem' => RadioHealth::MISSING, 'file_problem_at' => now()])->save();
        Station::flush();
    }

    private function library(int $songs): void
    {
        foreach (range(1, $songs) as $n) {
            $this->track("Biblioteca {$n}");
        }
    }

    private function playlist(string $name, RadioTrack $track): RadioPlaylist
    {
        $list = RadioPlaylist::query()->create(['name' => $name, 'sort_order' => RadioPlaylist::query()->count()]);
        $list->tracks()->attach($track->id, ['position' => 1]);

        return $list;
    }

    private function track(string $title, string $kind = 'musica', bool $withFile = true): RadioTrack
    {
        $track = RadioTrack::query()->create([
            'kind' => $kind,
            'title' => $title,
            'file_path' => '/media/radio/'.$kind.'/'.str($title)->slug().'.mp3',
            'duration' => 240,
            'active' => true,
        ]);
        if ($withFile) {
            $this->putFile($track);
        }

        return $track;
    }

    private function putFile(RadioTrack $track): void
    {
        Storage::disk(config('filesystems.media'))->put($this->key($track), str_repeat('a', 4096));
    }

    private function key(RadioTrack $track): string
    {
        return substr($track->file_path, strlen('/media/'));
    }
}
