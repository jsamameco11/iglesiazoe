<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Schedule;
use App\Domain\Radio\Signal;
use App\Domain\Radio\Station;
use App\Http\Controllers\Controller;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RadioController extends Controller
{
    private const AUDIO_TYPES = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'flac'];

    private const MAX_AUDIO_MB = 75;

    private const MAX_SDP = 20000;

    /* --------------------------------------------------------------- pages */

    public function console(Request $request): Response
    {
        $today = Station::today();

        return Inertia::render('Admin/Radio/Consola', [
            'config' => Station::config(),
            'radio' => Station::state(),
            'live' => Station::live(),
            'pads' => RadioTrack::query()->whereIn('kind', ['efecto', 'anuncio'])->where('active', true)->orderBy('kind')->orderBy('title')->get()->map->payload(),
            'library' => RadioTrack::query()->where('active', true)->orderBy('title')->get()->map->payload(),
            'today' => $today,
            'day' => Schedule::day($today),
            'host' => $request->user()->full_name ?: $request->user()->username,
        ]);
    }

    public function schedule(Request $request): Response
    {
        $today = Station::today();
        $date = $this->date($request->query('fecha')) ?? $today;

        return Inertia::render('Admin/Radio/Programacion', [
            'date' => $date,
            'today' => $today,
            'now' => Station::nowMs(),
            'blocks' => Schedule::day($date),
            'dayEnd' => Schedule::dayEnd($date),
            'days' => Schedule::overview($today, 21),
            'tracks' => RadioTrack::query()->where('active', true)->orderBy('kind')->orderBy('title')->get()->map->payload(),
            'config' => Station::config(),
        ]);
    }

    public function library(): Response
    {
        $upcoming = RadioSlot::query()->where('starts_at', '>=', now())->whereNotNull('radio_track_id')
            ->selectRaw('radio_track_id, count(*) as total')->groupBy('radio_track_id')->pluck('total', 'radio_track_id');

        return Inertia::render('Admin/Radio/Biblioteca', [
            'tracks' => RadioTrack::query()->orderBy('kind')->orderBy('title')->get()->map(fn (RadioTrack $track) => [
                ...$track->payload(),
                'upcoming' => (int) ($upcoming[$track->id] ?? 0),
            ]),
            'kinds' => RadioTrack::KINDS,
            'maxMb' => self::MAX_AUDIO_MB,
        ]);
    }

    public function settings(): Response
    {
        return Inertia::render('Admin/Radio/Ajustes', ['config' => Station::config()]);
    }

    /* ------------------------------------------------------------- library */

    public function saveTrack(Request $request): JsonResponse
    {
        $existing = $this->find(RadioTrack::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return response()->json(['error' => 'Ese audio ya no existe. Recarga la página.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:2|max:160',
            'artist' => 'nullable|string|max:120',
            'kind' => ['required', Rule::in(array_keys(RadioTrack::KINDS))],
            'duration' => [$existing ? 'nullable' : 'required', 'numeric', 'min:0.5', 'max:'.Station::MAX_BLOCK],
        ], [
            'required' => 'Completa el campo :attribute.',
            'duration.required' => 'No pudimos leer la duración del audio. Prueba con otro archivo.',
            'duration.max' => 'El audio dura más de 6 horas. Divídelo en partes.',
            'in' => 'Elige un tipo válido.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], ['title' => 'título', 'artist' => 'artista', 'kind' => 'tipo', 'duration' => 'duración']);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }
        $data = $validator->validated();

        $file = $request->file('audio');
        if (! $existing && ! $file instanceof UploadedFile) {
            return response()->json(['error' => 'Elige el archivo de audio.'], 422);
        }

        $payload = [
            'title' => trim($data['title']),
            'artist' => trim((string) ($data['artist'] ?? '')) ?: null,
            'kind' => $data['kind'],
            'rotation' => $request->boolean('rotation'),
            'active' => $existing ? $request->boolean('active', true) : true,
        ];

        if ($file instanceof UploadedFile) {
            $ext = strtolower($file->getClientOriginalExtension());
            $mime = (string) $file->getMimeType();
            if (! $file->isValid() || ! in_array($ext, self::AUDIO_TYPES, true) || ! preg_match('#^(audio/|video/(mp4|webm|ogg)|application/(ogg|octet-stream))#', $mime)) {
                return response()->json(['error' => 'El archivo debe ser de audio: MP3, M4A, AAC, OGG, OPUS, WAV, WEBM o FLAC.'], 422);
            }
            if ($file->getSize() > self::MAX_AUDIO_MB * 1024 * 1024) {
                return response()->json(['error' => 'El audio pesa más de '.self::MAX_AUDIO_MB.' MB. Expórtalo en MP3 (128–192 kbps).'], 422);
            }
            if (! isset($data['duration'])) {
                return response()->json(['error' => 'No pudimos leer la duración del audio. Prueba con otro archivo.'], 422);
            }
            $payload['file_path'] = MediaLibrary::storePublic($file, 'radio/'.$data['kind'], $ext);
            $payload['duration'] = round((float) $data['duration'], 2);
            MediaLibrary::deletePublic($existing?->file_path);
        }

        if ($existing) {
            $existing->update($payload);
            if (isset($payload['duration'])) {
                $existing->slots()->where('starts_at', '>=', now())->update(['duration' => $payload['duration']]);
            }
            $existing->slots()->where('starts_at', '>=', now())->update(['title' => $payload['title'], 'kind' => $payload['kind']]);
        } else {
            RadioTrack::query()->create($payload);
        }
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => $existing ? 'Audio actualizado.' : 'Audio agregado a la biblioteca.']);
    }

    public function deleteTrack(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if ($track) {
            MediaLibrary::deletePublic($track->file_path);
            $track->delete();
            Station::flush();
        }

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Audio eliminado de la biblioteca y de la programación.']);
    }

    /* ------------------------------------------------------------ timeline */

    public function addBlocks(Request $request): JsonResponse
    {
        $date = $this->date($request->input('date'));
        $mode = $request->input('mode');
        if (! $date || ! in_array($mode, ['end', 'at', 'now'], true)) {
            return response()->json(['error' => 'Elige el día y cuándo debe sonar.'], 422);
        }

        $blocks = $this->blocksFrom($request);
        if (is_string($blocks)) {
            return response()->json(['error' => $blocks], 422);
        }

        if ($mode === 'now') {
            Schedule::insertNow($blocks);

            return response()->json(['ok' => true, 'reload' => true, 'message' => 'Al aire ahora. La programación siguiente se corrió para darle espacio.']);
        }

        $now = Station::nowMs();
        if ($mode === 'end') {
            $start = Schedule::dayEnd($date) ?? $this->at($date, (string) $request->input('time', '06:00'));
        } else {
            $start = $this->at($date, (string) $request->input('time'));
        }
        if ($start === null) {
            return response()->json(['error' => 'Escribe la hora de inicio (por ejemplo 18:30 o 18:30:15).'], 422);
        }
        if ($start < $now - 1000) {
            if ($mode === 'end' && $date === Station::today()) {
                $start = $now + 3000;
            } else {
                return response()->json(['error' => 'Esa hora ya pasó. Elige una hora futura o usa «Al aire ahora».'], 422);
            }
        }

        $end = $start + Schedule::length($blocks);
        if ($conflict = Schedule::conflict($start, $end)) {
            return response()->json(['error' => 'Se cruza con «'.$conflict->title.'» ('.$this->clock($conflict->starts_at->getTimestampMs()).'–'.$this->clock($conflict->endsAt()->getTimestampMs()).'). Elige otra hora o mueve ese bloque.'], 422);
        }
        Schedule::place($blocks, $start);
        $count = count($blocks);

        return response()->json(['ok' => true, 'reload' => true, 'message' => ($count === 1 ? 'Bloque programado' : $count.' bloques programados').' de '.$this->clock($start).' a '.$this->clock($end).'.']);
    }

    public function updateBlock(Request $request): JsonResponse
    {
        $slot = $this->find(RadioSlot::class, $request->input('id'));
        if (! $slot) {
            return response()->json(['error' => 'Ese bloque ya no existe. Recarga la página.'], 404);
        }
        $date = $this->date($request->input('date')) ?? $slot->starts_at->setTimezone(Station::TZ)->toDateString();
        $start = $request->filled('time') ? $this->at($date, (string) $request->input('time')) : $slot->starts_at->getTimestampMs();
        if ($start === null) {
            return response()->json(['error' => 'Escribe una hora válida (por ejemplo 18:30 o 18:30:15).'], 422);
        }

        $data = ['starts_at' => Schedule::utc($start)];
        $title = trim((string) $request->input('title', ''));
        if ($title !== '') {
            $data['title'] = mb_substr($title, 0, 160);
        }
        $data['note'] = mb_substr(trim((string) $request->input('note', '')), 0, 240) ?: null;
        if ($slot->kind === RadioSlot::LIVE) {
            $minutes = (float) $request->input('minutes', $slot->duration / 60);
            if ($minutes < 1 || $minutes > Station::MAX_BLOCK / 60) {
                return response()->json(['error' => 'Un bloque en vivo dura entre 1 minuto y 6 horas.'], 422);
            }
            $data['duration'] = round($minutes * 60, 2);
            $data['bed'] = $request->boolean('bed');
        }

        $end = $start + (int) round(($data['duration'] ?? $slot->duration) * 1000);
        if ($conflict = Schedule::conflict($start, $end, $slot->id)) {
            return response()->json(['error' => 'Se cruza con «'.$conflict->title.'» ('.$this->clock($conflict->starts_at->getTimestampMs()).'). Elige otra hora.'], 422);
        }
        $slot->update($data);
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Bloque actualizado.']);
    }

    public function deleteBlock(Request $request): JsonResponse
    {
        $this->find(RadioSlot::class, $request->input('id'))?->delete();
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Bloque quitado de la programación.']);
    }

    public function clearDay(Request $request): JsonResponse
    {
        $date = $this->date($request->input('date'));
        if (! $date) {
            return response()->json(['error' => 'Elige un día.'], 422);
        }
        [$from, $to] = Station::dayBounds($date);
        $removed = RadioSlot::query()->where('starts_at', '>=', Schedule::utc(max($from, Station::nowMs())))->where('starts_at', '<', Schedule::utc($to))->delete();
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => $removed ? "Se quitaron {$removed} bloques del día." : 'No había bloques por quitar.']);
    }

    public function copyDay(Request $request): JsonResponse
    {
        $date = $this->date($request->input('date'));
        $targets = collect((array) $request->input('targets', []))->map(fn ($value) => $this->date($value))->filter()
            ->reject(fn ($value) => $value === $date || $value < Station::today())->unique()->values()->all();
        if (! $date || ! $targets) {
            return response()->json(['error' => 'Elige uno o más días futuros para copiar la programación.'], 422);
        }
        if (count($targets) > 31) {
            return response()->json(['error' => 'Copia hasta 31 días a la vez.'], 422);
        }
        [$copied, $skipped] = Schedule::copyDay($date, $targets, $request->boolean('replace'));
        $message = "Se copiaron {$copied} bloques a ".count($targets).' día(s).';
        if ($skipped) {
            $message .= " {$skipped} no se copiaron porque se cruzaban con bloques ya programados.";
        }

        return response()->json(['ok' => true, 'reload' => true, 'message' => $message]);
    }

    /* ------------------------------------------------------------ settings */

    public function saveSettings(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:60',
            'tagline' => 'nullable|string|max:160',
            'bed_level' => 'required|integer|min:5|max:60',
            'fx_level' => 'required|integer|min:10|max:100',
            'stream_url' => ['nullable', 'string', 'max:300', 'regex:#^https://#i'],
            'turn_url' => ['nullable', 'string', 'max:200', 'regex:#^turns?:#i'],
            'turn_username' => 'nullable|string|max:120',
            'turn_credential' => 'nullable|string|max:200',
            'max_voice' => 'required|integer|min:1|max:200',
        ], [
            'required' => 'Completa el campo :attribute.',
            'stream_url.regex' => 'El enlace de transmisión externa debe empezar con https://',
            'turn_url.regex' => 'El servidor TURN debe empezar con turn: o turns:',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'Revisa el campo :attribute.',
        ], ['name' => 'nombre de la radio', 'tagline' => 'lema', 'bed_level' => 'volumen de fondo', 'fx_level' => 'volumen de efectos', 'max_voice' => 'oyentes de voz']);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }
        $data = $validator->validated();
        Station::saveConfig([
            ...array_map(fn ($value) => trim((string) $value), $data),
            'bed_level' => (int) $data['bed_level'],
            'fx_level' => (int) $data['fx_level'],
            'max_voice' => (int) $data['max_voice'],
            'on_air' => $request->boolean('on_air'),
            'autofill' => $request->boolean('autofill'),
        ]);

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Ajustes de la radio guardados.']);
    }

    /* ---------------------------------------------------------------- live */

    public function live(Request $request): JsonResponse
    {
        $action = $request->input('action');
        if ($action === 'start') {
            $host = mb_substr(trim((string) $request->input('host')), 0, 80) ?: ($request->user()->full_name ?: 'Radio Zoe');
            if (! Station::config()['on_air']) {
                Station::saveConfig(['on_air' => true]);
            }
            Station::startLive($host);
        } elseif ($action === 'stop') {
            Station::endLive();
        } elseif ($action === 'air') {
            if (! $request->boolean('on')) {
                Station::endLive();
            }
            Station::saveConfig(['on_air' => $request->boolean('on')]);
        } elseif ($action === 'mix') {
            if (! Station::live()['session']) {
                return response()->json(['error' => 'Abre la transmisión en vivo para usar el mezclador.'], 409);
            }
            Station::heartbeat();
            Station::updateLive(fn () => array_filter([
                'music' => $request->has('music') ? max(0, min(100, (int) $request->input('music'))) : null,
                'muted' => $request->has('muted') ? $request->boolean('muted') : null,
                'bed' => $request->has('bed') ? $request->boolean('bed') : null,
                'mic' => $request->has('mic') ? $request->boolean('mic') : null,
                'host' => $request->filled('host') ? mb_substr(trim((string) $request->input('host')), 0, 80) : null,
            ], fn ($value) => $value !== null));
        } else {
            return response()->json(['error' => 'Acción desconocida.'], 422);
        }

        return response()->json(['ok' => true, ...$this->snapshot()]);
    }

    public function fire(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if (! $track || ! $track->active) {
            return response()->json(['error' => 'Ese audio ya no está en la biblioteca.'], 404);
        }
        $live = Station::fire($track);

        return response()->json(['ok' => true, 'fx' => end($live['fx'])]);
    }

    /** Console heartbeat: live state, the program, and the WebRTC handshakes to serve. */
    public function signal(): JsonResponse
    {
        Station::heartbeat();
        $snapshot = $this->snapshot();
        $session = $snapshot['live']['session'];
        if (random_int(1, 40) === 1) {
            Signal::prune();
        }

        return response()->json([
            ...$snapshot,
            'pending' => $session ? Signal::pending($session, (int) Station::config()['max_voice']) : [],
            'answers' => $session ? Signal::answers($session) : [],
            'alive' => $session ? Signal::alive($session) : [],
        ])->header('Cache-Control', 'no-store');
    }

    public function offer(Request $request): JsonResponse
    {
        $session = Station::live()['session'];
        $sdp = $request->input('sdp');
        $id = $request->input('id');
        if (! $session || ! is_string($id) || ! is_string($sdp) || strlen($sdp) > self::MAX_SDP) {
            return response()->json(['error' => 'La transmisión no está abierta.'], 409);
        }

        return response()->json(['ok' => Signal::offer($session, $id, $sdp)]);
    }

    /* ------------------------------------------------------------- helpers */

    private function snapshot(): array
    {
        $live = Station::live();

        return [
            'radio' => Station::state(),
            'live' => $live,
            'voice' => Station::voiceCount($live['session']),
            'config' => Station::config(),
        ];
    }

    /** @return list<array<string, mixed>>|string */
    private function blocksFrom(Request $request): array|string
    {
        if ($request->input('type') === 'vivo') {
            $title = mb_substr(trim((string) $request->input('title')), 0, 160);
            $minutes = (float) $request->input('minutes');
            if (mb_strlen($title) < 2) {
                return 'Ponle un nombre al bloque en vivo (por ejemplo «Mañanas con Zoe»).';
            }
            if ($minutes < 1 || $minutes > Station::MAX_BLOCK / 60) {
                return 'Un bloque en vivo dura entre 1 minuto y 6 horas.';
            }

            return [[
                'kind' => RadioSlot::LIVE,
                'title' => $title,
                'duration' => round($minutes * 60, 2),
                'radio_track_id' => null,
                'bed' => $request->boolean('bed'),
                'note' => mb_substr(trim((string) $request->input('note', '')), 0, 240) ?: null,
            ]];
        }

        $ids = collect((array) $request->input('tracks', []))->filter(fn ($id) => is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id))->values();
        if ($ids->isEmpty()) {
            return 'Elige al menos un audio de la biblioteca.';
        }
        if ($ids->count() > 200) {
            return 'Agrega hasta 200 audios a la vez.';
        }
        $found = RadioTrack::query()->whereIn('id', $ids->unique())->where('active', true)->get()->keyBy('id');
        $tracks = $ids->map(fn ($id) => $found->get($id))->filter()->values();
        if ($tracks->isEmpty()) {
            return 'Esos audios ya no están en la biblioteca.';
        }

        return Schedule::trackBlocks($tracks, mb_substr(trim((string) $request->input('note', '')), 0, 240) ?: null);
    }

    private function date(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        try {
            return CarbonImmutable::createFromFormat('!Y-m-d', $value, Station::TZ)->toDateString() === $value ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function at(string $date, string $time): ?int
    {
        if (! preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/', trim($time), $match)) {
            return null;
        }

        return CarbonImmutable::parse($date, Station::TZ)->startOfDay()
            ->setTime((int) $match[1], (int) $match[2], (int) ($match[3] ?? 0))
            ->getTimestampMs();
    }

    private function clock(int $ms): string
    {
        return CarbonImmutable::createFromTimestampMs($ms)->setTimezone(Station::TZ)->format('H:i:s');
    }

    /**
     * @template T of \Illuminate\Database\Eloquent\Model
     *
     * @param  class-string<T>  $model
     * @return T|null
     */
    private function find(string $model, mixed $id): mixed
    {
        return is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id) ? $model::query()->find($id) : null;
    }
}
