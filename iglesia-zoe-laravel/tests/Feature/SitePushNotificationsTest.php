<?php

namespace Tests\Feature;

use App\Domain\Inbox\PushDelivery;
use App\Domain\Site\Sermons\SermonSettings;
use App\Models\LiveStream;
use App\Models\PushSubscription;
use App\Models\RadioSlot;
use App\Models\Sermon;
use App\Models\SitePushSubscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class SitePushNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://localhost';

    /** @var object{sent: list<array{to: list<string>, payload: array<string, mixed>, ttl: int}>} */
    private object $delivery;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-07 19:00:00', 'America/Lima'));
        $this->delivery = new class extends PushDelivery
        {
            public array $sent = [];

            public function send(Collection $subscriptions, array $payload, int $ttl = 86400): void
            {
                $this->sent[] = ['to' => $subscriptions->pluck('endpoint')->all(), 'payload' => $payload, 'ttl' => $ttl];
            }
        };
        $this->app->instance(PushDelivery::class, $this->delivery);
    }

    public function test_a_visitor_turns_the_notifications_on_and_off(): void
    {
        config(['services.webpush.public_key' => 'BVapidPublicKey', 'services.webpush.private_key' => 'VapidPrivateKey']);
        $device = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/visitante1', 'keys' => ['p256dh' => 'BPublicKey', 'auth' => 'AuthToken'], 'contentEncoding' => 'aes128gcm'];

        $this->getJson(self::SITE.'/notificaciones/clave')->assertOk()->assertJsonPath('publicKey', 'BVapidPublicKey');
        $this->postJson(self::SITE.'/notificaciones', $device)->assertOk();
        $this->postJson(self::SITE.'/notificaciones', [...$device, 'keys' => ['p256dh' => 'BOtherKey', 'auth' => 'AuthToken']])->assertOk();
        $this->assertSame('BOtherKey', SitePushSubscription::query()->sole()->public_key);

        $this->postJson(self::SITE.'/notificaciones', [...$device, 'endpoint' => 'http://inseguro.test/push'])->assertUnprocessable();

        $this->postJson(self::SITE.'/notificaciones/quitar', ['endpoint' => $device['endpoint']])->assertOk();
        $this->assertSame(0, SitePushSubscription::query()->count());
    }

    public function test_a_radio_program_is_announced_five_minutes_before_it_starts(): void
    {
        SitePushSubscription::factory()->count(2)->create();
        $this->slot('Café con Zoe', RadioSlot::LIVE, '19:04:30');
        $this->slot('Canción suelta', 'musica', '19:03:00');
        $this->slot('Palabra de vida', 'programa', '19:20:00');

        $this->artisan('notifications:send')->assertSuccessful();
        $this->artisan('notifications:send')->assertSuccessful();

        $this->assertCount(1, $this->delivery->sent);
        $notice = $this->delivery->sent[0];
        $this->assertCount(2, $notice['to']);
        $this->assertSame('Radio Zoe · comienza en 5 minutos', $notice['payload']['title']);
        $this->assertSame('«Café con Zoe» empieza a las 7:04 p. m. Toca para escucharlo en vivo.', $notice['payload']['body']);
        $this->assertSame('/radio', $notice['payload']['url']);

        $this->travelTo(CarbonImmutable::parse('2026-10-07 19:16:00', 'America/Lima'));
        $this->artisan('notifications:send')->assertSuccessful();
        $this->assertCount(2, $this->delivery->sent);
        $this->assertStringContainsString('«Palabra de vida»', $this->delivery->sent[1]['payload']['body']);
    }

    public function test_a_new_video_is_announced_once_and_the_first_check_only_takes_note(): void
    {
        SitePushSubscription::factory()->create();
        Sermon::factory()->fromChannel('VideoViejo1')->create(['aired_at' => now()->subHours(5)]);

        $this->artisan('notifications:send')->assertSuccessful();
        $this->assertCount(0, $this->delivery->sent);

        Sermon::factory()->fromChannel('VideoNuevo1')->create(['title' => 'Servicio dominical del 4 de octubre', 'aired_at' => now()->subHour(), 'sermon_date' => '2026-10-07']);
        Sermon::factory()->fromChannel('Atrasado001')->create(['aired_at' => now()->subWeeks(2)]);
        Sermon::factory()->fromChannel('PorRevisar1')->pending()->create(['aired_at' => now()->subHour()]);
        $this->artisan('notifications:send')->assertSuccessful();
        $this->artisan('notifications:send')->assertSuccessful();

        $this->assertCount(1, $this->delivery->sent);
        $this->assertSame('Nueva prédica en la web', $this->delivery->sent[0]['payload']['title']);
        $this->assertSame('«Servicio dominical del 4 de octubre». Mírala ahora.', $this->delivery->sent[0]['payload']['body']);
        $this->assertSame('/predicas?v=VideoNuevo1', $this->delivery->sent[0]['payload']['url']);
    }

    public function test_admins_hear_about_channel_videos_waiting_for_review(): void
    {
        $editor = User::factory()->administrator(['visuales'], ['content.manage'])->create();
        $editor->pushSubscriptions()->create(['endpoint' => 'https://fcm.googleapis.com/fcm/send/editor', 'endpoint_hash' => hash('sha256', 'editor'), 'public_key' => 'BKey', 'auth_token' => 'Auth']);
        $other = User::factory()->administrator(['red'], ['inbox.visits'])->create();
        $other->pushSubscriptions()->create(['endpoint' => 'https://fcm.googleapis.com/fcm/send/red', 'endpoint_hash' => hash('sha256', 'red'), 'public_key' => 'BKey', 'auth_token' => 'Auth']);

        $this->artisan('notifications:send')->assertSuccessful();
        Sermon::factory()->fromChannel()->pending()->create(['title' => 'Servicio de media semana']);
        $this->artisan('notifications:send')->assertSuccessful();
        $this->artisan('notifications:send')->assertSuccessful();

        $this->assertCount(1, $this->delivery->sent);
        $this->assertSame(['https://fcm.googleapis.com/fcm/send/editor'], $this->delivery->sent[0]['to']);
        $this->assertSame('Una prédica nueva espera tu revisión', $this->delivery->sent[0]['payload']['title']);
        $this->assertSame('/admin/predicas', $this->delivery->sent[0]['payload']['url']);
        $this->assertSame(1, PushSubscription::query()->where('user_id', $editor->id)->count());
    }

    public function test_the_live_button_opens_the_broadcast_on_the_sermons_page_and_listeners_are_told_once(): void
    {
        SitePushSubscription::factory()->create();
        LiveStream::factory()->live()->create(['title' => 'Servicio dominical en vivo']);

        $this->artisan('notifications:send')->assertSuccessful();
        $this->artisan('notifications:send')->assertSuccessful();

        $this->assertCount(1, $this->delivery->sent);
        $this->assertSame('Estamos en vivo', $this->delivery->sent[0]['payload']['title']);
        $this->assertSame('/predicas#en-vivo', $this->delivery->sent[0]['payload']['url']);

        $this->visitor('/en-vivo')->assertRedirect('/predicas#en-vivo');
        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page->component('Sermons')
            ->where('live.live', true)
            ->where('live.title', 'Servicio dominical en vivo'));
    }

    public function test_a_service_streamed_straight_to_youtube_is_shown_live_and_its_recording_is_looked_for_when_it_ends(): void
    {
        SermonSettings::save(['channel_url' => 'https://www.youtube.com/@iglesiazoe']);
        SitePushSubscription::factory()->create();
        $onAir = ['videoDetails' => ['videoId' => 'EnVivoZoe01', 'title' => 'Servicio dominical', 'isLive' => true, 'shortDescription' => 'Bienvenidos'],
            'microformat' => ['playerMicroformatRenderer' => ['liveBroadcastDetails' => ['isLiveNow' => true, 'startTimestamp' => now()->subMinutes(3)->toIso8601String()]]]];
        Http::fake([
            'www.youtube.com/@iglesiazoe/live' => Http::sequence()
                ->push('<script>var ytInitialPlayerResponse = '.json_encode($onAir).';</script>')
                ->push('<html>Canal sin transmisión</html>'),
            'www.youtube.com/*' => Http::response('<html></html>'),
        ]);

        $this->artisan('sermons:live')->assertSuccessful();
        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('live.live', true)
            ->where('live.youtube_id', 'EnVivoZoe01')
            ->where('live.title', 'Servicio dominical'));
        $this->artisan('notifications:send')->assertSuccessful();
        $this->artisan('notifications:send')->assertSuccessful();
        $this->assertCount(1, $this->delivery->sent);
        $this->assertSame('Estamos en vivo', $this->delivery->sent[0]['payload']['title']);
        $this->assertSame([], SermonSettings::runs());

        $this->travel(2)->minutes();
        $this->artisan('sermons:live')->assertSuccessful();
        $this->visitor('/predicas')->assertInertia(fn (AssertableInertia $page) => $page->where('live.live', false));
        $this->assertCount(1, SermonSettings::runs());
    }

    private function slot(string $title, string $kind, string $time): RadioSlot
    {
        return RadioSlot::query()->create([
            'starts_at' => CarbonImmutable::parse('2026-10-07 '.$time, 'America/Lima')->utc(),
            'duration' => 1800,
            'kind' => $kind,
            'layer' => RadioSlot::MAIN,
            'title' => $title,
        ]);
    }
}
