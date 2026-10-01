<?php

namespace App\Http\Controllers\Portal;

use App\Domain\Access\CellScope;
use App\Domain\Reports\Support\WeekCalendar;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\CellMember;
use App\Models\Network;
use App\Models\Report;
use App\Models\ReportAttendance;
use App\Models\ReportPhoto;
use App\Models\Theme;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PortalController extends Controller
{
    public function informe(Request $request): Response
    {
        $current = WeekCalendar::current();

        return Inertia::render('Portal/Informe', [
            'cells' => $this->cellsFor($request),
            'year' => $current['year'],
            'week' => $current['week'],
        ]);
    }

    public function loadInforme(Request $request): JsonResponse
    {
        $cellId = (string) $request->query('cell_id');
        $year = (int) $request->query('year');
        $week = (int) $request->query('week');
        if (! $this->canSubmit($request, $cellId)) {
            return response()->json(['error' => 'Esta célula no está asignada a tu cuenta.'], 403);
        }
        $cell = Cell::query()->find($cellId);
        $report = Report::query()->with(['attendance', 'photos'])->where('cell_id', $cellId)->where('year', $year)->where('week', $week)->first();

        $photos = $report?->photos->map(fn ($photo) => [
            'id' => $photo->id,
            'url' => asset('storage/'.$photo->file_path),
        ])->all() ?? [];

        $payload = $report?->toArray();
        if ($payload) {
            $payload['report_attendance'] = $report->attendance->toArray();
            $payload['meeting_date'] = optional($report->meeting_date)->toDateString();
        }

        return response()->json([
            'cell' => $cell,
            'members' => CellMember::query()->where('cell_id', $cellId)->where('active', true)->orderBy('full_name')->get(),
            'report' => $payload,
            'themes' => Theme::query()->where('active', true)->orderByDesc('theme_date')->limit(120)->get()
                ->map(fn ($theme) => [
                    'id' => $theme->id,
                    'title' => $theme->title,
                    'audience' => $theme->audience,
                    'theme_date' => optional($theme->theme_date)->toDateString(),
                    'file_path' => $theme->file_path,
                    'active' => $theme->active,
                ]),
            'photos' => $photos,
        ]);
    }

    public function saveInforme(Request $request): JsonResponse
    {
        $cellId = (string) $request->input('cell_id');
        $year = (int) $request->input('year');
        $week = (int) $request->input('week');
        $met = $request->input('met') === 'si';
        if (! $cellId || ! $year || ! $week) {
            return response()->json(['error' => 'Selecciona año, semana y célula.'], 422);
        }
        if (! $this->canSubmit($request, $cellId)) {
            return response()->json(['error' => 'Esta célula no está asignada a tu cuenta.'], 403);
        }
        if (! $met && ! trim((string) $request->input('reason'))) {
            return response()->json(['error' => 'Indica el motivo por el que no se reunieron.'], 422);
        }

        $report = Report::query()->updateOrCreate(
            ['cell_id' => $cellId, 'year' => $year, 'week' => $week],
            [
                'user_id' => $request->user()->id,
                'met' => $met,
                'reason' => $met ? null : $request->input('reason'),
                'meeting_date' => $met ? $request->input('meeting_date') : null,
                'start_time' => $met ? $request->input('start_time') : null,
                'end_time' => $met ? $request->input('end_time') : null,
                'modality' => $met ? $request->input('modality', 'presencial') : null,
                'theme_id' => $met ? ($request->input('theme_id') ?: null) : null,
                'theme_title' => $met ? $request->input('theme_title') : null,
                'praise_minutes' => $met ? (int) $request->input('praise_minutes') : 0,
                'had_prayer' => $met ? $request->input('had_prayer') === 'si' : null,
                'prayer_notes' => $met ? $request->input('prayer_notes') : null,
                'teaching_minutes' => $met ? (int) $request->input('teaching_minutes') : 0,
                'salvations' => $met ? (int) $request->input('salvations') : 0,
                'spirit_baptisms' => $met ? (int) $request->input('spirit_baptisms') : 0,
                'reconciled' => $met ? (int) $request->input('reconciled') : 0,
                'offering' => $met ? (float) $request->input('offering') : 0,
                'offering_minutes' => $met ? (int) $request->input('offering_minutes') : 0,
                'families' => $met ? (int) $request->input('families') : 0,
                'guests' => $met ? (int) $request->input('guests') : 0,
                'testimonies' => $met ? $request->input('testimonies') : null,
            ],
        );

        if ($met) {
            $report->attendance()->delete();
            $attendance = json_decode((string) $request->input('attendance', '[]'), true) ?: [];
            foreach ($attendance as $row) {
                ReportAttendance::query()->create([
                    'report_id' => $report->id,
                    'member_id' => $row['member_id'] ?: null,
                    'member_name' => $row['member_name'],
                    'attended' => (bool) ($row['attended'] ?? false),
                    'tithe' => (float) ($row['tithe'] ?? 0),
                ]);
            }
            foreach ($request->file('photos', []) as $file) {
                if (! $file) {
                    continue;
                }
                $path = $file->store('informes/'.$request->user()->id.'/'.$report->id, 'public');
                ReportPhoto::query()->create(['report_id' => $report->id, 'file_path' => $path]);
            }
        }

        return response()->json(['ok' => true]);
    }

    public function addParticipant(Request $request): JsonResponse
    {
        $name = trim((string) $request->input('full_name'));
        if (strlen($name) < 3) {
            return response()->json(['error' => 'Escribe el nombre del integrante.'], 422);
        }
        if (! $this->canSubmit($request, (string) $request->input('cell_id'))) {
            return response()->json(['error' => 'Esta célula no está asignada a tu cuenta.'], 403);
        }
        CellMember::query()->create([
            'cell_id' => $request->input('cell_id'),
            'full_name' => $name,
            'active' => true,
        ]);

        return response()->json(['ok' => true]);
    }

    public function historial(Request $request): Response
    {
        $user = $request->user();
        $visible = CellScope::for($user)->viewCellIds();
        $own = Cell::query()->when($visible !== null, fn ($query) => $query->whereIn('id', $visible ?: [CellScope::NONE]))
            ->orderBy('code')->get(['id', 'code'])->map(fn ($cell) => ['id' => $cell->id, 'code' => $cell->code]);
        $query = Report::query()->with(['cell', 'attendance'])->orderByDesc('year')->orderByDesc('week');
        if ($visible !== null) {
            $query->whereIn('cell_id', $visible ?: [CellScope::NONE]);
        }
        if ($request->filled('year')) {
            $query->where('year', (int) $request->query('year'));
        }
        if (Str::isUuid((string) $request->query('cell'))) {
            $query->where('cell_id', $request->query('cell'));
        }
        $month = (string) $request->query('month', '');
        $rows = $query->limit(200)->get()->filter(function ($row) use ($month) {
            if ($month === '') {
                return true;
            }

            return optional($row->meeting_date)?->format('m') === $month;
        })->map(fn ($row) => [
            'id' => $row->id,
            'code' => $row->cell?->code,
            'met' => $row->met,
            'theme_title' => $row->theme_title,
            'meeting_date' => optional($row->meeting_date)->toDateString(),
            'year' => $row->year,
            'week' => $row->week,
            'attended' => $row->attendance->where('attended', true)->count(),
        ])->values();

        return Inertia::render('Portal/Historial', [
            'rows' => $rows,
            'ownCells' => $own,
            'filters' => [
                'year' => $request->query('year', (string) now()->year),
                'month' => $month,
                'cell' => (string) $request->query('cell', ''),
            ],
        ]);
    }

    public function seguimiento(Request $request): Response
    {
        $user = $request->user();
        $scope = CellScope::for($user);
        $now = WeekCalendar::current();
        $year = (int) $request->query('year', $now['year']);
        $week = (int) $request->query('week', $now['week']);
        $networks = Network::query()->orderBy('code')->get(['id', 'code', 'name']);
        $staff = $scope->seesAll();
        $network = $staff
            ? $networks->firstWhere('code', $request->query('red', $scope->network?->code ?? 'A')) ?? $networks->first()
            : ($scope->network ?? $networks->firstWhere('id', Cell::query()->whereIn('id', $scope->own ?: [CellScope::NONE])->value('network_id')));

        $cells = $network
            ? Cell::query()->where('network_id', $network->id)->where('active', true)->orderBy('code')->get()
            : collect();
        $reports = Report::query()->with('attendance')->where('year', $year)->where('week', $week)->whereIn('cell_id', $cells->pluck('id'))->get()->keyBy('cell_id');
        $ordered = $this->orderCells($cells);
        $rows = $ordered->map(function ($cell) use ($reports) {
            $report = $reports->get($cell->id);

            return [
                'id' => $cell->id,
                'code' => $cell->code,
                'parent_id' => $cell->parent_id,
                'leader_name' => $cell->leader_name,
                'attendance' => $report ? $report->attendance->where('attended', true)->count() : 0,
                'salvations' => $report?->salvations ?? 0,
                'families' => $report?->families ?? 0,
                'status' => $report ? ($report->met ? 'Se reunió' : 'No se reunió') : 'Sin informe',
            ];
        });

        return Inertia::render('Portal/Seguimiento', [
            'networks' => $networks,
            'network' => $network,
            'rows' => $rows,
            'totals' => [
                'attendance' => $rows->sum('attendance'),
                'salvations' => $rows->sum('salvations'),
                'families' => $rows->sum('families'),
                'reports' => $rows->where('status', '!=', 'Sin informe')->count(),
            ],
            'filters' => ['year' => $year, 'week' => $week],
            'staff' => $staff,
            'weeks' => WeekCalendar::weeksOfYear($year),
        ]);
    }

    public function themes(): Response
    {
        $themes = Theme::query()->where('active', true)->orderByDesc('theme_date')->get()
            ->map(fn ($theme) => [
                'id' => $theme->id,
                'title' => $theme->title,
                'audience' => $theme->audience,
                'theme_date' => optional($theme->theme_date)->toDateString(),
                'file_path' => $theme->file_path,
                'active' => true,
            ]);

        return Inertia::render('Portal/Temas', ['themes' => $themes]);
    }

    public function themeFile(Request $request): JsonResponse
    {
        $path = (string) $request->query('path');
        if ($path === '' || ! Storage::disk('public')->exists($path)) {
            return response()->json(['error' => 'No se pudo preparar la descarga.'], 404);
        }

        return response()->json(['url' => asset('storage/'.$path)]);
    }

    private function cellsFor(Request $request)
    {
        $ids = CellScope::for($request->user())->submitCellIds();

        return Cell::query()->where('active', true)
            ->when($ids !== null, fn ($query) => $query->whereIn('id', $ids ?: [CellScope::NONE]))
            ->orderBy('code')->get();
    }

    private function canSubmit(Request $request, string $cellId): bool
    {
        if (! Str::isUuid($cellId)) {
            return false;
        }
        $ids = CellScope::for($request->user())->submitCellIds();

        return $ids === null || in_array($cellId, $ids, true);
    }

    private function orderCells($cells)
    {
        $roots = $cells->whereNull('parent_id')->sortBy(['number', 'code']);
        $result = collect();
        foreach ($roots as $root) {
            $result->push($root);
            $result = $result->merge($cells->where('parent_id', $root->id)->sortBy('number'));
        }

        return $result->values();
    }
}
