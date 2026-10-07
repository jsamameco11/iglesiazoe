<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Auth\Support\Entrance;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Stream\Broadcasts;
use App\Domain\Stream\Jobs\ArchiveRecording;
use App\Domain\Stream\MediaServer;
use App\Domain\Stream\Recordings;
use App\Domain\Stream\StreamSettings;
use App\Domain\Stream\YouTube\ThumbnailSource;
use App\Domain\Stream\YouTube\VideoOptions;
use App\Domain\Stream\YouTube\YouTubeClient;
use App\Http\Controllers\Controller;
use App\Models\LiveRecording;
use App\Models\LiveStream;
use App\Models\Teaching;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Transmisión: the OBS connection, the broadcast on air, the YouTube account and the recordings of the last days. */
class LiveController extends Controller
{
    private const COVER_TYPES = ['jpg', 'jpeg', 'png'];

    public function index(): Response
    {
        return Inertia::render('Admin/Transmision', [
            ...$this->state(),
            'encoder' => StreamSettings::encoder(),
            'youtube' => self::youtubePayload(),
            'defaults' => StreamSettings::defaults(),
            'catalog' => [...VideoOptions::catalog(), 'kinds' => [['value' => 'predica', 'label' => 'Prédica'], ['value' => 'gc', 'label' => 'Para los GC']]],
            'player' => Entrance::siteUrl(MediaServer::playerUrl()),
            'limits' => [
                'graceMinutes' => (int) config('stream.grace_minutes'),
                'retentionHours' => (int) config('stream.retention_hours'),
            ],
        ]);
    }

    /** Polled every few seconds by the page. */
    public function status(): JsonResponse
    {
        return response()->json($this->state());
    }

    public function prepare(Request $request): JsonResponse
    {
        $existing = $this->find(LiveStream::class, $request->input('id'));
        if ($request->filled('id') && (! $existing || ! $existing->isOpen())) {
            return $this->fail('Esa transmisión ya terminó. Recarga la página.', 404);
        }
        if (! $existing && LiveStream::query()->whereIn('status', LiveStream::OPEN)->exists()) {
            return $this->fail('Ya hay una transmisión preparada. Edítala o descártala primero.');
        }

        try {
            $data = $this->broadcastData($request);
        } catch (ValidationException $error) {
            return $this->fail($error->validator->errors()->first());
        }
        [$data, $coverChanged, $coverError] = $this->withCover($request, $data, $existing);
        if ($coverError) {
            return $this->fail($coverError);
        }

        if ($existing) {
            $warnings = Broadcasts::update($existing, $data, $coverChanged);
            $message = 'Datos de la transmisión guardados.';
        } else {
            [, $warnings] = Broadcasts::prepare($data, $request->user());
            $message = 'Transmisión preparada. Inicia la transmisión en OBS cuando quieras.';
        }

        return $this->saved(trim($message.' '.implode(' ', $warnings)));
    }

    public function end(Request $request): JsonResponse
    {
        $live = $this->find(LiveStream::class, $request->input('id'));
        if (! $live || ! $live->isOpen()) {
            return $this->fail('Esa transmisión ya terminó.', 404);
        }
        if ($live->status === 'ready') {
            Broadcasts::cancel($live);

            return $this->saved('Transmisión descartada.');
        }
        $teaching = Broadcasts::end($live, 'panel');

        return $this->saved($teaching
            ? ($teaching->isOnSite()
                ? 'Transmisión finalizada. Ya está en Enseñanzas con su video de YouTube; la grabación original estará lista para descargar en unos minutos.'
                : 'Transmisión finalizada y guardada en Enseñanzas. No se mostrará en la web hasta que tenga su video en YouTube; la grabación original estará lista para descargar en unos minutos.')
            : 'Transmisión finalizada.');
    }

    public function regenerateKey(): JsonResponse
    {
        if (LiveStream::query()->where('status', 'live')->whereNull('signal_lost_at')->exists()) {
            return $this->fail('No cambies la clave mientras OBS está transmitiendo. Finaliza primero la transmisión.');
        }
        StreamSettings::regenerateKey();

        return $this->saved('Clave nueva creada. Pégala en OBS antes de la próxima transmisión.');
    }

    public function saveDefaults(Request $request): JsonResponse
    {
        try {
            $data = $this->broadcastData($request);
        } catch (ValidationException $error) {
            return $this->fail($error->validator->errors()->first());
        }
        StreamSettings::putDefaults([...$data, 'options' => [...$data['options'], 'scheduled_at' => null, 'publish_at' => null]]);

        return $this->saved('Valores por defecto guardados.');
    }

    public function saveManualKey(Request $request): JsonResponse
    {
        $key = trim((string) $request->input('key'));
        if ($key !== '' && ! preg_match('/^[A-Za-z0-9_-]{8,64}$/', $key)) {
            return $this->fail('Esa no parece una clave de transmisión de YouTube. Cópiala de YouTube Studio → Emitir en directo.');
        }
        StreamSettings::putManualKey($key ?: null);

        return $this->saved($key ? 'Clave de YouTube guardada.' : 'Clave de YouTube quitada.');
    }

    public function retryArchive(Request $request): JsonResponse
    {
        $live = $this->find(LiveStream::class, $request->input('id'));
        if (! $live || ! Recordings::retry($live)) {
            return $this->fail('No hay archivos pendientes para guardar de esa transmisión.');
        }
        ArchiveRecording::dispatch($live->id)->onConnection(config('stream.queue'));

        return $this->saved('Guardando la grabación otra vez. Tardará unos minutos.');
    }

    /** Hands out the original recording through a short-lived link. */
    public function download(string $id): RedirectResponse|StreamedResponse
    {
        $recording = LiveRecording::query()->find($id);
        abort_unless($recording && $recording->downloadable(), 404);

        $url = MediaLibrary::privateUrl($recording->path, 120, $recording->name);

        return $url ? redirect()->away($url) : MediaLibrary::privateDisk()->download($recording->path, $recording->name);
    }

    /** Snapshot of the broadcast and the media server. */
    private function state(): array
    {
        $current = LiveStream::current();

        return [
            'server' => MediaServer::status(),
            'current' => $current?->adminPayload(),
            'history' => LiveStream::query()->where('status', 'ended')->with(['recordings', 'teaching'])->latest('ended_at')->limit(12)->get()
                ->map(fn (LiveStream $live) => [...$live->adminPayload(), 'teaching' => $live->teaching?->only(['id', 'title', 'youtube_id', 'youtube_status'])])
                ->values()->all(),
            'now' => now()->toIso8601String(),
        ];
    }

    public static function youtubePayload(): array
    {
        $youtube = StreamSettings::youtube();
        $relay = StreamSettings::relayTarget();

        return [
            'configured' => YouTubeClient::configured(),
            'connected' => YouTubeClient::connected(),
            'channel' => $youtube['channel'] ?? null,
            'connectedAt' => $youtube['connected_at'] ?? null,
            'error' => $youtube['error'] ?? null,
            'ingest' => ! empty($youtube['ingest_id']),
            'manualKey' => StreamSettings::manualKey() !== null,
            'relay' => $relay['mode'] ?? null,
            'redirectUri' => YouTubeClient::redirectUri(),
        ];
    }

    /**
     * @throws ValidationException
     */
    private function broadcastData(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:100',
            'description' => 'nullable|string|max:5000',
            'preacher' => 'nullable|string|max:120',
            'kind' => ['required', Rule::in(Teaching::KINDS)],
        ], [
            'required' => 'Completa el campo :attribute.',
            'min' => 'El título debe tener al menos 3 letras.',
            'max' => 'El campo :attribute es demasiado largo.',
            'in' => 'Elige una opción válida en :attribute.',
        ], ['title' => 'título', 'description' => 'descripción', 'preacher' => 'predicador', 'kind' => 'tipo']);
        $validator->validate();

        return [
            'title' => VideoOptions::clean((string) $request->input('title'), 100),
            'description' => VideoOptions::clean((string) $request->input('description'), 5000) ?: null,
            'preacher' => trim((string) $request->input('preacher')) ?: null,
            'kind' => $request->input('kind'),
            'show_summary' => $request->boolean('show_summary'),
            'to_youtube' => $request->boolean('to_youtube'),
            'options' => VideoOptions::fromInput($request->all()),
        ];
    }

    /** @return array{0: array, 1: bool, 2: ?string} */
    private function withCover(Request $request, array $data, ?LiveStream $existing): array
    {
        $cover = $request->file('cover');
        if ($cover instanceof UploadedFile) {
            $extension = MediaLibrary::extension($cover, self::COVER_TYPES);
            if (! $extension || $cover->getSize() > ThumbnailSource::MAX_BYTES) {
                return [$data, false, 'La miniatura debe ser JPG o PNG de hasta 2 MB (YouTube recomienda 1280 × 720).'];
            }
            $data['cover_path'] = MediaLibrary::storePublic($cover, 'transmisiones/miniaturas', $extension);

            return [$data, true, null];
        }
        if ($existing && $request->boolean('remove_cover')) {
            $data['cover_path'] = null;

            return [$data, false, null];
        }

        return [$data, false, null];
    }
}
