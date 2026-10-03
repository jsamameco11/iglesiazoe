<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\Cell;
use App\Models\Network;
use App\Models\Report;
use App\Models\ReportAttendance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ServerHierarchyTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    private Network $networkA;

    private Network $networkB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->networkA = Network::query()->create(['code' => 'A', 'name' => 'Red A']);
        $this->networkB = Network::query()->create(['code' => 'B', 'name' => 'Red B']);
    }

    public function test_superadmin_assigns_the_servidor_de_red_of_a_network(): void
    {
        $this->actingAs($this->superadmin())
            ->postJson(self::ADMIN.'/admin/servidores/red', ['network_id' => $this->networkA->id, 'name' => 'Carlos Red', 'username' => 'carlos.red', 'password' => 'secreto1'])
            ->assertOk();

        $leader = User::query()->where('username', 'carlos.red')->firstOrFail();
        $this->assertSame(['red'], $leader->admin_types);
        $this->assertSame($this->networkA->id, $leader->network_id);
        $this->assertTrue(Permissions::has($leader, 'servers.create'));
        $this->assertTrue(Permissions::has($leader, 'servers.children'));
        $this->assertTrue(Permissions::has($leader, 'cells.own'));
        $this->assertFalse(Permissions::has($leader, 'reports.delegate'));
    }

    public function test_servidor_de_red_opens_his_own_cell_once(): void
    {
        $this->cell($this->networkA, 1);
        $leader = $this->networkLeader($this->networkA);

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['meeting_day' => 'Jueves', 'meeting_time' => '20:00'])
            ->assertOk();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', [])
            ->assertUnprocessable();

        $cell = Cell::query()->where('code', '02A')->firstOrFail();
        $this->assertNull($cell->parent_id);
        $this->assertSame($leader->name, $cell->leader_name);
        $this->assertTrue($leader->fresh()->cells->contains($cell));
        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ownCell.cell.code', '02A')
                ->where('ownCell.can_open', false));
        $this->actingAs($leader)
            ->get(self::SITE.'/portal/informe')
            ->assertInertia(fn (AssertableInertia $page) => $page->has('cells', 1)->where('cells.0.code', '02A'));
    }

    public function test_servidor_de_red_without_the_function_does_not_open_his_own_cell(): void
    {
        $leader = $this->networkLeader($this->networkA, permissions: array_diff(Permissions::forTypes(['red']), ['cells.own']));

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', [])
            ->assertForbidden();
        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('ownCell', null));
        $this->assertSame(0, Cell::query()->count());
    }

    public function test_superadmin_turns_off_opening_servidores_and_servidores_hijo(): void
    {
        $root = $this->cell($this->networkA, 1);
        $noServers = $this->networkLeader($this->networkA, 'red.sin.servidores', array_diff(Permissions::forTypes(['red']), ['servers.create']));
        $noChildren = $this->networkLeader($this->networkA, 'red.sin.hijos', array_diff(Permissions::forTypes(['red']), ['servers.children']));

        $this->actingAs($noServers)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkA->id, 'leader_name' => 'Nuevo'])
            ->assertForbidden();
        $this->actingAs($noServers)
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $root->id, 'leader_name' => 'Hijo'])
            ->assertOk();
        $this->actingAs($noChildren)
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $root->id, 'leader_name' => 'Otro hijo'])
            ->assertForbidden();
        $this->actingAs($noChildren)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkA->id, 'leader_name' => 'Nuevo'])
            ->assertOk();
        $this->actingAs($noChildren)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('networks.0.can_open', true)
                ->where('networks.0.servers.0.can_add_child', false));

        $this->assertEqualsCanonicalizing(['01A', '0101A', '02A'], Cell::query()->pluck('code')->all());
    }

    public function test_servidor_de_red_files_other_reports_only_when_the_superadmin_allows_it(): void
    {
        $other = $this->cell($this->networkA, 1);
        $leader = $this->networkLeader($this->networkA);
        $own = $this->cell($this->networkA, 2);
        $leader->cells()->attach($own->id);
        $query = fn (Cell $cell) => self::SITE.'/portal/informe/cargar?'.http_build_query(['cell_id' => $cell->id, 'year' => 2026, 'week' => 40]);

        $this->actingAs($leader)->getJson($query($own))->assertOk();
        $this->actingAs($leader)->getJson($query($other))->assertForbidden();

        $leader->update(['permissions' => [...$leader->permissions, 'reports.delegate']]);
        $this->actingAs($leader->fresh())->getJson($query($other))->assertOk();
        $this->actingAs($leader->fresh())
            ->get(self::SITE.'/portal/informe')
            ->assertInertia(fn (AssertableInertia $page) => $page->has('cells', 2));
    }

    public function test_weekly_follow_up_shows_offering_and_tithes_to_the_servidor_de_red_only(): void
    {
        $cell = $this->cell($this->networkA, 1);
        $report = Report::query()->create(['cell_id' => $cell->id, 'year' => 2026, 'week' => 40, 'met' => true, 'offering' => 50, 'salvations' => 2, 'families' => 3]);
        ReportAttendance::query()->create(['report_id' => $report->id, 'member_name' => 'Ana', 'attended' => true, 'tithe' => 20]);
        ReportAttendance::query()->create(['report_id' => $report->id, 'member_name' => 'Luis', 'attended' => true, 'tithe' => 15.5]);
        $url = self::SITE.'/portal/seguimiento?year=2026&week=40';

        $this->actingAs($this->networkLeader($this->networkA))
            ->get($url)
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Portal/Seguimiento')
                ->where('showMoney', true)
                ->where('rows.0.status', 'met')
                ->where('rows.0.attendance', 2)
                ->where('rows.0.offering', fn ($value) => (float) $value === 50.0)
                ->where('rows.0.tithes', fn ($value) => (float) $value === 35.5)
                ->where('totals.offering', fn ($value) => (float) $value === 50.0)
                ->where('totals.tithes', fn ($value) => (float) $value === 35.5)
                ->where('totals.reports', 1));
        $this->actingAs($this->cellServer($cell, Permissions::SERVER_ACCOUNT))
            ->get($url)
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('showMoney', false)
                ->where('rows.0.offering', null)
                ->where('totals.tithes', null));
    }

    public function test_only_the_superadmin_assigns_a_servidor_de_red(): void
    {
        $this->actingAs($this->networkLeader($this->networkA))
            ->postJson(self::SITE.'/admin/servidores/red', ['network_id' => $this->networkA->id, 'name' => 'Otro', 'username' => 'otro.red', 'password' => 'secreto1'])
            ->assertForbidden();
    }

    public function test_servidor_de_red_opens_servidores_only_in_its_network(): void
    {
        $leader = $this->networkLeader($this->networkA);

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkA->id, 'leader_name' => 'Juan Pérez', 'meeting_day' => 'Miércoles', 'meeting_time' => '19:30', 'username' => 'juan', 'password' => 'secreto1'])
            ->assertOk();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkB->id, 'leader_name' => 'Ana'])
            ->assertForbidden();

        $cell = Cell::query()->where('code', '01A')->firstOrFail();
        $account = User::query()->where('username', 'juan')->firstOrFail();
        $this->assertNull($cell->parent_id);
        $this->assertSame('Juan Pérez', $cell->leader_name);
        $this->assertTrue($account->cells->contains($cell));
        $this->assertSame(Permissions::clean(Permissions::SERVER_ACCOUNT), $account->permissions);
    }

    public function test_servidor_adds_servidores_hijo_only_under_its_own_cell(): void
    {
        $own = $this->cell($this->networkA, 1);
        $other = $this->cell($this->networkA, 2);
        $servidor = $this->cellServer($own, Permissions::SERVER_ACCOUNT);

        $this->actingAs($servidor)
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $own->id, 'leader_name' => 'Hijo Uno', 'username' => 'hijo.uno', 'password' => 'secreto1'])
            ->assertOk();
        $this->actingAs($servidor)
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $other->id, 'leader_name' => 'Intruso'])
            ->assertForbidden();
        $this->actingAs($servidor)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkA->id, 'leader_name' => 'Nuevo'])
            ->assertForbidden();

        $child = Cell::query()->where('code', '0101A')->firstOrFail();
        $this->assertSame($own->id, $child->parent_id);
        $this->assertSame(Permissions::clean(Permissions::CHILD_SERVER_ACCOUNT), User::query()->where('username', 'hijo.uno')->firstOrFail()->permissions);
    }

    public function test_servidores_hijo_cannot_have_servidores_hijo(): void
    {
        $root = $this->cell($this->networkA, 1);
        $child = $this->cell($this->networkA, 1, $root);

        $this->actingAs($this->networkLeader($this->networkA))
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $child->id, 'leader_name' => 'Nieto'])
            ->assertForbidden();
        $this->actingAs($this->cellServer($child, Permissions::CHILD_SERVER_ACCOUNT))
            ->get(self::SITE.'/admin/servidores')
            ->assertRedirect();
    }

    public function test_servidor_sees_only_its_cell_and_its_servidores_hijo(): void
    {
        $own = $this->cell($this->networkA, 1);
        $this->cell($this->networkA, 1, $own);
        $this->cell($this->networkA, 2);
        $this->networkLeader($this->networkA);

        $this->actingAs($this->cellServer($own, Permissions::SERVER_ACCOUNT))
            ->get(self::SITE.'/admin/servidores')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Servidores')
                ->has('networks', 1)
                ->where('networks.0.can_open', false)
                ->has('networks.0.leaders', 1)
                ->has('networks.0.servers', 1)
                ->where('networks.0.servers.0.code', '01A')
                ->where('networks.0.servers.0.can_add_child', true)
                ->where('networks.0.servers.0.next_child_code', '0201A')
                ->where('networks.0.servers.0.children.0.code', '0101A'));
    }

    public function test_servidor_de_red_gives_an_account_to_a_servidor_without_one(): void
    {
        $cell = $this->cell($this->networkA, 1);

        $this->actingAs($this->networkLeader($this->networkA))
            ->postJson(self::SITE.'/admin/servidores/cuenta', ['cell_id' => $cell->id, 'username' => 'tardio', 'password' => 'secreto1'])
            ->assertOk();
        $this->actingAs($this->networkLeader($this->networkA, 'red.dos'))
            ->postJson(self::SITE.'/admin/servidores/cuenta', ['cell_id' => $cell->id, 'username' => 'repetido', 'password' => 'secreto1'])
            ->assertUnprocessable();

        $this->assertTrue(User::query()->where('username', 'tardio')->firstOrFail()->cells->contains($cell));
    }

    private function superadmin(): User
    {
        return $this->user('super', Role::Superadmin, [], []);
    }

    private function networkLeader(Network $network, string $username = 'red.lider', ?array $permissions = null): User
    {
        return $this->user($username, Role::Admin, ['red'], array_values($permissions ?? Permissions::forTypes(['red'])), $network);
    }

    private function cellServer(Cell $cell, array $permissions): User
    {
        $user = $this->user('servidor.'.$cell->code, Role::Admin, ['celula'], Permissions::clean($permissions), $cell->network);
        $user->cells()->attach($cell->id);

        return $user;
    }

    private function user(string $username, Role $role, array $types, array $permissions, ?Network $network = null): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@lideres.iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => $role,
            'admin_types' => $types,
            'permissions' => $permissions,
            'network_id' => $network?->id,
            'active' => true,
        ]);
    }

    private function cell(Network $network, int $number, ?Cell $parent = null): Cell
    {
        return Cell::query()->create([
            'network_id' => $network->id,
            'parent_id' => $parent?->id,
            'number' => $number,
            'code' => str_pad((string) $number, 2, '0', STR_PAD_LEFT).($parent?->code ?? $network->code),
            'leader_name' => 'Servidor '.$number,
            'active' => true,
        ]);
    }
}
