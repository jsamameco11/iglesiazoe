<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Finance\Finance;
use App\Domain\Inbox\Inbox;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\Expense;
use App\Models\Report;
use App\Models\StudyStudent;
use App\Models\Theme;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Panel home: the cards and recent reports each account may see. */
class DashboardController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $can = fn (string $permission) => Permissions::has($user, $permission);
        $now = WeekCalendar::current();
        $scope = CellScope::for($user);
        $cards = [];
        $reports = $can('reports.submit') || $can('reports.weekly') || $can('reports.all');
        $cellIds = $reports ? $scope->viewCellIds() : null;
        $servers = Permissions::any($user, Permissions::SERVER_TREE);
        $tree = $servers ? $scope->treeCellIds() : null;
        $monthRange = [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
        $mine = fn () => Expense::query()->where('user_id', $user->id)->whereBetween('spent_on', $monthRange);

        $counts = $this->countAll(array_filter([
            'sent' => $reports ? Report::query()->where('year', $now['year'])->where('week', $now['week'])
                ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE])) : null,
            'activeCells' => $reports && $cellIds === null ? Cell::query()->where('active', true) : null,
            'users' => $user->isSuperadmin() ? User::query()->where('role', '!=', Role::Student->value) : null,
            'myExpenses' => ! $user->isSuperadmin() && $can('expenses.manage') ? $mine() : null,
            'cells' => $servers ? Cell::query()->where('active', true)->when($tree !== null, fn ($query) => $query->whereIn('id', $tree ?: [CellScope::NONE])) : null,
            'themes' => $can('themes.manage') || $can('content.manage') ? Theme::query()->where('active', true) : null,
        ]));
        $unread = Inbox::unread($user);

        if ($reports) {
            $total = $cellIds === null ? $counts['activeCells'] : count($cellIds);
            $cards[] = ['label' => 'Informes de esta semana', 'value' => "{$counts['sent']} / $total", 'href' => $can('reports.all') ? '/admin/informes' : '/portal/seguimiento', 'note' => "Semana {$now['week']} ┬À {$now['year']}", 'accent' => 'bg-blush'];
        }
        if ($user->isSuperadmin()) {
            $month = Finance::summary(Period::currentMonth());
            $cards[] = ['label' => 'Ingresos del mes', 'value' => Finance::money($month['income']), 'href' => '/admin/finanzas', 'note' => 'Ofrendas y diezmos', 'accent' => 'bg-mist'];
            $cards[] = ['label' => 'Gastos del mes', 'value' => Finance::money($month['expenses']), 'href' => '/admin/finanzas', 'note' => 'Compras con boleta o factura', 'accent' => 'bg-amber'];
            $cards[] = ['label' => 'Equipo', 'value' => (string) $counts['users'], 'href' => '/admin/equipo', 'note' => 'Cuentas activas del panel', 'accent' => 'bg-sky'];
        } elseif ($can('expenses.manage')) {
            $cards[] = ['label' => 'Mis gastos del mes', 'value' => Finance::money((float) $mine()->sum('amount')), 'href' => '/admin/gastos', 'note' => $counts['myExpenses'].' compras registradas', 'accent' => 'bg-amber'];
        }
        if ($servers) {
            $note = match (true) {
                $tree === null => 'Todas las redes',
                $scope->leadsNetwork() && $scope->network !== null => "Red {$scope->network->code}",
                default => 'Tu servidor y sus servidores hijo',
            };
            $cards[] = ['label' => 'Servidores', 'value' => (string) $counts['cells'], 'href' => '/admin/servidores', 'note' => $note, 'accent' => 'bg-sage'];
        }
        if ($can('notices.manage')) {
            $notice = LoadPublicSite::weeklyNotice();
            $count = count($notice['points']);
            $cards[] = ['label' => 'Indicaciones de la semana', 'value' => $count.' '.($count === 1 ? 'punto' : 'puntos'), 'href' => '/admin/indicaciones', 'note' => $notice['enabled'] ? 'Visibles al ingresar a /acceso' : 'Ocultas por ahora', 'accent' => 'bg-mist'];
        }
        if ($can('themes.manage') || $can('content.manage')) {
            $latest = Theme::query()->where('active', true)->orderByDesc('theme_date')->first();
            $cards[] = ['label' => 'Temas de c├®lula', 'value' => (string) $counts['themes'], 'href' => '/admin/temas', 'note' => $latest ? '├Ültimo: '.$latest->title : 'A├║n no hay temas', 'accent' => 'bg-blush'];
        }
        if ($can('studies.students') || $can('studies.grades') || $can('studies.board')) {
            $students = StudyStudent::query()->where('status', 'cursando')->count();
            $href = $can('studies.students') ? '/admin/estudios' : ($can('studies.grades') ? '/admin/estudios/notas' : '/admin/estudios/avisos');
            $cards[] = ['label' => 'Ruta del Servidor', 'value' => $students.' '.($students === 1 ? 'estudiante' : 'estudiantes'), 'href' => $href, 'note' => 'Cursando un nivel ahora', 'accent' => 'bg-sky'];
        }
        $inboxAccents = ['visitas' => 'bg-dusk', 'bautismos' => 'bg-clay', 'oraciones' => 'bg-sky', 'servidores' => 'bg-sage'];
        foreach ($unread as $kind => $count) {
            $cards[] = [
                'label' => Inbox::KINDS[$kind]['title'],
                'value' => (string) $count,
                'href' => Inbox::url($kind),
                'note' => $count === 1 ? 'Nueva desde tu ├║ltima revisi├│n' : 'Nuevas desde tu ├║ltima revisi├│n',
                'accent' => $inboxAccents[$kind],
            ];
        }

        $recent = [];
        if ($can('reports.all') || $can('reports.weekly')) {
            $recent = Report::query()->with(['cell', 'photos'])
                ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE]))
                ->latest('updated_at')->limit(5)->get()
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'code' => $row->cell?->code,
                    'met' => $row->met,
                    'theme_title' => $row->theme_title,
                    'week' => $row->week,
                    'year' => $row->year,
                    'photos' => $row->photos->count(),
                ]);
        }

        return Inertia::render('Admin/Dashboard', [
            'cards' => $cards,
            'recent' => $recent,
            'name' => $user->name,
        ]);
    }

    /**
     * @param  array<string, Builder>  $queries
     * @return array<string, int>
     */
    private function countAll(array $queries): array
    {
        if ($queries === []) {
            return [];
        }
        $select = DB::query();
        foreach ($queries as $name => $query) {
            $select->selectSub($query->toBase()->selectRaw('count(*)'), $name);
        }
        $row = (array) $select->first();

        return array_map(fn ($value) => (int) $value, $row);
    }
}
