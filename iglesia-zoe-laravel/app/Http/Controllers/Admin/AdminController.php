<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Domain\Finance\Finance;
use App\Domain\Geo\GeoDirectory;
use App\Domain\Media\Actions\ManageSiteMedia;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\BaptismEvent;
use App\Models\BaptismRegistration;
use App\Models\Cell;
use App\Models\CellMember;
use App\Models\Expense;
use App\Models\Ministry;
use App\Models\Network;
use App\Models\PrayerRequest;
use App\Models\Report;
use App\Models\Sermon;
use App\Models\SiteSetting;
use App\Models\Theme;
use App\Models\User;
use App\Models\VisitPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $can = fn (string $permission) => Permissions::has($user, $permission);
        $now = WeekCalendar::current();
        $scope = CellScope::for($user);
        $cards = [];

        if ($can('reports.submit') || $can('reports.weekly') || $can('reports.all')) {
            $cellIds = $scope->viewCellIds();
            $sent = Report::query()->where('year', $now['year'])->where('week', $now['week'])
                ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE]))
                ->count();
            $total = $cellIds === null ? Cell::query()->where('active', true)->count() : count($cellIds);
            $cards[] = ['label' => 'Informes de esta semana', 'value' => "$sent / $total", 'href' => $can('reports.all') ? '/admin/informes' : '/portal/seguimiento', 'note' => "Semana {$now['week']} · {$now['year']}", 'accent' => 'bg-blush'];
        }
        if ($user->isSuperadmin()) {
            $month = Finance::summary(Period::currentMonth());
            $cards[] = ['label' => 'Ingresos del mes', 'value' => Finance::money($month['income']), 'href' => '/admin/finanzas', 'note' => 'Ofrendas y diezmos', 'accent' => 'bg-mist'];
            $cards[] = ['label' => 'Gastos del mes', 'value' => Finance::money($month['expenses']), 'href' => '/admin/finanzas', 'note' => 'Compras con boleta', 'accent' => 'bg-amber'];
            $cards[] = ['label' => 'Equipo', 'value' => (string) User::query()->count(), 'href' => '/admin/equipo', 'note' => 'Cuentas activas del panel', 'accent' => 'bg-sky'];
        } elseif ($can('expenses.manage')) {
            $mine = Expense::query()->where('user_id', $user->id)->whereBetween('spent_on', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()]);
            $cards[] = ['label' => 'Mis gastos del mes', 'value' => Finance::money((float) $mine->sum('amount')), 'href' => '/admin/gastos', 'note' => $mine->count().' compras registradas', 'accent' => 'bg-amber'];
        }
        if ($can('servers.create')) {
            $networks = $scope->manageNetworkIds();
            $cells = Cell::query()->where('active', true)->when($networks !== null, fn ($query) => $query->whereIn('network_id', $networks))->count();
            $cards[] = ['label' => 'Células', 'value' => (string) $cells, 'href' => '/admin/servidores', 'note' => $networks !== null && $scope->network ? "Red {$scope->network->code}" : 'Todas las redes', 'accent' => 'bg-sage'];
        }
        if ($can('notices.manage')) {
            $notice = LoadPublicSite::weeklyNotice();
            $count = count($notice['points']);
            $cards[] = ['label' => 'Indicaciones de la semana', 'value' => $count.' '.($count === 1 ? 'punto' : 'puntos'), 'href' => '/admin/indicaciones', 'note' => $notice['enabled'] ? 'Visibles al ingresar a /acceso' : 'Ocultas por ahora', 'accent' => 'bg-mist'];
        }
        if ($can('content.manage')) {
            $cards[] = ['label' => 'Bandeja', 'value' => (string) (PrayerRequest::query()->count() + VisitPlan::query()->count()), 'href' => '/admin/bandeja', 'note' => 'Oraciones y visitas', 'accent' => 'bg-dusk'];
            $cards[] = ['label' => 'Bautismos', 'value' => (string) BaptismRegistration::query()->count(), 'href' => '/admin/bautismos', 'note' => 'Registros recibidos', 'accent' => 'bg-clay'];
        }

        $recent = [];
        if ($can('reports.all') || $can('reports.weekly')) {
            $cellIds = $scope->viewCellIds();
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

    public function contenido(): Response
    {
        return Inertia::render('Admin/Contenido', ['settings' => LoadPublicSite::settings()]);
    }

    public function generosidad(): Response
    {
        return Inertia::render('Admin/Generosidad', ['settings' => LoadPublicSite::settings()]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $current = json_decode((string) $request->input('current', '{}'), true) ?: [];
        $values = [];
        for ($i = 1; $i <= 4; $i++) {
            $title = trim((string) $request->input("value_title_$i"));
            if ($title !== '') {
                $values[] = ['title' => $title, 'text' => trim((string) $request->input("value_text_$i"))];
            }
        }
        $next = array_replace($current, $request->except(['_token', 'current', 'value_title_1', 'value_text_1', 'value_title_2', 'value_text_2', 'value_title_3', 'value_text_3', 'value_title_4', 'value_text_4']));
        if ($values) {
            $next['values'] = $values;
        }
        $next['fontPair'] = in_array($request->input('fontPair'), ['mixed', 'grotesque', 'editorial'], true)
            ? $request->input('fontPair')
            : ($current['fontPair'] ?? 'mixed');
        foreach (['headingColor', 'bodyColor', 'accentColor', 'paperColor', 'stoneColor', 'clayColor'] as $colorKey) {
            $value = (string) ($next[$colorKey] ?? '');
            if (! preg_match('/^#[0-9A-Fa-f]{6}$/', $value)) {
                $next[$colorKey] = $current[$colorKey] ?? config("zoe.settings.$colorKey");
            }
        }
        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $next, 'updated_at' => now()]);
        $design = LoadPublicSite::design();
        $design['palette'] = array_merge($design['palette'] ?? [], [
            'ink' => strtolower($next['headingColor']),
            'muted' => strtolower($next['bodyColor']),
            'accent' => strtolower($next['accentColor']),
            'paper' => strtolower($next['paperColor']),
            'stone' => strtolower($next['stoneColor']),
            'clay' => strtolower($next['clayColor']),
        ]);
        SiteSetting::query()->updateOrCreate(['key' => 'design'], ['value' => $design, 'updated_at' => now()]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function medios(Request $request): Response
    {
        return Inertia::render('Admin/Medios', [
            'allowed' => true,
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'ministries' => collect(LoadPublicSite::ministries())->map(fn ($item) => ['slug' => $item['slug'], 'name' => $item['name']])->all(),
        ]);
    }

    public function saveMedia(Request $request, ManageSiteMedia $media): JsonResponse
    {
        return response()->json($media->save($request));
    }

    public function addGallery(ManageSiteMedia $media): JsonResponse
    {
        return response()->json($media->addGallerySlot());
    }

    public function ministerios(): Response
    {
        $ministries = Ministry::query()->orderBy('sort_order')->get();
        if ($ministries->isEmpty()) {
            $ministries = collect(config('zoe.ministries'));
        }

        return Inertia::render('Admin/Ministerios', ['ministries' => $ministries]);
    }

    public function saveMinistry(Request $request): JsonResponse
    {
        $payload = $request->only(['slug', 'name', 'age_range', 'summary', 'body', 'sort_order', 'accent']);
        $payload['active'] = $request->boolean('active');
        $id = $request->input('id');
        $id ? Ministry::query()->where('id', $id)->update($payload) : Ministry::query()->create($payload);
        LoadPublicSite::flush();

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function predicas(): Response
    {
        return Inertia::render('Admin/Predicas', [
            'sermons' => Sermon::query()->orderByDesc('sermon_date')->get()->map(fn ($sermon) => [
                ...$sermon->toArray(),
                'sermon_date' => optional($sermon->sermon_date)->toDateString(),
            ]),
        ]);
    }

    public function saveSermon(Request $request): JsonResponse
    {
        $payload = $request->only(['title', 'preacher', 'series', 'sermon_date', 'youtube_id']);
        $payload['is_live'] = $request->boolean('is_live');
        $payload['published'] = $request->boolean('published');
        if (! $payload['title']) {
            return response()->json(['error' => 'El título es obligatorio.'], 422);
        }
        $id = $request->input('id');
        $id ? Sermon::query()->where('id', $id)->update($payload) : Sermon::query()->create($payload);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function deleteSermon(Request $request): JsonResponse
    {
        Sermon::query()->where('id', $request->input('id'))->delete();

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function bautismos(): Response
    {
        return Inertia::render('Admin/Bautismos', [
            'events' => BaptismEvent::query()->orderBy('event_date')->get()->map(fn ($event) => [
                'id' => $event->id,
                'event_date' => optional($event->event_date)->toDateString(),
                'location' => $event->location,
                'notes' => $event->notes,
                'active' => $event->active,
            ]),
            'registrations' => $this->baptismRegistrations(),
        ]);
    }

    private function baptismRegistrations(): array
    {
        $countries = array_column(GeoDirectory::countries(), 'name', 'code');
        $events = BaptismEvent::query()->get(['id', 'event_date'])
            ->mapWithKeys(fn ($event) => [$event->id => optional($event->event_date)->toDateString()]);

        return BaptismRegistration::query()->latest()->limit(100)->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'full_name' => $row->full_name,
                'phone' => $row->phone,
                'email' => $row->email,
                'sex' => $row->sex,
                'age' => $row->age,
                'country_code' => $row->country_code,
                'country' => $row->country_code ? ($countries[$row->country_code] ?? $row->country_code) : null,
                'event_date' => $row->event_id ? ($events[$row->event_id] ?? null) : null,
                'notes' => $row->notes,
                'created_at' => optional($row->created_at)->toDateString(),
            ])
            ->all();
    }

    public function saveBaptism(Request $request): JsonResponse
    {
        $payload = [
            'event_date' => $request->input('event_date') ?: null,
            'location' => $request->input('location'),
            'notes' => $request->input('notes'),
            'active' => $request->boolean('active'),
        ];
        $id = $request->input('id');
        $id ? BaptismEvent::query()->where('id', $id)->update($payload) : BaptismEvent::query()->create($payload);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function celulas(Request $request): Response
    {
        $allowed = CellScope::for($request->user())->manageNetworkIds();

        return Inertia::render('Admin/Celulas', [
            'networks' => Network::query()->orderBy('code')->when($allowed !== null, fn ($query) => $query->whereIn('id', $allowed))->get(['id', 'code', 'name']),
            'cells' => Cell::query()->orderBy('code')->when($allowed !== null, fn ($query) => $query->whereIn('network_id', $allowed))->get(),
            'members' => CellMember::query()->where('active', true)->orderBy('full_name')->get(),
            'canManageMembers' => true,
        ]);
    }

    public function saveCell(Request $request): JsonResponse
    {
        Cell::query()->where('id', $request->input('id'))->update([
            'leader_name' => $request->input('leader_name'),
            'assistant_name' => $request->input('assistant_name'),
            'host_name' => $request->input('host_name'),
            'address' => $request->input('address'),
            'meeting_day' => $request->input('meeting_day'),
            'meeting_time' => $request->input('meeting_time'),
            'active' => $request->boolean('active'),
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function createRootCell(Request $request): JsonResponse
    {
        $networkId = $request->input('network_id');
        $code = strtoupper((string) $request->input('network_code'));
        $next = (int) Cell::query()->where('network_id', $networkId)->whereNull('parent_id')->max('number') + 1;
        Cell::query()->create([
            'network_id' => $networkId,
            'number' => $next,
            'code' => CellCodes::root($code, $next),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function ensureSix(Request $request): JsonResponse
    {
        $networkId = $request->input('network_id');
        $code = strtoupper((string) $request->input('network_code'));
        $existing = Cell::query()->where('network_id', $networkId)->whereNull('parent_id')->pluck('code');
        for ($number = 1; $number <= 6; $number++) {
            $cellCode = CellCodes::root($code, $number);
            if (! $existing->contains($cellCode)) {
                Cell::query()->create(['network_id' => $networkId, 'number' => $number, 'code' => $cellCode, 'active' => true]);
            }
        }

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function createDaughter(Request $request): JsonResponse
    {
        $parentId = $request->input('parent_id');
        $next = (int) Cell::query()->where('parent_id', $parentId)->max('number') + 1;
        Cell::query()->create([
            'network_id' => $request->input('network_id'),
            'parent_id' => $parentId,
            'number' => $next,
            'code' => CellCodes::daughter((string) $request->input('parent_code'), $next),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function addMember(Request $request): JsonResponse
    {
        CellMember::query()->create([
            'cell_id' => $request->input('cell_id'),
            'full_name' => $request->input('full_name'),
            'phone' => $request->input('phone'),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function removeMember(Request $request): JsonResponse
    {
        CellMember::query()->where('id', $request->input('id'))->update(['active' => false]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function temas(): Response
    {
        return Inertia::render('Admin/Temas', [
            'themes' => Theme::query()->where('active', true)->orderByDesc('theme_date')->get()->map(fn ($theme) => [
                'id' => $theme->id,
                'title' => $theme->title,
                'audience' => $theme->audience,
                'theme_date' => optional($theme->theme_date)->toDateString(),
                'file_path' => $theme->file_path,
                'active' => true,
            ]),
        ]);
    }

    public function uploadTheme(Request $request): JsonResponse
    {
        $path = null;
        if ($request->hasFile('file')) {
            $path = $request->file('file')->store('temas', 'public');
        }
        Theme::query()->create([
            'title' => $request->input('title'),
            'audience' => $request->input('audience', 'Iglesia'),
            'theme_date' => $request->input('theme_date'),
            'file_path' => $path,
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function hideTheme(Request $request): JsonResponse
    {
        Theme::query()->where('id', $request->input('id'))->update(['active' => false]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function bandeja(): Response
    {
        return Inertia::render('Admin/Bandeja', [
            'prayers' => PrayerRequest::query()->latest()->limit(50)->get(),
            'visits' => VisitPlan::query()->latest()->limit(50)->get()->map(fn ($row) => [
                ...$row->toArray(),
                'visit_date' => optional($row->visit_date)->toDateString(),
            ]),
        ]);
    }
}
