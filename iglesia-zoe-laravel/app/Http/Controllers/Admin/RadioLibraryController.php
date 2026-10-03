<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Station;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** The audio library. Uploading only stores the audio: it sounds once it is scheduled or fired from the console. */
class RadioLibraryController extends RadioController
{
    private const AUDIO_TYPES = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'flac'];

    private const MAX_AUDIO_MB = 75;

    public function index(): Response
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

    public function save(Request $request): JsonResponse
    {
        $existing = $this->find(RadioTrack::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
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
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();

        $file = $request->file('audio');
        if (! $existing && ! $file instanceof UploadedFile) {
            return $this->fail('Elige el archivo de audio.');
        }

        $payload = [
            'title' => trim($data['title']),
            'artist' => trim((string) ($data['artist'] ?? '')) ?: null,
            'kind' => $data['kind'],
            'duck' => $request->has('duck') ? $request->boolean('duck') : ($existing->duck ?? in_array($data['kind'], RadioTrack::DUCK_BY_DEFAULT, true)),
            'active' => $existing ? $request->boolean('active', true) : true,
        ];
        if (! $existing || $data['kind'] !== 'musica') {
            $payload['rotation'] = false;
        }

        if ($file instanceof UploadedFile) {
            $ext = strtolower($file->getClientOriginalExtension());
            $mime = (string) $file->getMimeType();
            if (! $file->isValid() || ! in_array($ext, self::AUDIO_TYPES, true) || ! preg_match('#^(audio/|video/(mp4|webm|ogg)|application/(ogg|octet-stream))#', $mime)) {
                return $this->fail('El archivo debe ser de audio: MP3, M4A, AAC, OGG, OPUS, WAV, WEBM o FLAC.');
            }
            if ($file->getSize() > self::MAX_AUDIO_MB * 1024 * 1024) {
                return $this->fail('El audio pesa más de '.self::MAX_AUDIO_MB.' MB. Expórtalo en MP3 (128–192 kbps).');
            }
            if (! isset($data['duration'])) {
                return $this->fail('No pudimos leer la duración del audio. Prueba con otro archivo.');
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

        return $this->saved($existing
            ? 'Audio actualizado.'
            : 'Audio guardado en la biblioteca. No suena hasta que lo programes o lo lances desde la consola.');
    }

    /** Puts a song in the continuous music, where it repeats in the gaps of the program, or takes it out. */
    public function rotation(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        if ($track->kind !== 'musica') {
            return $this->fail('Solo las canciones van en la música continua.');
        }
        $on = $request->boolean('on');
        if ($on && ! $track->active) {
            return $this->fail('Activa el audio antes de ponerlo en la música continua.');
        }
        $track->update(['rotation' => $on]);
        Station::flush();

        return $this->saved($on
            ? "«{$track->title}» se repetirá en la música continua."
            : "«{$track->title}» ya no se repetirá en la música continua.");
    }

    public function destroy(Request $request): JsonResponse
    {
        $track = $this->find(RadioTrack::class, $request->input('id'));
        if ($track) {
            MediaLibrary::deletePublic($track->file_path);
            $track->delete();
            Station::flush();
        }

        return $this->saved('Audio eliminado de la biblioteca y de la programación.');
    }
}
