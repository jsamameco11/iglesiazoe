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
use Illuminate\Support\Facades\Hash;
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

    public function test_servidor_de_red_holds_his_cell_under_the_network_letter(): void
    {
        $leader = $this->networkLeader($this->networkA);
        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ownCell.choices.network', 'A')
                ->where('ownCell.choices.numbered', '01A'));

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'network', 'meeting_day' => 'Jueves', 'meeting_time' => '20:00'])
            ->assertOk();

        $cell = Cell::query()->where('code', 'A')->firstOrFail();
        $this->assertTrue($cell->isNetworkCell());
        $this->assertTrue($leader->fresh()->cells->contains($cell));
        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('ownCell.cell.code', 'A')
                ->where('networks.0.servers.0.code', 'A')
                ->where('networks.0.servers.0.level', 'red')
                ->where('networks.0.servers.0.can_add_child', false)
                ->where('networks.0.servers.0.can_give_account', false)
                ->where('networks.0.totals.servers', 0));
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores', ['network_id' => $this->networkA->id, 'leader_name' => 'Primer servidor'])
            ->assertOk();
        $this->assertTrue(Cell::query()->where('code', '01A')->exists());
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/hijo', ['parent_id' => $cell->id, 'leader_name' => 'Hijo'])
            ->assertForbidden();
        $this->actingAs($leader)
            ->get(self::SITE.'/portal/informe')
            ->assertInertia(fn (AssertableInertia $page) => $page->has('cells', 1)->where('cells.0.code', 'A'));

        $second = $this->networkLeader($this->networkA, 'red.segundo');
        $this->actingAs($second)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('ownCell.choices.network', null));
        $this->actingAs($second)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'network'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('kind');
    }

    public function test_servidor_de_red_takes_a_cell_of_his_network_without_an_account(): void
    {
        $free = $this->cell($this->networkA, 1);
        $taken = $this->cell($this->networkA, 2);
        $this->cellServer($taken, Permissions::SERVER_ACCOUNT);
        $foreign = $this->cell($this->networkB, 1);
        $leader = $this->networkLeader($this->networkA);

        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page->has('ownCell.choices.free', 1)->where('ownCell.choices.free.0.code', '01A'));
        foreach ([$taken, $foreign] as $cell) {
            $this->actingAs($leader)
                ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'existing', 'cell_id' => $cell->id])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('cell_id');
        }
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'existing', 'cell_id' => $free->id])
            ->assertOk();

        $this->assertSame($leader->name, $free->fresh()->leader_name);
        $this->assertTrue($leader->fresh()->cells->contains($free));
        $this->assertSame(3, Cell::query()->count());
    }

    public function test_servidor_de_red_opens_his_own_cell_once(): void
    {
        $this->cell($this->networkA, 1);
        $leader = $this->networkLeader($this->networkA);

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'numbered', 'meeting_day' => 'Jueves', 'meeting_time' => '20:00'])
            ->assertOk();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/mi-celula', ['kind' => 'network'])
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

    public function test_assigning_a_servidor_de_red_needs_the_network_function(): void
    {
        $leader = $this->networkLeader($this->networkA);
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red', ['network_id' => $this->networkA->id, 'name' => 'Otro', 'username' => 'otro.red', 'password' => 'secreto1'])
            ->assertForbidden();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red/actualizar', ['id' => $leader->id, 'name' => 'Cambio', 'username' => $leader->username, 'active' => true])
            ->assertForbidden();
        $this->actingAs($leader)
            ->get(self::SITE.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('networks.0.can_manage_leaders', false));
    }

    public function test_a_network_has_at_most_two_active_servidores_de_red(): void
    {
        $super = $this->superadmin();
        $assign = fn (string $username, ?Network $network = null) => $this->actingAs($super)->postJson(self::ADMIN.'/admin/servidores/red', ['network_id' => ($network ?? $this->networkA)->id, 'name' => ucfirst($username), 'username' => $username, 'password' => 'secreto1']);

        $assign('red.uno')->assertOk();
        $assign('red.dos')->assertOk();
        $assign('red.tres')->assertUnprocessable()->assertJsonValidationErrors('network_id');
        $this->assertFalse(User::query()->where('username', 'red.tres')->exists());

        $first = User::query()->where('username', 'red.uno')->firstOrFail();
        $edit = fn (User $leader, bool $active) => $this->actingAs($super)->postJson(self::ADMIN.'/admin/servidores/red/actualizar', ['id' => $leader->id, 'name' => $leader->name, 'username' => $leader->username, 'active' => $active]);
        $edit($first, false)->assertOk();
        $assign('red.tres')->assertOk();
        $edit($first, true)->assertUnprocessable()->assertJsonValidationErrors('network_id');
        $this->assertFalse($first->fresh()->active);

        $this->actingAs($super)
            ->get(self::ADMIN.'/admin/servidores')
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('leaderLimit', 2)
                ->has('networks.0.leaders', 3)
                ->where('networks.0.can_manage_leaders', true));
        $assign('red.otra.red', $this->networkB)->assertOk();
    }

    public function test_an_administrator_with_the_function_manages_servidores_de_red(): void
    {
        $admin = $this->user('coordinador', Role::Admin, [], ['servers.network']);
        $this->actingAs($admin)
            ->postJson(self::ADMIN.'/admin/servidores/red', ['network_id' => $this->networkB->id, 'name' => 'Rosa Red', 'username' => 'rosa.red', 'password' => 'secreto1'])
            ->assertOk();
        $leader = User::query()->where('username', 'rosa.red')->firstOrFail();

        $this->actingAs($admin)
            ->postJson(self::ADMIN.'/admin/servidores/red/actualizar', ['id' => $leader->id, 'name' => 'Rosa María', 'username' => '45678912', 'password' => 'nueva123', 'active' => true])
            ->assertOk();
        $leader->refresh();
        $this->assertSame('Rosa María', $leader->name);
        $this->assertSame('45678912', $leader->username);
        $this->assertSame('45678912', $leader->dni);
        $this->assertTrue(Hash::check('nueva123', $leader->password));
        $this->assertSame(['red'], $leader->admin_types);

        $this->actingAs($admin)
            ->postJson(self::ADMIN.'/admin/servidores/red/actualizar', ['id' => $admin->id, 'name' => 'Yo', 'username' => 'coordinador', 'active' => true])
            ->assertNotFound();
        $this->actingAs($admin)
            ->postJson(self::ADMIN.'/admin/servidores/red/actualizar', ['id' => $leader->id, 'name' => 'Rosa', 'username' => 'coordinador', 'active' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('username');
    }

    public function test_a_servidor_de_red_with_the_function_stays_inside_his_network(): void
    {
        $leader = $this->networkLeader($this->networkA, permissions: [...Permissions::forTypes(['red']), 'servers.network']);
        $other = $this->networkLeader($this->networkB, 'red.b');

        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red', ['network_id' => $this->networkB->id, 'name' => 'Intruso', 'username' => 'intruso', 'password' => 'secreto1'])
            ->assertForbidden();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red/actualizar', ['id' => $other->id, 'name' => 'Cambio', 'username' => 'red.b', 'active' => false])
            ->assertForbidden();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red/actualizar', ['id' => $leader->id, 'name' => $leader->name, 'username' => $leader->username, 'active' => false])
            ->assertUnprocessable();
        $this->actingAs($leader)
            ->postJson(self::SITE.'/admin/servidores/red', ['network_id' => $this->networkA->id, 'name' => 'Compañero', 'username' => 'red.companero', 'password' => 'secreto1'])
            ->assertOk();
        $this->assertTrue($other->fresh()->active);
        $this->assertTrue($leader->fresh()->active);
    }

    public function test_equipo_y_accesos_respects_the_limit_of_servidores_de_red(): void
    {
        $this->networkLeader($this->networkA, 'red.uno');
        $this->networkLeader($this->networkA, 'red.dos');
        $admin = $this->user('apoyo', Role::Admin, ['visuales'], Permissions::forTypes(['visuales']));
        $super = $this->superadmin();

        $this->actingAs($super)
            ->postJson(self::ADMIN.'/admin/equipo', ['name' => 'Tercero', 'username' => 'red.tres', 'password' => 'secreto1', 'types' => ['red'], 'network_code' => 'A'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('network_id');
        $this->actingAs($super)
            ->postJson(self::ADMIN.'/admin/equipo/actualizar', ['id' => $admin->id, 'name' => 'Apoyo', 'types' => ['red', 'visuales'], 'network_code' => 'A', 'active' => true])
            ->assertUnprocessable();
        $this->actingAs($super)
            ->postJson(self::ADMIN.'/admin/equipo/actualizar', ['id' => $admin->id, 'name' => 'Apoyo', 'types' => ['red', 'visuales'], 'network_code' => 'B', 'active' => true])
            ->assertOk();
        $this->assertSame(['red', 'visuales'], $admin->fresh()->admin_types);
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
