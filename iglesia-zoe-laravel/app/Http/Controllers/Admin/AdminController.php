<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Finance\Finance;
use App\Domain\Inbox\Inbox;
use App\Domain\Media\Actions\ManageSiteMedia;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Shared\Enums\Role;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Support\YouTube;
use App\Http\Controllers\Controller;
use App\Models\BaptismEvent;
use App\Models\BaptismRegistration;
use App\Models\Cell;
use App\Models\Expense;
use App\Models\Ministry;
use App\Models\Report;
use App\Models\Sermon;
use App\Models\SiteSetting;
use App\Models\StudyStudent;
use App\Models\Theme;
use App\Models\User;
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
        $tree = $can('servers.create') ? $scope->treeCellIds() : null;
        $monthRange = [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
        $mine = fn () => Expense::query()->where('user_id', $user->id)->whereBetween('spent_on', $monthRange);

        $counts = $this->countAll(array_filter([
            'sent' => $reports ? Report::query()->where('year', $now['year'])->where('week', $now['week'])
                ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: [CellScope::NONE])) : null,
            'activeCells' => $reports && $cellIds === null ? Cell::query()->where('active', true) : null,
            'users' => $user->isSuperadmin() ? User::query()->where('role', '!=', Role::Student->value) : null,
            'myExpenses' => ! $user->isSuperadmin() && $can('expenses.manage') ? $mine() : null,
            'cells' => $can('servers.create') ? Cell::query()->where('active', true)->when($tree !== null, fn ($query) => $query->whereIn('id', $tree ?: [CellScope::NONE])) : null,
            'themes' => $can('themes.manage') || $can('content.manage') ? Theme::query()->where('active', true) : null,
        ]));
        $unread = Inbox::unread($user);

        if ($reports) {
            $total = $cellIds === null ? $counts['activeCells'] : count($cellIds);
            $cards[] = ['label' => 'Informes de esta semana', 'value' => "{$counts['sent']} / $total", 'href' => $can('reports.all') ? '/admin/informes' : '/portal/seguimiento', 'note' => "Semana {$now['week']} · {$now['year']}", 'accent' => 'bg-blush'];
        }
        if ($user->isSuperadmin()) {
            $month = Finance::summary(Period::currentMonth());
            $cards[] = ['label' => 'Ingresos del mes', 'value' => Finance::money($month['income']), 'href' => '/admin/finanzas', 'note' => 'Ofrendas y diezmos', 'accent' => 'bg-mist'];
            $cards[] = ['label' => 'Gastos del mes', 'value' => Finance::money($month['expenses']), 'href' => '/admin/finanzas', 'note' => 'Compras con boleta o factura', 'accent' => 'bg-amber'];
            $cards[] = ['label' => 'Equipo', 'value' => (string) $counts['users'], 'href' => '/admin/equipo', 'note' => 'Cuentas activas del panel', 'accent' => 'bg-sky'];
        } elseif ($can('expenses.manage')) {
            $cards[] = ['label' => 'Mis gastos del mes', 'value' => Finance::money((float) $mine()->sum('amount')), 'href' => '/admin/gastos', 'note' => $counts['myExpenses'].' compras registradas', 'accent' => 'bg-amber'];
        }
        if ($can('servers.create')) {
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
            $cards[] = ['label' => 'Temas de célula', 'value' => (string) $counts['themes'], 'href' => '/admin/temas', 'note' => $latest ? 'Último: '.$latest->title : 'Aún no hay temas', 'accent' => 'bg-blush'];
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
                'note' => $count === 1 ? 'Nueva desde tu última revisión' : 'Nuevas desde tu última revisión',
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

    public function contenido(): Response
    {
        return Inertia::render('Admin/Contenido', ['settings' => LoadPublicSite::settings()]);
    }

    public function generosidad(): Response
    {
        return Inertia::render('Admin/Generosidad', ['settings' => LoadPublicSite::settings()]);
    }

    private const GIVING_KEYS = ['bankSoles', 'bankSolesCci', 'bankDollars', 'bankDollarsCci', 'bankHolder', 'bankSwift', 'yape', 'yapeHolder', 'yapeQr', 'cardUrl'];

    /** Editable lists posted as numbered fields, e.g. route_title_1 / route_text_1. Each item keeps its slot so its photo stays with it. */
    private const LIST_FIELDS = ['routeLevels' => ['route', 6]];

    private const URL_KEYS = ['facebook', 'youtube', 'instagram', 'tiktok', 'messengerUrl', 'liveUrl', 'mapUrl', 'cardUrl', 'yapeQr'];

    private const VALUE_SLOTS = 6;

    private const THEME_FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];

    public function saveSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        $canContent = Permissions::has($user, 'content.manage');
        $canGiving = Permissions::has($user, 'generosity.manage');
        $stored = $this->storedSite();

        $editable = array_diff(array_keys(config('zoe.settings')), [...LoadPublicSite::LIST_SETTINGS, 'copy']);
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
        if (($input['baptismVideo'] ?? '') !== '') {
            $video = YouTube::id($input['baptismVideo']);
            if (! $video) {
                return response()->json(['error' => 'No reconocemos el enlace de YouTube del video de bautismo. Pega el enlace del video o su ID.'], 422);
            }
            $input['baptismVideo'] = $video;
        }
        foreach (['serviceDayMain', 'serviceDayWeek'] as $key) {
            if (isset($input[$key]) && ! preg_match('/^[0-6]$/', $input[$key])) {
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

        foreach (self::LIST_FIELDS as $key => [$prefix, $slots]) {
            if (! $canContent || ! $request->has("{$prefix}_title_1")) {
                continue;
            }
            $items = [];
            for ($i = 1; $i <= $slots; $i++) {
                $title = mb_substr(trim((string) $request->input("{$prefix}_title_$i")), 0, 80);
                if ($title !== '') {
                    $items[] = ['slot' => $i, 'title' => $title, 'text' => mb_substr(trim((string) $request->input("{$prefix}_text_$i")), 0, 400)];
                }
            }
            if ($items) {
                $next[$key] = $items;
            }
        }

        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $next, 'updated_at' => now()]);

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
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'ministries' => collect(LoadPublicSite::ministries())->map(fn ($item) => ['slug' => $item['slug'], 'name' => $item['name']])->all(),
        ]);
    }

    public function saveMedia(Request $request, ManageSiteMedia $media): JsonResponse
    {
        return response()->json($media->save($request));
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
            'registrations' => BaptismRegistration::query()->count(),
        ]);
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
