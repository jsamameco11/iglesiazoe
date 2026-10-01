<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Domain\Geo\GeoDirectory;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Models\BaptismEvent;
use App\Models\BaptismRegistration;
use App\Models\PrayerRequest;
use App\Models\Sermon;
use App\Models\VisitPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SiteController extends Controller
{
    public const SEXES = ['Masculino', 'Femenino'];

    public const MARITAL_STATUSES = ['Soltero(a)', 'Casado(a)', 'Conviviente', 'Divorciado(a)', 'Separado(a)', 'Viudo(a)'];

    public function home(Request $request): Response
    {
        return $this->page('Home', $request);
    }

    public function marea(Request $request): Response
    {
        return $this->page('Home', $request, true);
    }

    public function about(Request $request): Response
    {
        return $this->page('About', $request);
    }

    public function ministries(Request $request): Response
    {
        return $this->page('Ministries', $request);
    }

    public function ministry(Request $request, string $slug): Response
    {
        $ministry = collect(LoadPublicSite::ministries())->firstWhere('slug', $slug);
        abort_unless($ministry, 404);

        return Inertia::render('Ministry', [
            ...$this->shared($request),
            'ministry' => $ministry,
        ]);
    }

    public function visit(Request $request): Response
    {
        return $this->page('Visit', $request);
    }

    public function baptisms(Request $request): Response
    {
        $events = BaptismEvent::query()->where('active', true)->orderBy('event_date')->get()
            ->map(fn ($event) => [
                'id' => $event->id,
                'event_date' => optional($event->event_date)->toDateString(),
                'location' => $event->location,
            ]);

        return Inertia::render('Baptisms', [
            ...$this->shared($request),
            'events' => $events,
        ]);
    }

    public function sermons(Request $request): Response
    {
        $sermons = Sermon::query()->where('published', true)->orderByDesc('sermon_date')->get()
            ->map(fn ($sermon) => [
                'id' => $sermon->id,
                'title' => $sermon->title,
                'preacher' => $sermon->preacher,
                'series' => $sermon->series,
                'sermon_date' => optional($sermon->sermon_date)->toDateString(),
                'youtube_id' => $sermon->youtube_id,
                'is_live' => $sermon->is_live,
            ]);

        return Inertia::render('Sermons', [
            ...$this->shared($request),
            'sermons' => $sermons,
        ]);
    }

    public function give(Request $request): Response
    {
        return $this->page('Give', $request);
    }

    public function contact(Request $request): Response
    {
        return $this->page('Contact', $request);
    }

    public function storeVisit(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'phone_code' => ['required', Rule::in(GeoDirectory::dialCodes())],
            'phone' => ['required', 'regex:/^[0-9]{6,15}$/'],
            'email' => 'required|email|max:160',
            'sex' => ['required', Rule::in(self::SEXES)],
            'age' => 'required|integer|min:1|max:120',
            'marital_status' => ['required', Rule::in(self::MARITAL_STATUSES)],
            'country_code' => 'required|string|size:2|exists:geo_countries,code',
            'region' => 'required|string|max:160',
            'city' => 'nullable|string|max:160',
            'district' => 'nullable|string|max:160',
            'service' => 'nullable|string|max:80',
        ], [], [
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'phone_code' => 'código de país',
            'phone' => 'teléfono',
            'email' => 'correo',
            'sex' => 'sexo',
            'age' => 'edad',
            'marital_status' => 'estado civil',
            'country_code' => 'país',
            'region' => 'estado o departamento',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $data = $validator->validated();
        $place = GeoDirectory::resolve($data['country_code'], $data['region'], $data['city'] ?? null, $data['district'] ?? null);
        if (! $place) {
            return response()->json(['error' => 'Revisa la ubicación seleccionada.'], 422);
        }

        VisitPlan::query()->create([
            ...$data,
            ...$place,
            'country_code' => strtoupper($data['country_code']),
            'full_name' => trim($data['first_name'].' '.$data['last_name']),
            'phone' => '+'.$data['phone_code'].' '.$data['phone'],
        ]);

        return response()->json(['ok' => true]);
    }

    public function storeBaptism(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'sex' => ['required', Rule::in(self::SEXES)],
            'age' => 'required|integer|min:1|max:120',
            'country_code' => 'required|string|size:2|exists:geo_countries,code',
            'phone_code' => ['required', Rule::in(GeoDirectory::dialCodes())],
            'phone' => ['required', 'regex:/^[0-9]{6,15}$/'],
            'email' => 'nullable|email|max:160',
            'event_id' => 'nullable|uuid|exists:baptism_events,id',
            'notes' => 'nullable|string|max:800',
        ], [
            'required' => 'Completa el campo :attribute.',
            'in' => 'Elige una opción válida en :attribute.',
            'exists' => 'Elige una opción válida en :attribute.',
            'uuid' => 'Elige una opción válida en :attribute.',
            'integer' => 'Escribe un número válido en :attribute.',
            'email' => 'Escribe un correo válido.',
            'regex' => 'Escribe un :attribute válido.',
            'size' => 'Elige una opción válida en :attribute.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'Revisa el campo :attribute.',
        ], [
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'sex' => 'sexo',
            'age' => 'edad',
            'country_code' => 'país',
            'phone_code' => 'código de país',
            'phone' => 'teléfono',
            'email' => 'correo',
            'event_id' => 'fecha',
            'notes' => 'mensaje',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $data = $validator->validated();
        BaptismRegistration::query()->create([
            ...$data,
            'country_code' => strtoupper($data['country_code']),
            'full_name' => trim($data['first_name'].' '.$data['last_name']),
            'phone' => '+'.$data['phone_code'].' '.$data['phone'],
        ]);

        return response()->json(['ok' => true]);
    }

    public function storePrayer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => 'required|string|min:3|max:120',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:160',
            'topic' => ['nullable', Rule::in(PrayerRequest::TOPICS)],
            'request' => 'required|string|min:8|max:2000',
        ], [
            'full_name.required' => 'Escribe tu nombre.',
            'full_name.min' => 'Tu nombre debe tener al menos 3 letras.',
            'email.email' => 'Revisa tu correo electrónico.',
            'topic.in' => 'Elige un motivo de la lista.',
            'request.required' => 'Cuéntanos por qué quieres que oremos.',
            'request.min' => 'Cuéntanos un poco más sobre tu petición (mínimo 8 caracteres).',
            'request.max' => 'Tu petición puede tener hasta 2000 caracteres.',
        ]);
        PrayerRequest::query()->create($data);

        return response()->json(['ok' => true]);
    }

    private function page(string $component, Request $request, bool $forceMarea = false): Response
    {
        return Inertia::render($component, $this->shared($request, $forceMarea));
    }

    private function shared(Request $request, bool $forceMarea = false): array
    {
        return [
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'skin' => ResolveSiteSkin::fromRequest($request, $forceMarea),
        ];
    }
}
