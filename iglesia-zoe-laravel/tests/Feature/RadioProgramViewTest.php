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
use Tests\TestCase;

class RadioProgramViewTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 15:00:00', Station::TZ));
        foreach (['Sublime gracia' => 200, 'Cuán grande es Él' => 240, 'Al que está sentado' => 220] as $title => $seconds) {
            RadioTrack::query()->create([
                'kind' => 'musica', 'title' => $title, 'file_path' => '/media/radio/musica/'.str($title)->slug().'.mp3',
                'duration' => $seconds, 'rotation' => true, 'active' => true,
            ]);
        }
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_the_whole_day_lists_the_songs_the_automatic_music_will_play_around_the_scheduled_blocks(): void
    {
        $spot = RadioTrack::query()->create(['kind' => 'anuncio', 'title' => 'Aviso de la cena', 'file_path' => '/media/radio/anuncio/cena.mp3', 'duration' => 60, 'active' => true]);
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 18:00:00', Station::TZ)->utc(),
            'duration' => 60, 'kind' => 'anuncio', 'radio_track_id' => $spot->id, 'title' => 'Aviso de la cena',
        ]);
        [$from, $to] = Station::dayBounds('2026-10-02');

        $items = $this->actingAs($this->admin(['radio.schedule']))
            ->getJson(self::ADMIN."/admin/radio/linea?desde={$from}&hasta={$to}")
            ->assertOk()->json('items');

        $songs = array_values(array_filter($items, fn (array $item) => $item['slot'] === null));
        $this->assertGreaterThan(300, count($songs), 'A whole day of automatic music is resolved song by song.');
        $this->assertSame([], array_diff(array_unique(array_column($songs, 'title')), ['Sublime gracia', 'Cuán grande es Él', 'Al que está sentado']));
        $this->assertContains('Aviso de la cena', array_column($items, 'title'));
        $this->assertArrayNotHasKey('src', $items[0]);
        $starts = array_column($items, 'start');
        $ordered = $starts;
        sort($ordered);
        $this->assertSame($ordered, $starts, 'In order.');
    }

    public function test_the_console_can_read_the_program_but_ranges_are_bounded_and_need_a_radio_permission(): void
    {
        $now = Station::nowMs();

        $this->actingAs($this->admin(['radio.console']))->getJson(self::ADMIN.'/admin/radio/linea?desde='.$now.'&hasta='.($now + 3 * 3600000))
            ->assertOk()->assertJsonPath('items.0.kind', 'musica');
        $this->actingAs($this->admin(['radio.console']))->getJson(self::ADMIN.'/admin/radio/linea?desde='.$now.'&hasta='.($now + 37 * 3600000))
            ->assertStatus(422);
        $this->actingAs($this->admin(['radio.library'], 'biblioteca'))->getJson(self::ADMIN.'/admin/radio/linea?desde='.$now.'&hasta='.($now + 3600000))
            ->assertForbidden();
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
