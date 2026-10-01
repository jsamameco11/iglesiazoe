<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Finance\Finance;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FinanceController extends Controller
{
    public function index(Request $request): Response
    {
        $period = Period::fromRequest($request, ['mes', 'semana', 'anio', 'rango']);
        $income = Finance::income($period);
        $expenses = Finance::expenses($period);

        $byNetwork = $income->groupBy('network')->map(fn ($rows, $network) => [
            'network' => $network,
            'offerings' => round($rows->sum('offering'), 2),
            'tithes' => round($rows->sum('tithes'), 2),
            'reports' => $rows->count(),
        ])->sortBy('network')->values();

        $byCategory = $expenses->groupBy('category')->map(fn ($rows, $category) => [
            'category' => $category,
            'amount' => round((float) $rows->sum('amount'), 2),
            'count' => $rows->count(),
        ])->sortByDesc('amount')->values();

        return Inertia::render('Admin/Finanzas', [
            'filters' => $period->filters,
            'label' => $period->label,
            'weeks' => WeekCalendar::weeksOfYear((int) $period->filters['anio']),
            'summary' => Finance::summary($period, $income, $expenses),
            'series' => Finance::series($period, $income, $expenses),
            'byNetwork' => $byNetwork,
            'byCategory' => $byCategory,
            'income' => $income->sortByDesc('date')->take(300)->values(),
            'expenses' => $expenses->map(fn ($expense) => ExpensesController::row($expense))->values(),
        ]);
    }

    public function offerings(Request $request): Response
    {
        $period = Period::fromRequest($request, ['semana']);
        $cellIds = CellScope::for($request->user())->viewCellIds();
        $income = Finance::income($period, $cellIds)->keyBy('cell');
        $cells = Cell::query()->with('network')->where('active', true)
            ->when($cellIds !== null, fn ($query) => $query->whereIn('id', $cellIds ?: [CellScope::NONE]))
            ->orderBy('code')->get();

        $rows = $cells->map(fn (Cell $cell) => [
            'code' => $cell->code,
            'network' => $cell->network?->code ?? '—',
            'leader' => $cell->leader_name,
            'status' => $income->has($cell->code) ? ($income[$cell->code]['met'] ? 'Se reunió' : 'No se reunió') : 'Sin informe',
            'offering' => $income->has($cell->code) ? $income[$cell->code]['offering'] : null,
        ])->sortBy([['network', 'asc'], ['code', 'asc']])->values();

        return Inertia::render('Admin/Ofrendas', [
            'filters' => $period->filters,
            'label' => $period->label,
            'weeks' => WeekCalendar::weeksOfYear((int) $period->filters['anio']),
            'rows' => $rows,
            'weekTotal' => round($income->sum('offering'), 2),
        ]);
    }
}
