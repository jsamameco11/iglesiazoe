<?php

namespace Tests\Feature;

use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\ChurchEvent;
use App\Models\Teaching;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class SiteSectionsTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
    }

    public function test_events_page_lists_only_upcoming_visible_events_in_date_order(): void
    {
        $today = now('America/Lima');
        $this->event('Retiro de servidores', $today->copy()->addDays(20)->toDateString());
        $this->event('Día de la madre', $today->copy()->addDays(3)->toDateString());
        $this->event('Campamento', $today->copy()->subDays(2)->toDateString(), ['ends_on' => $today->copy()->addDay()->toDateString()]);
        $this->event('Ya pasó', $today->copy()->subDays(10)->toDateString());
        $this->event('Borrador', $today->copy()->addDays(5)->toDateString(), ['active' => false]);

        $this->get('/eventos')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Events')
                ->has('events', 3)
                ->where('events.0.title', 'Campamento')
                ->where('events.1.title', 'Día de la madre')
                ->where('events.2.title', 'Retiro de servidores'));

        $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->component('Home')->has('events', 3));
    }

    public function test_resources_and_serve_pages_render(): void
    {
        Teaching::query()->create(['title' => 'Guía GC', 'kind' => 'gc', 'teaching_date' => '2026-09-20', 'file_path' => '/media/recursos/2026/guia.pdf', 'active' => true]);
        Teaching::query()->create(['title' => 'Oculta', 'kind' => 'predica', 'teaching_date' => '2026-09-21', 'youtube_id' => 'dQw4w9WgXcQ', 'active' => false]);

        $this->get('/recursos')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Teachings')
                ->has('teachings', 1)
                ->where('teachings.0.file_type', 'PDF'));

        $this->get('/involucrate')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Serve')->has('serveAreas', count(config('zoe.serve_areas'))));

        $this->get('/ruta-del-servidor')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('ServerRoute')
                ->has('studyLevels', 5)
                ->where('studyLevels.0.name', 'Nueva Vida')
                ->where('studyLevels.4.name', 'Visión Celular'));
    }

    public function test_admin_publishes_edits_and_deletes_an_event_with_its_flyer(): void
    {
        $admin = $this->superadmin();
        $date = now('America/Lima')->addWeek()->toDateString();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos', ['title' => 'Reunión de jóvenes', 'starts_on' => $date, 'cta_url' => 'javascript:alert(1)'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'El enlace del botón debe empezar con https://');

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos', [
            'title' => 'Reunión de jóvenes',
            'starts_on' => $date,
            'time_label' => '7:00 p. m.',
            'cta_label' => 'Inscribirme',
            'cta_url' => 'https://wa.me/51987654321',
            'active' => '1',
            'image' => UploadedFile::fake()->image('flyer.jpg', 800, 1000),
        ])->assertOk()->assertJsonPath('message', 'Evento publicado.');

        $event = ChurchEvent::query()->sole();
        $this->assertStringStartsWith('/media/eventos/', $event->image_path);
        $this->assertTrue($event->active);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos', ['id' => $event->id, 'title' => 'Noche de jóvenes', 'starts_on' => $date, 'ends_on' => now('America/Lima')->subYear()->toDateString()])
            ->assertUnprocessable();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos', ['id' => $event->id, 'title' => 'Noche de jóvenes', 'starts_on' => $date, 'remove_image' => '1'])
            ->assertOk();
        $event->refresh();
        $this->assertSame('Noche de jóvenes', $event->title);
        $this->assertNull($event->image_path);
        $this->assertFalse($event->active);

        $this->actingAs($admin)->get(self::ADMIN.'/admin/eventos')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Eventos')->has('events', 1));

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/eventos/eliminar', ['id' => $event->id])->assertOk();
        $this->assertSame(0, ChurchEvent::query()->count());
    }

    public function test_a_teaching_needs_a_file_or_a_video(): void
    {
        $admin = $this->superadmin();
        $base = ['title' => 'Enseñanza del domingo', 'kind' => 'predica', 'teaching_date' => '2026-09-27', 'active' => '1'];

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos', $base)
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Adjunta el archivo de la enseñanza o pega el enlace del video.');
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos', [...$base, 'kind' => 'otro', 'youtube' => 'dQw4w9WgXcQ'])->assertUnprocessable();
        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos', [...$base, 'youtube' => 'https://example.com/video'])->assertUnprocessable();

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos', [...$base, 'youtube' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'])->assertOk();
        $this->assertSame('dQw4w9WgXcQ', Teaching::query()->sole()->youtube_id);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos', [
            ...$base,
            'kind' => 'gc',
            'file' => UploadedFile::fake()->createWithContent('guia.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
        ])->assertOk();
        $guide = Teaching::query()->where('kind', 'gc')->sole();
        $this->assertStringStartsWith('/media/recursos/2026/', $guide->file_path);
        $this->assertStringEndsWith('.pdf', $guide->file_path);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/recursos/eliminar', ['id' => $guide->id])->assertOk();
        $this->assertSame(1, Teaching::query()->count());
    }

    public function test_route_levels_and_section_headings_save_with_their_photo_slot(): void
    {
        $this->actingAs($this->superadmin())->postJson(self::ADMIN.'/admin/contenido', [
            'serveTitle' => 'Sirve con nosotros',
            'serveRailTitle' => 'Somos una iglesia *en movimiento*',
            'route_title_1' => 'Nivel uno',
            'route_title_2' => '',
            'route_title_3' => 'Nivel tres',
            'route_text_3' => 'Servir.',
            'baptismVideo' => 'https://youtu.be/dQw4w9WgXcQ',
            'bankSwift' => 'BCPLPEPL',
        ])->assertOk();

        $settings = LoadPublicSite::settings();
        $this->assertSame('Sirve con nosotros', $settings['serveTitle']);
        $this->assertSame('Somos una iglesia *en movimiento*', $settings['serveRailTitle']);
        $this->assertSame([
            ['slot' => 1, 'title' => 'Nivel uno', 'text' => ''],
            ['slot' => 3, 'title' => 'Nivel tres', 'text' => 'Servir.'],
        ], $settings['routeLevels']);
        $this->assertSame('dQw4w9WgXcQ', $settings['baptismVideo']);

        $this->actingAs($this->superadmin('otro'))->postJson(self::ADMIN.'/admin/contenido', ['baptismVideo' => 'no es un video'])
            ->assertUnprocessable();
    }

    private function event(string $title, string $startsOn, array $extra = []): ChurchEvent
    {
        return ChurchEvent::query()->create(['title' => $title, 'starts_on' => $startsOn, 'active' => true, ...$extra]);
    }

    private function superadmin(string $username = 'super'): User
    {
        return User::query()->create([
            'name' => 'Super',
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Superadmin,
            'admin_types' => [],
            'permissions' => [],
            'active' => true,
        ]);
    }
}
