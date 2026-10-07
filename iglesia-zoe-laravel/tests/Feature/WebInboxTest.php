<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Inbox\Inbox;
use App\Domain\Inbox\NetworkRoute;
use App\Domain\Shared\Enums\Role;
use App\Models\BaptismRegistration;
use App\Models\PrayerRequest;
use App\Models\PushSubscription;
use App\Models\User;
use App\Models\VisitPlan;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class WebInboxTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('geo_countries')->insert(['code' => 'PE', 'name' => 'Perú', 'dial' => '51', 'region_label' => 'Departamento', 'city_label' => 'Provincia', 'district_label' => 'Distrito']);
        DB::table('geo_regions')->insert(['country_code' => 'PE', 'name' => 'Lambayeque']);
    }

    public static function routes(): array
    {
        return [
            'niño' => [10, 'Soltero(a)', 'H'],
            'un día antes de los 17' => [16, 'Soltero(a)', 'H'],
            '17 años' => [17, 'Soltero(a)', 'K'],
            '28 años casado' => [28, 'Casado(a)', 'K'],
            '29 soltero' => [29, 'Soltero(a)', 'I'],
            '60 soltero' => [60, 'Soltero(a)', 'I'],
            '29 casado' => [29, 'Casado(a)', 'I'],
            '43 casado' => [43, 'Casado(a)', 'I'],
            '44 casado' => [44, 'Casado(a)', 'resto'],
            '35 conviviente' => [35, 'Conviviente', 'resto'],
            '50 viudo' => [50, 'Viudo(a)', 'resto'],
        ];
    }

    #[DataProvider('routes')]
    public function test_each_person_goes_to_the_network_of_their_age_and_marital_status(int $age, string $marital, string $expected): void
    {
        $this->assertSame($expected, NetworkRoute::key($age, $marital));
    }

    public function test_resto_de_redes_gets_a_drawn_color_that_stays_the_same(): void
    {
        $first = NetworkRoute::for(50, 'Viudo(a)', 'abc');

        $this->assertSame('RESTO DE REDES', $first['label']);
        $this->assertMatchesRegularExpression('/^#[0-9A-F]{6}$/', $first['color']);
        $this->assertSame($first, NetworkRoute::for(50, 'Viudo(a)', 'abc'));
        $this->assertNotContains($first['color'], ['#E8711F', '#2F9E5B', '#E0609A']);
    }

    public function test_prayer_request_asks_for_names_age_and_marital_status(): void
    {
        $this->postJson(self::SITE.'/contacto', ['first_name' => 'Ana', 'request' => 'Por mi familia, gracias.'])->assertUnprocessable();

        $this->postJson(self::SITE.'/contacto', [
            'first_name' => ' Ana María ',
            'last_name' => 'Torres',
            'age' => 22,
            'marital_status' => 'Soltero(a)',
            'request' => 'Por mi familia, gracias.',
        ])->assertOk();

        $prayer = PrayerRequest::query()->sole();
        $this->assertSame('Ana María Torres', $prayer->full_name);
        $this->assertSame(22, $prayer->age);
        $this->assertSame('K', NetworkRoute::key($prayer->age, $prayer->marital_status));
    }

    public function test_baptism_registration_asks_for_marital_status(): void
    {
        $payload = ['first_name' => 'Luis', 'last_name' => 'Rojas', 'sex' => 'Masculino', 'age' => 33, 'country_code' => 'PE', 'phone_code' => '51', 'phone' => '987654321'];

        $this->postJson(self::SITE.'/bautismos', $payload)->assertUnprocessable()->assertJsonPath('error', 'Completa el campo estado civil.');
        $this->postJson(self::SITE.'/bautismos', [...$payload, 'marital_status' => 'Casado(a)'])->assertOk();

        $this->assertSame('Casado(a)', BaptismRegistration::query()->sole()->marital_status);
    }

    public function test_red_atmosfera_and_visuales_see_every_planned_visit_with_its_network(): void
    {
        $this->visit('Rosa', 15, 'Soltero(a)');
        $this->visit('Pedro', 40, 'Casado(a)');

        foreach ([['red', self::SITE], ['atmosfera', self::ADMIN], ['visuales', self::ADMIN]] as [$type, $host]) {
            $this->actingAs($this->account($type))
                ->get($host.'/admin/formularios/visitas')
                ->assertOk()
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->component('Admin/Formularios')
                    ->has('rows', 2)
                    ->where('rows.0.full_name', 'Pedro Díaz')
                    ->where('rows.0.network.label', 'RED I')
                    ->where('rows.1.network.label', 'RED H')
                    ->where('rows.1.service', 'Domingos 10:30 a.m.')
                    ->where('rows.1.region', 'Lambayeque')
                    ->where('rows.1.visit_date', fn (string $date) => CarbonImmutable::parse($date)->isSunday())
                    ->has('tabs', 4));
        }
    }

    public function test_the_notification_names_the_service_and_the_place_only_when_given(): void
    {
        $this->visit('Rosa', 15, 'Soltero(a)');
        $this->postJson(self::SITE.'/visita', [
            'first_name' => 'Luis',
            'last_name' => 'Ramos',
            'phone_code' => '51',
            'phone' => '912345678',
            'sex' => 'Masculino',
            'age' => 33,
            'marital_status' => 'Casado(a)',
            'service' => 'Miércoles 8:00 p.m.',
        ])->assertOk();

        [$withPlace, $withoutPlace] = VisitPlan::query()->orderBy('created_at')->get()->all();

        $this->assertSame('Nueva visita planificada · RED H', Inbox::headline('visitas', $withPlace)['title']);
        $this->assertSame('Rosa Díaz, 15 años · Domingos 10:30 a.m. · Lambayeque', Inbox::headline('visitas', $withPlace)['body']);
        $this->assertSame('Luis Ramos, 33 años · Miércoles 8:00 p.m.', Inbox::headline('visitas', $withoutPlace)['body']);
    }

    public function test_superadmin_sees_every_tab(): void
    {
        $super = $this->user('super', Role::Superadmin, [], []);

        foreach (['visitas', 'bautismos', 'oraciones', 'servidores'] as $kind) {
            $this->actingAs($super)->get(self::ADMIN.'/admin/formularios/'.$kind)->assertOk();
        }
    }

    public function test_accounts_without_the_function_do_not_see_the_forms(): void
    {
        $celula = $this->account('celula');
        $this->actingAs($celula)->get(self::SITE.'/admin/formularios/visitas')->assertRedirect('/admin');

        $limited = $this->user('solo.oracion', Role::Admin, ['atmosfera'], ['expenses.manage', 'inbox.prayers']);
        $this->actingAs($limited)->get(self::ADMIN.'/admin/formularios/oraciones')->assertOk();
        $this->actingAs($limited)->get(self::ADMIN.'/admin/formularios/visitas')->assertRedirect('/admin');
    }

    public function test_new_submissions_count_until_the_tab_is_opened(): void
    {
        $red = $this->account('red');
        $this->visit('Rosa', 15, 'Soltero(a)');

        $this->actingAs($red)->getJson(self::SITE.'/admin/formularios/novedades')->assertJsonPath('unread.visitas', 1);
        $this->actingAs($red)->get(self::SITE.'/admin/formularios/visitas')->assertOk();
        $this->actingAs($red)->getJson(self::SITE.'/admin/formularios/novedades')->assertJsonPath('unread.visitas', 0);

        $this->travel(1)->minutes();
        $this->visit('Pedro', 40, 'Casado(a)');
        $this->actingAs($red)->getJson(self::SITE.'/admin/formularios/novedades')->assertJsonPath('unread.visitas', 1);
    }

    public function test_the_panel_home_counts_every_tab_in_a_single_query(): void
    {
        $super = $this->user('super', Role::Superadmin, [], []);
        $this->visit('Rosa', 15, 'Soltero(a)');
        $this->visit('Pedro', 40, 'Casado(a)');

        DB::enableQueryLog();
        $this->actingAs($super)->get(self::ADMIN.'/admin')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Dashboard')
                ->where('cards', fn ($cards) => collect($cards)->firstWhere('label', 'Visitas planificadas')['value'] === '2'
                    && collect($cards)->firstWhere('label', 'Inscripciones de bautismo')['value'] === '0')
                ->where('inbox.unread.visitas', 2));

        $inboxQueries = collect(DB::getQueryLog())->filter(fn (array $query) => str_contains($query['query'], 'visit_plans'));
        $this->assertCount(2, $inboxQueries, 'one for the home cards, one for the menu badges');
        $this->assertTrue($inboxQueries->every(fn (array $query) => str_contains($query['query'], 'baptism_registrations')));
    }

    public function test_a_device_registers_for_notifications(): void
    {
        $red = $this->account('red');
        $device = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123', 'keys' => ['p256dh' => 'BPublicKey', 'auth' => 'AuthToken'], 'contentEncoding' => 'aes128gcm'];

        $this->actingAs($red)->postJson(self::SITE.'/admin/notificaciones/suscribir', $device)->assertOk();
        $this->actingAs($red)->postJson(self::SITE.'/admin/notificaciones/suscribir', $device)->assertOk();

        $subscription = PushSubscription::query()->sole();
        $this->assertSame($red->id, $subscription->user_id);
        $this->assertSame('BPublicKey', $subscription->public_key);
    }

    public function test_only_the_superadmin_can_turn_notifications_off(): void
    {
        $this->actingAs($this->account('visuales'))->postJson(self::ADMIN.'/admin/notificaciones/silenciar', ['muted' => '1'])->assertForbidden();

        $super = $this->user('super', Role::Superadmin, [], []);
        $this->actingAs($super)->postJson(self::ADMIN.'/admin/notificaciones/silenciar', ['muted' => '1'])->assertOk()->assertJsonPath('muted', true);
        $this->assertTrue($super->fresh()->push_muted);
        $this->actingAs($super)->get(self::ADMIN.'/admin/formularios/oraciones')->assertOk();
    }

    public function test_the_three_types_get_the_form_functions_by_default(): void
    {
        foreach (['red', 'atmosfera', 'visuales'] as $type) {
            $this->assertEmpty(array_diff(Permissions::INBOX, Permissions::forTypes([$type])), $type);
        }
        $this->assertEmpty(array_intersect(Permissions::INBOX, Permissions::forTypes(['celula'])));
    }

    private function visit(string $name, int $age, string $marital): void
    {
        $this->postJson(self::SITE.'/visita', [
            'first_name' => $name,
            'last_name' => 'Díaz',
            'phone_code' => '51',
            'phone' => '987654321',
            'email' => strtolower($name).'@correo.pe',
            'sex' => 'Femenino',
            'age' => $age,
            'marital_status' => $marital,
            'country_code' => 'PE',
            'region' => 'Lambayeque',
            'service' => 'Domingos 10:30 a.m.',
        ])->assertOk();
        $this->travel(1)->seconds();
    }

    private function account(string $type): User
    {
        return $this->user($type.'.cuenta', Role::Admin, [$type], Permissions::forTypes([$type]));
    }

    private function user(string $username, Role $role, array $types, array $permissions): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => $role,
            'admin_types' => $types,
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
