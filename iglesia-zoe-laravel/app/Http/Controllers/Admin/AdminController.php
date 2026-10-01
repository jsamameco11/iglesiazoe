<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Domain\Finance\Finance;
use App\Domain\Geo\GeoDirectory;
use App\Domain\Media\Actions\ManageSiteMedia;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Support\YouTube;
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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        $reports = $can('reports.submit') || $can('reports.weekly') || $can('reports.all');
        $cellIds = $reports ? $scope->viewCellIds() : null;
        $networks = $can('servers.create') ? $scope->manageNetworkIds() : null;
        $monthRange = [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
        $mine = fn () => Expense::query()->where('user_id', $user->id)->whereBetween('spent_on', $monthRange);

        $counts = $this->countAll(array_filter([
            'sent' => $reports ? Report::query()->where('year', $now['year'])->where('week', $now['week'])
                ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE])) : null,
            'activeCells' => $reports && $cellIds === null ? Cell::query()->where('active', true) : null,
            'users' => $user->isSuperadmin() ? User::query() : null,
            'myExpenses' => ! $user->isSuperadmin() && $can('expenses.manage') ? $mine() : null,
            'cells' => $can('servers.create') ? Cell::query()->where('active', true)->when($networks !== null, fn ($query) => $query->whereIn('network_id', $networks)) : null,
            'themes' => $can('themes.manage') || $can('content.manage') ? Theme::query()->where('active', true) : null,
            'prayers' => $can('content.manage') ? PrayerRequest::query() : null,
            'visits' => $can('content.manage') ? VisitPlan::query() : null,
            'baptisms' => $can('content.manage') ? BaptismRegistration::query() : null,
        ]));

        if ($reports) {
            $total = $cellIds === null ? $counts['activeCells'] : count($cellIds);
            $cards[] = ['label' => 'Informes de esta semana', 'value' => "{$counts['sent']} / $total", 'href' => $can('reports.all') ? '/admin/informes' : '/portal/seguimiento', 'note' => "Semana {$now['week']} · {$now['year']}", 'accent' => 'bg-blush'];
        }
        if ($user->isSuperadmin()) {
            $month = Finance::summary(Period::currentMonth());
            $cards[] = ['label' => 'Ingresos del mes', 'value' => Finance::money($month['income']), 'href' => '/admin/finanzas', 'note' => 'Ofrendas y diezmos', 'accent' => 'bg-mist'];
            $cards[] = ['label' => 'Gastos del mes', 'value' => Finance::money($month['expenses']), 'href' => '/admin/finanzas', 'note' => 'Compras con boleta', 'accent' => 'bg-amber'];
            $cards[] = ['label' => 'Equipo', 'value' => (string) $counts['users'], 'href' => '/admin/equipo', 'note' => 'Cuentas activas del panel', 'accent' => 'bg-sky'];
        } elseif ($can('expenses.manage')) {
            $cards[] = ['label' => 'Mis gastos del mes', 'value' => Finance::money((float) $mine()->sum('amount')), 'href' => '/admin/gastos', 'note' => $counts['myExpenses'].' compras registradas', 'accent' => 'bg-amber'];
        }
        if ($can('servers.create')) {
            $cards[] = ['label' => 'Células', 'value' => (string) $counts['cells'], 'href' => '/admin/servidores', 'note' => $networks !== null && $scope->network ? "Red {$scope->network->code}" : 'Todas las redes', 'accent' => 'bg-sage'];
        }
        if ($can('notices.manage')) {
            $notice = LoadPublicSite::weeklyNotice();
            $count = count($notice['points']);
            $cards[] = ['label' => 'Indicaciones de la semana', 'value' => $count.' '.($count === 1 ? 'punto' : 'puntos'), 'href' => '/admin/indicaciones', 'note' => $notice['enabled'] ? 'Visibles al ingresar a /acceso' : 'Ocultas por ahora', 'accent' => 'bg-mist'];
        }
        if ($can('themes.manage') || $can('content.manage')) {
            $latest = Theme::query()->where('active', true)->orderByDesc('theme_date')->first();
            $cards[] = ['label' => 'Temas de célula', 'value' => (string) $counts['themes'], 'href' => '/admin/temas', 'note' => $latest ? 'Último: '.$latest->title : 'Aún no hay temas', 'accent' => 'bg-blush'];
        }
        if ($can('content.manage')) {
            $cards[] = ['label' => 'Bandeja', 'value' => (string) ($counts['prayers'] + $counts['visits']), 'href' => '/admin/bandeja', 'note' => 'Oraciones y visitas', 'accent' => 'bg-dusk'];
            $cards[] = ['label' => 'Bautismos', 'value' => (string) $counts['baptisms'], 'href' => '/admin/bautismos', 'note' => 'Registros recibidos', 'accent' => 'bg-clay'];
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

    public function contenido(): Response
    {
        return Inertia::render('Admin/Contenido', ['settings' => LoadPublicSite::settings()]);
    }

    public function generosidad(): Response
    {
        return Inertia::render('Admin/Generosidad', ['settings' => LoadPublicSite::settings()]);
    }

    private const GIVING_KEYS = ['bankSoles', 'bankSolesCci', 'bankDollars', 'bankDollarsCci', 'bankHolder', 'yape', 'yapeHolder', 'yapeQr', 'cardUrl'];

    private const COLOR_KEYS = ['headingColor', 'bodyColor', 'accentColor', 'paperColor', 'stoneColor', 'clayColor'];

    private const URL_KEYS = ['facebook', 'youtube', 'instagram', 'tiktok', 'messengerUrl', 'liveUrl', 'mapUrl', 'cardUrl', 'yapeQr'];

    private const VALUE_SLOTS = 6;

    private const THEME_FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];

    public function saveSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        $canContent = Permissions::has($user, 'content.manage');
        $canGiving = Permissions::has($user, 'generosity.manage');
        $stored = $this->storedSite();

        $editable = array_diff(array_keys(config('zoe.settings')), ['values', 'prayerTopics', 'copy']);
        $input = [];
        foreach ($editable as $key) {
            if (! $request->has($key) || ! is_scalar($request->input($key) ?? '')) {
                continue;
            }
            $giving = in_array($key, self::GIVING_KEYS, true);
            if (($giving && ! $canGiving) || (! $giving && ! $canContent)) {
                continue;
            }
            $input[$key] = trim((string) $request->input($key));
        }

        foreach (self::URL_KEYS as $key) {
            $value = $input[$key] ?? '';
            if ($value !== '' && ! preg_match('~^(https?://|/)~i', $value)) {
                return response()->json(['error' => 'Revisa el enlace de «'.$key.'»: debe empezar con https://'], 422);
            }
        }
        if (($input['liveYoutubeId'] ?? '') !== '') {
            $live = YouTube::id($input['liveYoutubeId']);
            if (! $live) {
                return response()->json(['error' => 'No reconocemos el enlace de YouTube en vivo. Pega el enlace del video o su ID.'], 422);
            }
            $input['liveYoutubeId'] = $live;
        }
        foreach (['serviceDayMain', 'serviceDayWeek'] as $key) {
            if (isset($input[$key]) && ! preg_match('/^[0-6]$/', $input[$key])) {
                unset($input[$key]);
            }
        }
        if (isset($input['fontPair']) && ! in_array($input['fontPair'], ['mixed', 'grotesque', 'editorial'], true)) {
            unset($input['fontPair']);
        }
        foreach (self::COLOR_KEYS as $key) {
            if (isset($input[$key]) && ! preg_match('/^#[0-9A-Fa-f]{6}$/', $input[$key])) {
                unset($input[$key]);
            }
        }

        if ($canGiving && $request->hasFile('yapeQrFile')) {
            $file = $request->file('yapeQrFile');
            $ext = $file->isValid() ? strtolower((string) $file->guessExtension()) : '';
            if (! in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true) || $file->getSize() > 4 * 1024 * 1024) {
                return response()->json(['error' => 'El QR debe ser una imagen PNG, JPG o WEBP de hasta 4 MB.'], 422);
            }
            $input['yapeQr'] = MediaLibrary::storePublic($file, 'generosidad', $ext);
            MediaLibrary::deletePublic($stored['yapeQr'] ?? null);
        }

        $next = array_replace($stored, $input);

        if ($canContent && $request->has('value_title_1')) {
            $values = [];
            for ($i = 1; $i <= self::VALUE_SLOTS; $i++) {
                $title = trim((string) $request->input("value_title_$i"));
                if ($title !== '') {
                    $values[] = ['title' => $title, 'text' => trim((string) $request->input("value_text_$i"))];
                }
            }
            if ($values) {
                $next['values'] = $values;
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $next, 'updated_at' => now()]);

        if (array_intersect(self::COLOR_KEYS, array_keys($input))) {
            $settings = LoadPublicSite::settings();
            $design = LoadPublicSite::design();
            $design['palette'] = array_merge($design['palette'] ?? [], [
                'ink' => strtolower($settings['headingColor']),
                'muted' => strtolower($settings['bodyColor']),
                'accent' => strtolower($settings['accentColor']),
                'paper' => strtolower($settings['paperColor']),
                'stone' => strtolower($settings['stoneColor']),
                'clay' => strtolower($settings['clayColor']),
            ]);
            SiteSetting::query()->updateOrCreate(['key' => 'design'], ['value' => $design, 'updated_at' => now()]);
        }

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function textos(): Response
    {
        return Inertia::render('Admin/Textos', ['settings' => LoadPublicSite::settings()]);
    }

    public function saveTexts(Request $request): JsonResponse
    {
        $stored = $this->storedSite();
        $copy = is_array($stored['copy'] ?? null) ? $stored['copy'] : [];
        $posted = $request->input('copy', []);

        foreach (is_array($posted) ? $posted : [] as $key => $value) {
            if (! is_string($key) || ! preg_match('/^[a-z]+\.[A-Za-z0-9]+$/', $key) || ! is_scalar($value ?? '')) {
                continue;
            }
            $value = trim((string) $value);
            if (mb_strlen($value) > 3000) {
                return response()->json(['error' => 'Uno de los textos es demasiado largo (máximo 3000 caracteres).'], 422);
            }
            if ($value === '') {
                unset($copy[$key]);
            } else {
                $copy[$key] = $value;
            }
        }
        $stored['copy'] = $copy;

        if ($request->has('prayerTopics')) {
            $topics = collect(preg_split('/\R/', (string) $request->input('prayerTopics')))
                ->map(fn ($topic) => mb_substr(trim($topic), 0, 60))
                ->filter()
                ->unique()
                ->take(12)
                ->values()
                ->all();
            if ($topics) {
                $stored['prayerTopics'] = $topics;
            } else {
                unset($stored['prayerTopics']);
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $stored, 'updated_at' => now()]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    private function storedSite(): array
    {
        $stored = SiteSetting::query()->where('key', 'site')->first()?->value;

        return is_array($stored) ? $stored : [];
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
        if (! Ministry::query()->exists()) {
            foreach (config('zoe.ministries') as $row) {
                Ministry::query()->create($row);
            }
            LoadPublicSite::flush();
        }

        return Inertia::render('Admin/Ministerios', ['ministries' => Ministry::query()->orderBy('sort_order')->get()]);
    }

    public function saveMinistry(Request $request, ManageSiteMedia $media): JsonResponse
    {
        $id = $request->input('id');
        $existing = $id ? Ministry::query()->find($id) : null;
        if ($id && ! $existing) {
            return response()->json(['error' => 'Ese ministerio ya no existe. Recarga la página.'], 404);
        }
        $name = trim((string) $request->input('name'));
        if ($name === '') {
            return response()->json(['error' => 'Escribe el nombre del ministerio.'], 422);
        }
        $slug = Str::limit(Str::slug(trim((string) $request->input('slug')) ?: $name), 80, '');
        if (! preg_match('/^[a-z0-9-]{1,80}$/', $slug)) {
            return response()->json(['error' => 'La dirección web solo puede tener letras, números y guiones.'], 422);
        }
        $taken = Ministry::query()->where('slug', $slug)->when($existing, fn ($query) => $query->where('id', '!=', $existing->id))->exists();
        if ($taken) {
            return response()->json(['error' => 'Ya existe otro ministerio con la dirección «'.$slug.'».'], 422);
        }
        $accent = (string) $request->input('accent');
        $payload = [
            'slug' => $slug,
            'name' => $name,
            'age_range' => trim((string) $request->input('age_range')),
            'summary' => trim((string) $request->input('summary')),
            'body' => trim((string) $request->input('body')),
            'accent' => preg_match('/^#[0-9A-Fa-f]{6}$/', $accent) ? strtolower($accent) : ($existing->accent ?? '#e8c3a4'),
            'active' => $request->boolean('active'),
        ];

        if ($existing) {
            if ($existing->slug !== $slug) {
                $media->renameMinistry($existing->slug, $slug);
            }
            $existing->update($payload);
        } else {
            Ministry::query()->create([...$payload, 'sort_order' => (int) Ministry::query()->max('sort_order') + 1]);
        }
        LoadPublicSite::flush();

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function moveMinistry(Request $request): JsonResponse
    {
        $ids = Ministry::query()->orderBy('sort_order')->pluck('id')->all();
        $from = array_search($request->input('id'), $ids, true);
        $to = $from === false ? false : $from + ($request->input('direction') === 'up' ? -1 : 1);
        if ($from !== false && isset($ids[$to])) {
            [$ids[$from], $ids[$to]] = [$ids[$to], $ids[$from]];
            $this->renumberMinistries($ids);
        }

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function deleteMinistry(Request $request): JsonResponse
    {
        Ministry::query()->where('id', $request->input('id'))->delete();
        $this->renumberMinistries(Ministry::query()->orderBy('sort_order')->pluck('id')->all());

        return response()->json(['ok' => true, 'reload' => true]);
    }

    private function renumberMinistries(array $ids): void
    {
        foreach (array_values($ids) as $index => $id) {
            Ministry::query()->where('id', $id)->update(['sort_order' => $index + 1]);
        }
        LoadPublicSite::flush();
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
        $payload = $request->only(['title', 'preacher', 'series', 'sermon_date']);
        $payload['is_live'] = $request->boolean('is_live');
        $payload['published'] = $request->boolean('published');
        if (! $payload['title']) {
            return response()->json(['error' => 'El título es obligatorio.'], 422);
        }
        $video = trim((string) $request->input('youtube_id'));
        $payload['youtube_id'] = YouTube::id($video);
        if ($video !== '' && ! $payload['youtube_id']) {
            return response()->json(['error' => 'No reconocemos ese enlace de YouTube. Pega el enlace del video (youtube.com o youtu.be) o su ID.'], 422);
        }
        $id = $request->input('id');
        if ($payload['is_live']) {
            Sermon::query()->when($id, fn ($query) => $query->where('id', '!=', $id))->update(['is_live' => false]);
        }
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
        $cells = Cell::query()->orderBy('code')->when($allowed !== null, fn ($query) => $query->whereIn('network_id', $allowed))->get();

        return Inertia::render('Admin/Celulas', [
            'networks' => Network::query()->orderBy('code')->when($allowed !== null, fn ($query) => $query->whereIn('id', $allowed))->get(['id', 'code', 'name']),
            'cells' => $cells,
            'members' => CellMember::query()->where('active', true)
                ->when($allowed !== null, fn ($query) => $query->whereIn('cell_id', $cells->pluck('id')->all() ?: [CellScope::NONE]))
                ->orderBy('full_name')->get(),
            'canManageMembers' => true,
        ]);
    }

    public function saveCell(Request $request): JsonResponse
    {
        $cell = $this->managedCell($request, $request->input('id'));
        if (! $cell) {
            return $this->outsideNetwork();
        }
        $cell->update([
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
        $network = $this->managedNetwork($request);
        if (! $network) {
            return $this->outsideNetwork();
        }
        $next = (int) Cell::query()->where('network_id', $network->id)->whereNull('parent_id')->max('number') + 1;
        Cell::query()->create([
            'network_id' => $network->id,
            'number' => $next,
            'code' => CellCodes::root(strtoupper($network->code), $next),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function ensureSix(Request $request): JsonResponse
    {
        $network = $this->managedNetwork($request);
        if (! $network) {
            return $this->outsideNetwork();
        }
        $existing = Cell::query()->where('network_id', $network->id)->whereNull('parent_id')->pluck('code');
        for ($number = 1; $number <= 6; $number++) {
            $cellCode = CellCodes::root(strtoupper($network->code), $number);
            if (! $existing->contains($cellCode)) {
                Cell::query()->create(['network_id' => $network->id, 'number' => $number, 'code' => $cellCode, 'active' => true]);
            }
        }

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function createDaughter(Request $request): JsonResponse
    {
        $parent = $this->managedCell($request, $request->input('parent_id'));
        if (! $parent) {
            return $this->outsideNetwork();
        }
        $next = (int) Cell::query()->where('parent_id', $parent->id)->max('number') + 1;
        Cell::query()->create([
            'network_id' => $parent->network_id,
            'parent_id' => $parent->id,
            'number' => $next,
            'code' => CellCodes::daughter($parent->code, $next),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function addMember(Request $request): JsonResponse
    {
        $cell = $this->managedCell($request, $request->input('cell_id'));
        if (! $cell) {
            return $this->outsideNetwork();
        }
        $name = trim((string) $request->input('full_name'));
        if ($name === '') {
            return response()->json(['error' => 'Escribe el nombre del integrante.'], 422);
        }
        CellMember::query()->create([
            'cell_id' => $cell->id,
            'full_name' => $name,
            'phone' => $request->input('phone'),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function removeMember(Request $request): JsonResponse
    {
        $id = (string) $request->input('id');
        $member = Str::isUuid($id) ? CellMember::query()->find($id) : null;
        if (! $member || ! $this->managedCell($request, $member->cell_id)) {
            return $this->outsideNetwork();
        }
        $member->update(['active' => false]);

        return response()->json(['ok' => true, 'reload' => true]);
    }

    public function temas(): Response
    {
        return Inertia::render('Admin/Temas', [
            'themes' => Theme::query()->where('active', true)->orderByDesc('theme_date')->get()->map->card(),
            'accept' => '.'.implode(',.', self::THEME_FILE_TYPES),
        ]);
    }

    public function uploadTheme(Request $request): JsonResponse
    {
        $title = trim((string) $request->input('title'));
        $date = (string) $request->input('theme_date');
        if (mb_strlen($title) < 3 || mb_strlen($title) > 160) {
            return response()->json(['error' => 'Escribe el título del tema (de 3 a 160 caracteres).'], 422);
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! strtotime($date)) {
            return response()->json(['error' => 'Elige la fecha del tema.'], 422);
        }
        $file = $request->file('file');
        if (! $file) {
            return response()->json(['error' => 'Adjunta el archivo del tema.'], 422);
        }
        $ext = $this->themeExtension($file);
        if (! $ext || $file->getSize() > 25 * 1024 * 1024) {
            return response()->json(['error' => 'El archivo debe ser PDF, Word, PowerPoint o una imagen de hasta 25 MB.'], 422);
        }
        Theme::query()->create([
            'title' => $title,
            'audience' => trim((string) $request->input('audience')) ?: 'Iglesia',
            'theme_date' => $date,
            'file_path' => MediaLibrary::storePrivate($file, 'temas/'.substr($date, 0, 4), $ext),
            'active' => true,
        ]);

        return response()->json(['ok' => true, 'reload' => true, 'message' => "Tema «{$title}» publicado."]);
    }

    public function hideTheme(Request $request): JsonResponse
    {
        $id = (string) $request->input('id');
        $theme = Str::isUuid($id) ? Theme::query()->find($id) : null;
        if (! $theme) {
            return response()->json(['error' => 'Ese tema ya no existe.'], 404);
        }
        $theme->update(['active' => false]);

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Tema ocultado.']);
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

    private function managedNetwork(Request $request): ?Network
    {
        $id = (string) $request->input('network_id');
        $network = Str::isUuid($id) ? Network::query()->find($id) : null;

        return $network && $this->managesNetwork($request, $network->id) ? $network : null;
    }

    private function managedCell(Request $request, mixed $id): ?Cell
    {
        $cell = is_string($id) && Str::isUuid($id) ? Cell::query()->find($id) : null;

        return $cell && $this->managesNetwork($request, $cell->network_id) ? $cell : null;
    }

    private function managesNetwork(Request $request, ?string $networkId): bool
    {
        $allowed = CellScope::for($request->user())->manageNetworkIds();

        return $allowed === null || in_array($networkId, $allowed, true);
    }

    private function outsideNetwork(): JsonResponse
    {
        return response()->json(['error' => 'Esa célula no pertenece a tu red.'], 403);
    }

    private function themeExtension(UploadedFile $file): ?string
    {
        if (! $file->isValid()) {
            return null;
        }
        $guessed = strtolower((string) $file->guessExtension());
        $client = strtolower($file->getClientOriginalExtension());
        $office = in_array($guessed, ['', 'zip', 'bin'], true) && in_array($client, ['doc', 'docx', 'ppt', 'pptx'], true);
        $ext = $office ? $client : $guessed;

        return in_array($ext, self::THEME_FILE_TYPES, true) ? $ext : null;
    }
}
