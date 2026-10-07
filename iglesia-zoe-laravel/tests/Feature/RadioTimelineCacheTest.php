<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Every listener polls the state every few seconds: the blocks of the timeline come from the
 * cache, and any change to the schedule or to an audio reaches the listeners at once.
 */
class RadioTimelineCacheTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        config(['radio.verify_files' => false]);
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:00:00', Station::TZ));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_listeners_poll_the_state_without_reading_the_schedule_again(): void
    {
        $this->slot('15:10:00', 'Aviso de la cena');
        $this->state();

        DB::enableQueryLog();
        $state = $this->state();

        $this->assertSame('Aviso de la cena', $state['next_show']['title']);
        $this->assertContains('Aviso de la cena', array_column($state['queue'], 'title'));
        $this->assertSame([], array_filter(array_column(DB::getQueryLog(), 'query'), fn (string $sql) => str_contains($sql, 'radio_slots')));
    }

    public function test_the_cached_schedule_is_plain_data_the_cache_can_read_back(): void
    {
        $this->slot('15:10:00', 'Aviso de la cena');
        $this->state();

        $cached = Cache::get('radio.timeline.'.Cache::get('radio.timeline.generation'));

        $this->assertIsArray($cached);
        $this->assertNotEmpty($cached['slots']);
        array_walk_recursive($cached, fn (mixed $value) => $this->assertIsNotObject($value, 'The cache does not unserialize objects (serializable_classes).'));
        $this->assertEquals($cached, unserialize(serialize($cached), ['allowed_classes' => false]));
    }

    public function test_a_block_scheduled_after_the_state_was_read_is_heard_at_once(): void
    {
        $this->assertSame([], $this->state()['queue']);

        $this->slot('15:05:00', 'Aviso de la cena');

        $queue = $this->state()['queue'];
        $this->assertSame('Aviso de la cena', $queue[0]['title']);
        $this->assertSame(CarbonImmutable::parse('2026-10-02 15:05:00', Station::TZ)->getTimestampMs(), $queue[0]['start']);
    }

    public function test_clearing_the_day_takes_its_blocks_off_the_air_at_once(): void
    {
        $this->slot('15:10:00', 'Aviso de la cena');
        $this->assertContains('Aviso de la cena', array_column($this->state()['queue'], 'title'));

        $this->actingAs($this->admin())->postJson(self::ADMIN.'/admin/radio/programacion/vaciar', ['date' => '2026-10-02'])->assertOk();

        $state = $this->state();
        $this->assertSame([], $state['queue']);
        $this->assertNull($state['next_show']);
    }

    public function test_a_new_file_for_a_scheduled_audio_is_heard_at_once(): void
    {
        $slot = $this->slot('15:10:00', 'Aviso de la cena');
        $this->assertSame('/media/radio/anuncio/aviso-de-la-cena.mp3', $this->state()['queue'][0]['src']);

        $slot->track->update(['file_path' => '/media/radio/anuncio/aviso-nuevo.mp3']);

        $this->assertSame('/media/radio/anuncio/aviso-nuevo.mp3', $this->state()['queue'][0]['src']);
    }

    /** What a listener receives (as a guest: signed-in admins are sent to their own door). */
    private function state(): array
    {
        auth()->guard('web')->forgetUser();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk()->json();
    }

    private function slot(string $time, string $title): RadioSlot
    {
        $track = RadioTrack::query()->create([
            'kind' => 'anuncio', 'title' => $title, 'file_path' => '/media/radio/anuncio/'.str($title)->slug().'.mp3', 'duration' => 120, 'active' => true,
        ]);

        return RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 '.$time, Station::TZ)->utc(),
            'duration' => 120, 'kind' => 'anuncio', 'radio_track_id' => $track->id, 'title' => $title,
        ]);
    }

    private function admin(): User
    {
        return User::query()->create([
            'name' => 'Radio',
            'username' => 'radio',
            'email' => 'radio@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['atmosfera'],
            'permissions' => array_values(array_intersect(['radio.schedule'], Permissions::RADIO)),
            'active' => true,
        ]);
    }
}
