<?php

namespace Tests\Feature;

use App\Models\ChurchEvent;
use App\Models\PastEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

/** /eventos: the calendar with the flyers of each month and «Conoce más de nuestros eventos anteriores». */
class EventsCalendarTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-15 10:00', 'America/Lima'));
        Storage::fake(config('filesystems.media'));
    }

    public function test_the_calendar_carries_this_month_onward_and_the_published_past_events(): void
    {
        $earlier = ChurchEvent::factory()->on('2026-10-03')->create(['title' => 'Bautismos']);
        $next = ChurchEvent::factory()->on('2026-11-20')->create(['title' => 'Retiro de Matrimonios']);
        $spanning = ChurchEvent::factory()->on('2026-09-28')->create(['ends_on' => '2026-10-02', 'title' => 'Ayuno']);
        ChurchEvent::factory()->on('2026-09-10')->create(['title' => 'Mes pasado']);
        ChurchEvent::factory()->on('2026-10-25')->hidden()->create();
        $recent = PastEvent::factory()->create(['held_on' => '2026-09-01', 'title' => 'Aniversario']);
        $older = PastEvent::factory()->create(['held_on' => '2026-05-10', 'title' => 'Día de la Madre', 'url' => 'https://www.tiktok.com/@iglesiazoe/video/1']);
        PastEvent::factory()->hidden()->create();

        $this->get('/eventos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Events')
                ->where('today', '2026-10-15')
                ->where('events', fn ($events) => collect($events)->pluck('id')->all() === [$spanning->id, $earlier->id, $next->id])
                ->where('pastEvents', fn ($events) => collect($events)->pluck('id')->all() === [$recent->id, $older->id])
                ->where('pastEvents.0.platform', 'instagram')
                ->where('pastEvents.1.platform', 'tiktok'));
    }

    public function test_an_area_director_publishes_a_past_event_linked_to_its_post(): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage'])->create();

        $this->actingAs($director)
            ->postJson(self::ADMIN.'/admin/eventos/anteriores', [
                'title' => 'Noche de Hombres',
                'held_on' => '2026-08-22',
                'url' => ' https://www.facebook.com/iglesiazoe/posts/123 ',
                'active' => '1',
                'image' => UploadedFile::fake()->image('noche.jpg', 800, 1000),
            ])
            ->assertOk()
            ->assertJson(['ok' => true, 'message' => 'Evento anterior publicado.']);

        $event = PastEvent::query()->sole();
        $this->assertSame('Noche de Hombres', $event->title);
        $this->assertSame('https://www.facebook.com/iglesiazoe/posts/123', $event->url);
        $this->assertTrue($event->active);
        $this->assertStringStartsWith('/media/eventos-anteriores/', $event->image_path);
        Storage::disk(config('filesystems.media'))->assertExists(substr($event->image_path, strlen('/media/')));
    }

    #[TestWith(['https://www.google.com/search?q=zoe'])]
    #[TestWith(['http://www.instagram.com/p/abc'])]
    #[TestWith(['https://instagram.com.ejemplo.net/p/abc'])]
    public function test_a_past_event_only_links_to_a_post_on_a_social_network(string $url): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage'])->create();

        $this->actingAs($director)
            ->postJson(self::ADMIN.'/admin/eventos/anteriores', [
                'title' => 'Aniversario',
                'held_on' => '2026-08-22',
                'url' => $url,
                'image' => UploadedFile::fake()->image('aniversario.jpg'),
            ])
            ->assertUnprocessable()
            ->assertJson(['error' => 'Pega el enlace completo de la publicación en Instagram, Facebook, TikTok o YouTube (empieza con https://).']);

        $this->assertDatabaseCount('past_events', 0);
    }

    public function test_a_new_past_event_needs_its_cover(): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage'])->create();

        $this->actingAs($director)
            ->postJson(self::ADMIN.'/admin/eventos/anteriores', ['title' => 'Aniversario', 'held_on' => '2026-08-22', 'url' => 'https://www.instagram.com/p/abc'])
            ->assertUnprocessable()
            ->assertJson(['error' => 'Sube la portada del evento.']);

        $this->assertDatabaseCount('past_events', 0);
    }

    public function test_an_account_without_the_events_function_cannot_publish_past_events(): void
    {
        $designer = User::factory()->administrator(['director'], ['design.manage'])->create();

        $this->actingAs($designer)
            ->postJson(self::ADMIN.'/admin/eventos/anteriores', ['title' => 'Aniversario', 'held_on' => '2026-08-22', 'url' => 'https://www.instagram.com/p/abc', 'image' => UploadedFile::fake()->image('a.jpg')])
            ->assertForbidden();

        $this->assertDatabaseCount('past_events', 0);
    }

    public function test_deleting_a_past_event_removes_its_cover(): void
    {
        $director = User::factory()->administrator(['director'], ['events.manage'])->create();
        Storage::disk(config('filesystems.media'))->put('eventos-anteriores/portada.jpg', 'x');
        $event = PastEvent::factory()->create(['image_path' => '/media/eventos-anteriores/portada.jpg']);

        $this->actingAs($director)->postJson(self::ADMIN.'/admin/eventos/anteriores/eliminar', ['id' => $event->id])->assertOk();

        $this->assertModelMissing($event);
        Storage::disk(config('filesystems.media'))->assertMissing('eventos-anteriores/portada.jpg');
    }
}
