<?php

namespace Tests\Feature;

use App\Models\Sermon;
use App\Models\VisitPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_renders_the_brand_sections_with_the_latest_sermons(): void
    {
        foreach (range(1, 4) as $day) {
            Sermon::query()->create(['title' => "Mensaje $day", 'sermon_date' => "2026-09-0$day", 'published' => true]);
        }

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Home')
                ->where('settings.heroTitle', config('zoe.settings.heroTitle'))
                ->has('ministries', 4)
                ->has('sermons', 3)
                ->where('sermons.0.title', 'Mensaje 4'));
    }

    public function test_quick_visit_with_a_phone_reaches_the_inbox(): void
    {
        $this->postJson('/visita/aviso', ['full_name' => 'Ana María Torres', 'contact' => '987 654 321'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $visit = VisitPlan::query()->sole();
        $this->assertSame('Ana', $visit->first_name);
        $this->assertSame('+51 987654321', $visit->phone);
        $this->assertNull($visit->email);
        $this->assertTrue($visit->visit_date->isSunday());
    }

    public function test_quick_visit_with_an_email_keeps_the_email(): void
    {
        $this->postJson('/visita/aviso', ['full_name' => 'Luis Pérez', 'contact' => 'Luis@Correo.com'])->assertOk();

        $this->assertSame('luis@correo.com', VisitPlan::query()->sole()->email);
    }

    public function test_quick_visit_rejects_an_invalid_contact(): void
    {
        $this->postJson('/visita/aviso', ['full_name' => 'Luis Pérez', 'contact' => 'abc'])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Escribe un correo o un teléfono válido.');

        $this->assertSame(0, VisitPlan::query()->count());
    }
}
