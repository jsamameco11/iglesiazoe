<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Http\Controllers\Controller;
use App\Models\Network;
use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $period = Period::fromRequest($request, ['semana', 'mes', 'anio']);
        $cellIds = CellScope::for($user)->viewCellIds();
        $networks = Network::query()->orderBy('code')->get(['id', 'code']);
        $network = $networks->firstWhere('code', strtoupper((string) $request->query('red')));
        $status = in_array($request->query('estado'), ['si', 'no'], true) ? $request->query('estado') : '';
        $superadmin = $user->isSuperadmin();
        $showMoney = $superadmin || (Permissions::has($user, 'offerings.weekly') && $period->mode === 'semana');

        $reports = Report::query()->with(['cell.network', 'user', 'attendance', 'photos'])
            ->whereBetween('year', [$period->from->year - 1, $period->to->year + 1])
            ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE]))
            ->when($network, fn ($query) => $query->whereHas('cell', fn ($cell) => $cell->where('network_id', $network->id)))
            ->when($status !== '', fn ($query) => $query->where('met', $status === 'si'))
            ->orderByDesc('year')->orderByDesc('week')
            ->get()
            ->filter(function (Report $report) use ($period) {
                $date = $report->meeting_date ? Carbon::parse($report->meeting_date) : WeekCalendar::range($report->year, $report->week)[0];

                return $period->includes((int) $report->year, (int) $report->week, $date->toDateString());
            })
            ->take(300)
            ->values();

        $rows = $reports->map(fn (Report $report) => [
            'report' => [
                'id' => $report->id,
                'year' => $report->year,
                'week' => $report->week,
                'met' => $report->met,
                'meeting_date' => optional($report->meeting_date)->toDateString(),
                'modality' => $report->modality,
                'theme_title' => $report->theme_title,
                'offering' => $showMoney ? (float) $report->offering : null,
                'tithes' => $superadmin ? (float) $report->attendance->sum('tithe') : null,
                'salvations' => $report->salvations,
                'families' => $report->families,
                'guests' => $report->guests,
                'cell_code' => $report->cell?->code,
                'network' => $report->cell?->network?->code,
                'leader' => $report->user?->name ?: $report->cell?->leader_name ?: 'Usuario sin nombre',
                'username' => $report->user?->username,
                'attendance' => $report->attendance->where('attended', true)->count(),
            ],
            'photos' => $report->photos->map(fn ($photo) => [
                'id' => $photo->id,
                'previewUrl' => MediaLibrary::privateUrl($photo->file_path, 120),
                'downloadUrl' => MediaLibrary::privateUrl($photo->file_path, 120, ($report->cell?->code ?: 'informe').'-semana-'.$report->week.'-'.basename($photo->file_path)),
                'fileName' => basename($photo->file_path),
            ]),
        ]);

        return Inertia::render('Admin/Informes', [
            'rows' => $rows,
            'showMoney' => $showMoney,
            'showTithes' => $superadmin,
            'allowed' => true,
            'filters' => [...$period->filters, 'red' => $network?->code ?? '', 'estado' => $status],
            'label' => $period->label,
            'weeks' => WeekCalendar::weeksOfYear((int) $period->filters['anio']),
            'networks' => $networks->pluck('code'),
            'totals' => [
                'reports' => $rows->count(),
                'met' => $reports->where('met', true)->count(),
                'attendance' => $rows->sum(fn ($row) => $row['report']['attendance']),
                'salvations' => $reports->sum('salvations'),
                'offering' => $showMoney ? round($reports->sum(fn ($report) => (float) $report->offering), 2) : null,
            ],
        ]);
    }
}
