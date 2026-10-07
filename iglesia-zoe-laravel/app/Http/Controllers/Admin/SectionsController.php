<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\ChurchEvent;
use App\Models\PastEvent;
use App\Models\ServeArea;
use App\Models\ServeRegistration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Events, áreas de servicio and the Involúcrate / Ruta del servidor pages of the public site. */
class SectionsController extends Controller
{
    private const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    private const MESSAGES = [
        'required' => 'Completa el campo :attribute.',
        'date' => 'Elige una fecha válida en :attribute.',
        'after_or_equal' => 'La fecha de cierre no puede ser anterior al inicio.',
        'max' => 'El campo :attribute es demasiado largo.',
        'min' => 'Revisa el campo :attribute.',
        'in' => 'Elige una opción válida en :attribute.',
    ];

    public function eventos(): Response
    {
        return Inertia::render('Admin/Eventos', [
            'events' => ChurchEvent::query()->orderByDesc('starts_on')->get()->map->card(),
            'pastEvents' => PastEvent::query()->orderByDesc('held_on')->orderByDesc('created_at')->get()->map->card(),
            'today' => now('America/Lima')->toDateString(),
        ]);
    }

    public function saveEvent(Request $request): JsonResponse
    {
        $existing = $this->find(ChurchEvent::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese evento ya no existe. Recarga la página.', 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:160',
            'starts_on' => 'required|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
            'time_label' => 'nullable|string|max:60',
            'location' => 'nullable|string|max:160',
            'summary' => 'nullable|string|max:300',
            'body' => 'nullable|string|max:3000',
            'cta_label' => 'nullable|string|max:40',
            'cta_url' => ['nullable', 'string', 'max:500', 'regex:~^(https?://|/)~i'],
        ], [...self::MESSAGES, 'cta_url.regex' => 'El enlace del botón debe empezar con https://'], [
            'title' => 'título',
            'starts_on' => 'fecha de inicio',
            'ends_on' => 'fecha de cierre',
            'time_label' => 'hora',
            'location' => 'lugar',
            'summary' => 'resumen',
            'body' => 'información completa',
            'cta_label' => 'texto del botón',
            'cta_url' => 'enlace del botón',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = array_map(fn ($value) => is_string($value) ? (trim($value) ?: null) : $value, $validator->validated());
        $data['active'] = $request->boolean('active');

        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $ext = MediaLibrary::extension($image, self::IMAGE_TYPES);
            if (! $ext || $image->getSize() > 8 * 1024 * 1024) {
                return $this->fail('La imagen debe ser JPG, PNG o WEBP de hasta 8 MB.');
            }
            $data['image_path'] = MediaLibrary::storePublic($image, 'eventos', $ext);
            MediaLibrary::deletePublic($existing?->image_path);
        } elseif ($existing && $request->boolean('remove_image')) {
            MediaLibrary::deletePublic($existing->image_path);
            $data['image_path'] = null;
        }

        $existing ? $existing->update($data) : ChurchEvent::query()->create($data);

        return $this->saved($existing ? 'Evento actualizado.' : 'Evento publicado.');
    }

    public function deleteEvent(Request $request): JsonResponse
    {
        $event = $this->find(ChurchEvent::class, $request->input('id'));
        if ($event) {
            MediaLibrary::deletePublic($event->image_path);
            $event->delete();
        }

        return $this->saved('Evento eliminado.');
    }

    public function areas(): Response
    {
        $counts = ServeRegistration::query()->selectRaw('serve_area_id, count(*) as total')->groupBy('serve_area_id')->pluck('total', 'serve_area_id');

        return Inertia::render('Admin/Involucrate', [
            'areas' => ServeArea::query()->orderBy('sort_order')->get()
                ->map(fn (ServeArea $area) => [...$area->card(), 'registrations' => (int) ($counts[$area->id] ?? 0)]),
        ]);
    }

    public function saveArea(Request $request): JsonResponse
    {
        $existing = $this->find(ServeArea::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Esa área ya no existe. Recarga la página.', 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:80',
            'slug' => 'nullable|string|max:80',
            'tagline' => 'nullable|string|max:120',
            'summary' => 'nullable|string|max:300',
            'body' => 'nullable|string|max:3000',
            'teams' => 'nullable|string|max:1200',
            'cta_label' => 'nullable|string|max:40',
            'cta_url' => ['nullable', 'string', 'max:500', 'regex:~^(https?://|/)~i'],
        ], [...self::MESSAGES, 'cta_url.regex' => 'El enlace del botón debe empezar con https:// o con /'], [
            'name' => 'nombre',
            'slug' => 'dirección web',
            'tagline' => 'frase',
            'summary' => 'resumen',
            'body' => 'descripción',
            'teams' => 'equipos',
            'cta_label' => 'texto del botón',
            'cta_url' => 'enlace del botón',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = array_map(fn ($value) => is_string($value) ? (trim($value) ?: null) : $value, $validator->validated());
        $slug = Str::limit(Str::slug($data['slug'] ?? $data['name']), 80, '');
        if ($slug === '') {
            return $this->fail('La dirección web solo puede tener letras, números y guiones.');
        }
        if (ServeArea::query()->where('slug', $slug)->when($existing, fn ($query) => $query->whereKeyNot($existing->id))->exists()) {
            return $this->fail("Ya existe otra área con la dirección «{$slug}».");
        }
        $teams = collect(preg_split('/\r?\n|,/', (string) ($data['teams'] ?? '')))
            ->map(fn ($team) => Str::limit(trim($team), 80, ''))
            ->filter()->unique()->take(20)->values()->all();

        $payload = [
            ...Arr::only($data, ['name', 'tagline', 'summary', 'body', 'cta_label', 'cta_url']),
            'slug' => $slug,
            'teams' => $teams,
            'accepts_volunteers' => $request->boolean('accepts_volunteers'),
            'active' => $request->boolean('active'),
        ];

        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $ext = MediaLibrary::extension($image, self::IMAGE_TYPES);
            if (! $ext || $image->getSize() > 8 * 1024 * 1024) {
                return $this->fail('La foto debe ser JPG, PNG o WEBP de hasta 8 MB.');
            }
            $payload['image_path'] = MediaLibrary::storePublic($image, 'involucrate', $ext);
            MediaLibrary::deletePublic($existing?->image_path);
        }

        $existing
            ? $existing->update($payload)
            : ServeArea::query()->create([...$payload, 'sort_order' => (int) ServeArea::query()->max('sort_order') + 1]);
        LoadPublicSite::flush();

        return $this->saved($existing ? 'Área actualizada.' : 'Área creada.');
    }

    public function moveArea(Request $request): JsonResponse
    {
        $ids = ServeArea::query()->orderBy('sort_order')->pluck('id')->all();
        $from = array_search($request->input('id'), $ids, true);
        $to = $from === false ? false : $from + ($request->input('direction') === 'up' ? -1 : 1);
        if ($from !== false && isset($ids[$to])) {
            [$ids[$from], $ids[$to]] = [$ids[$to], $ids[$from]];
            foreach ($ids as $index => $id) {
                ServeArea::query()->whereKey($id)->update(['sort_order' => $index + 1]);
            }
            LoadPublicSite::flush();
        }

        return $this->saved();
    }

    public function deleteArea(Request $request): JsonResponse
    {
        $area = $this->find(ServeArea::class, $request->input('id'));
        if ($area) {
            MediaLibrary::deletePublic($area->image_path);
            $area->delete();
            LoadPublicSite::flush();
        }

        return $this->saved('Área eliminada.');
    }

    public function secciones(): Response
    {
        return Inertia::render('Admin/Secciones', [
            'settings' => LoadPublicSite::settings(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
        ]);
    }
}
