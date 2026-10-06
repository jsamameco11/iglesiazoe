<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Radio\Station;
use App\Domain\Shared\Enums\Role;
use App\Models\RadioSlot;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RadioLiveTitleTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-02 19:00:00', Station::TZ));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_listeners_see_the_episode_name_written_in_the_console_and_never_the_host(): void
    {
        $console = $this->admin();

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'title' => '  Noche   de jóvenes '])
            ->assertOk()->assertJsonPath('live.title', 'Noche de jóvenes');
        $this->listenerState()->assertJsonPath('live.on', true)->assertJsonPath('live.title', 'Noche de jóvenes')->assertJsonMissingPath('live.host');

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'mix', 'title' => 'Noche de jóvenes · Invitado especial'])->assertOk();
        $this->listenerState()->assertJsonPath('live.title', 'Noche de jóvenes · Invitado especial');

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'stop'])->assertOk()->assertJsonPath('live.title', '');
        $this->listenerState()->assertJsonPath('live.on', false)->assertJsonPath('live.title', '');
    }

    public function test_a_transmission_opened_without_a_name_takes_the_scheduled_live_block(): void
    {
        RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-02 19:10:00', Station::TZ)->utc(),
            'duration' => 3600, 'kind' => RadioSlot::LIVE, 'title' => 'Culto de oración',
        ]);
        $console = $this->admin();

        $this->actingAs($console)->get(self::ADMIN.'/admin/radio')->assertOk()
            ->assertInertia(fn ($page) => $page->where('episode', 'Culto de oración'));

        $this->actingAs($console)->postJson(self::ADMIN.'/admin/radio/vivo', ['action' => 'start', 'title' => ''])->assertOk();
        $this->listenerState()->assertJsonPath('live.title', 'Culto de oración');
    }

    private function listenerState(): TestResponse
    {
        auth()->logout();

        return $this->getJson(self::SITE.'/radio/estado')->assertOk();
    }

    private function admin(): User
    {
        return User::query()->firstOrCreate(['username' => 'radio'], [
            'name' => 'Radio',
            'email' => 'radio@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => ['atmosfera'],
            'permissions' => array_values(array_intersect(['radio.console'], Permissions::RADIO)),
            'active' => true,
        ]);
    }
}
