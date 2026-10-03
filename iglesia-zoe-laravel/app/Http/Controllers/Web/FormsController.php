<?php

namespace App\Http\Controllers\Web;

use App\Domain\Geo\GeoDirectory;
use App\Domain\Inbox\PushNotifier;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use App\Models\BaptismRegistration;
use App\Models\PrayerRequest;
use App\Models\ServeRegistration;
use App\Models\VisitPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

use function Illuminate\Support\defer;

/** Forms people send from the public site: visit, baptism, prayer and serving. */
class FormsController extends Controller
{
    public const SEXES = ['Masculino', 'Femenino'];

    public const MARITAL_STATUSES = ['Soltero(a)', 'Casado(a)', 'Conviviente', 'Divorciado(a)', 'Separado(a)', 'Viudo(a)'];

    /** Planifica tu visita (home and /visita): the profile is required, the place where the person lives is optional. */
    public function storeVisit(Request $request): JsonResponse
    {
        $services = $this->visitServices();
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'phone_code' => ['required', Rule::in(GeoDirectory::dialCodes())],
            'phone' => ['required', 'regex:/^[0-9]{6,15}$/'],
            'email' => 'nullable|email|max:160',
            'sex' => ['required', Rule::in(self::SEXES)],
            'age' => 'required|integer|min:1|max:120',
            'marital_status' => ['required', Rule::in(self::MARITAL_STATUSES)],
            'service' => ['required', Rule::in(array_keys($services))],
            'country_code' => 'nullable|string|size:2|exists:geo_countries,code',
            'region' => 'nullable|string|max:160',
            'city' => 'nullable|string|max:160',
            'district' => 'nullable|string|max:160',
        ], [
            'required' => 'Completa el campo :attribute.',
            'in' => 'Elige una opción válida en :attribute.',
            'exists' => 'Elige una opción válida en :attribute.',
            'size' => 'Elige una opción válida en :attribute.',
            'integer' => 'Escribe un número válido en :attribute.',
            'email' => 'Escribe un correo válido.',
            'phone.regex' => 'Escribe un celular válido (solo números).',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'Revisa el campo :attribute.',
        ], [
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'phone_code' => 'código de país',
            'phone' => 'celular',
            'email' => 'correo',
            'sex' => 'sexo',
            'age' => 'edad',
            'marital_status' => 'estado civil',
            'service' => 'servicio al que asistirás',
            'country_code' => 'país',
            'region' => 'estado o departamento',
        ]);

        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = $validator->validated();
        $country = isset($data['country_code']) ? strtoupper($data['country_code']) : null;
        $place = ['region' => null, 'city' => null, 'district' => null];
        if ($country && ! empty($data['region'])) {
            $place = GeoDirectory::resolve($country, $data['region'], $data['city'] ?? null, $data['district'] ?? null);
            if (! $place) {
                return $this->fail('Revisa la ubicación seleccionada.');
            }
        }

        $visit = VisitPlan::query()->create([
            ...$data,
            ...$place,
            'country_code' => $country,
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'full_name' => trim(trim($data['first_name']).' '.trim($data['last_name'])),
            'phone' => '+'.$data['phone_code'].' '.$data['phone'],
            'visit_date' => $this->nextServiceDate($services[$data['service']]),
        ]);
        defer(fn () => PushNotifier::announce('visitas', $visit));

        return response()->json(['ok' => true]);
    }

    /** @return array<string, string> service label => weekday it happens */
    private function visitServices(): array
    {
        $settings = LoadPublicSite::settings();

        return array_filter([
            trim((string) ($settings['sunday'] ?? '')) => 'Sunday',
            trim((string) ($settings['wednesday'] ?? '')) => 'Wednesday',
        ], fn ($day, $label) => $label !== '', ARRAY_FILTER_USE_BOTH);
    }

    private function nextServiceDate(string $weekday): string
    {
        $today = now('America/Lima');

        return ($today->format('l') === $weekday ? $today : $today->next($weekday))->toDateString();
    }

    public function storeBaptism(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'sex' => ['required', Rule::in(self::SEXES)],
            'age' => 'required|integer|min:1|max:120',
            'marital_status' => ['required', Rule::in(self::MARITAL_STATUSES)],
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
            'marital_status' => 'estado civil',
            'country_code' => 'país',
            'phone_code' => 'código de país',
            'phone' => 'teléfono',
            'email' => 'correo',
            'event_id' => 'fecha',
            'notes' => 'mensaje',
        ]);

        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = $validator->validated();
        $registration = BaptismRegistration::query()->create([
            ...$data,
            'country_code' => strtoupper($data['country_code']),
            'full_name' => trim($data['first_name'].' '.$data['last_name']),
            'phone' => '+'.$data['phone_code'].' '.$data['phone'],
        ]);
        defer(fn () => PushNotifier::announce('bautismos', $registration));

        return response()->json(['ok' => true]);
    }

    public function storePrayer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'age' => 'required|integer|min:1|max:120',
            'marital_status' => ['required', Rule::in(self::MARITAL_STATUSES)],
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:160',
            'topic' => ['nullable', Rule::in(LoadPublicSite::prayerTopics())],
            'request' => 'required|string|min:8|max:2000',
        ], [
            'first_name.required' => 'Escribe tus nombres.',
            'first_name.min' => 'Escribe tus nombres.',
            'last_name.required' => 'Escribe tus apellidos.',
            'last_name.min' => 'Escribe tus apellidos.',
            'age.required' => 'Escribe tu edad.',
            'age.integer' => 'Escribe tu edad en números.',
            'age.min' => 'Escribe una edad entre 1 y 120.',
            'age.max' => 'Escribe una edad entre 1 y 120.',
            'marital_status.required' => 'Elige tu estado civil.',
            'marital_status.in' => 'Elige tu estado civil de la lista.',
            'email.email' => 'Revisa tu correo electrónico.',
            'topic.in' => 'Elige un motivo de la lista.',
            'request.required' => 'Cuéntanos por qué quieres que oremos.',
            'request.min' => 'Cuéntanos un poco más sobre tu petición (mínimo 8 caracteres).',
            'request.max' => 'Tu petición puede tener hasta 2000 caracteres.',
        ]);
        $prayer = PrayerRequest::query()->create([
            ...$data,
            'first_name' => trim($data['first_name']),
            'last_name' => trim($data['last_name']),
            'full_name' => trim(trim($data['first_name']).' '.trim($data['last_name'])),
        ]);
        defer(fn () => PushNotifier::announce('oraciones', $prayer));

        return response()->json(['ok' => true]);
    }

    public function storeServe(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'serve_area_id' => 'required|string',
            'team' => 'nullable|string|max:80',
            'first_name' => 'required|string|min:2|max:60',
            'last_name' => 'required|string|min:2|max:80',
            'age' => 'required|integer|min:8|max:100',
            'marital_status' => ['required', Rule::in(self::MARITAL_STATUSES)],
            'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9\s-]{6,20}$/'],
            'email' => 'nullable|email|max:160',
            'notes' => 'nullable|string|max:800',
        ], [
            'required' => 'Completa el campo :attribute.',
            'in' => 'Elige una opción válida en :attribute.',
            'integer' => 'Escribe tu edad en números.',
            'age.min' => 'Para servir debes tener al menos 8 años.',
            'age.max' => 'Revisa tu edad.',
            'email' => 'Escribe un correo válido.',
            'phone.regex' => 'Escribe un teléfono válido.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], [
            'serve_area_id' => 'área',
            'team' => 'equipo',
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'age' => 'edad',
            'marital_status' => 'estado civil',
            'phone' => 'teléfono',
            'email' => 'correo',
            'notes' => 'mensaje',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = $validator->validated();
        $area = collect(LoadPublicSite::serveAreas())->firstWhere('id', $data['serve_area_id']);
        if (! $area || ! ($area['accepts_volunteers'] ?? true)) {
            return $this->fail('Elige un área de servicio de la lista.');
        }
        $team = trim((string) ($data['team'] ?? '')) ?: null;
        if ($team && ! in_array($team, $area['teams'], true)) {
            return $this->fail('Elige un equipo de la lista.');
        }

        $registration = ServeRegistration::query()->create([
            'serve_area_id' => $area['id'],
            'area_name' => $area['name'],
            'team' => $team,
            'first_name' => trim($data['first_name']),
            'last_name' => trim($data['last_name']),
            'full_name' => trim(trim($data['first_name']).' '.trim($data['last_name'])),
            'age' => (int) $data['age'],
            'marital_status' => $data['marital_status'],
            'phone' => preg_replace('/\s+/', ' ', trim($data['phone'])),
            'email' => isset($data['email']) ? strtolower(trim($data['email'])) : null,
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
        ]);
        defer(fn () => PushNotifier::announce('servidores', $registration));

        return response()->json(['ok' => true]);
    }
}
