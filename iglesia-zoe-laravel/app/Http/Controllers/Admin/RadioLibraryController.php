<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Actions\SaveEpisode;
use App\Domain\Radio\RadioAudio;
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
    public function index(): Response
    {
        $upcoming = RadioSlot::query()->where('starts_at', '>=', now())->whereNotNull('radio_track_id')
            ->selectRaw('radio_track_id, count(*) as total')->groupBy('radio_track_id')->pluck('total', 'radio_track_id');

        return Inertia::render('Admin/Radio/Biblioteca', [
            'tracks' => RadioTrack::query()->withCount('episodes')->orderBy('kind')->orderBy('title')->get()->map(fn (RadioTrack $track) => [
                ...$track->payload(),
                'upcoming' => (int) ($upcoming[$track->id] ?? 0),
                'episodes' => $track->episodes_count,
            ]),
            'kinds' => RadioTrack::KINDS,
            'maxMb' => RadioAudio::MAX_MB,
            'maxDescription' => SaveEpisode::MAX_DESCRIPTION,
        ]);
    }

    public function save(Request $request, SaveEpisode $episodes): JsonResponse
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
        $episode = ! $existing && $request->boolean('episode') && Permissions::has($request->user(), 'radio.episodes')
            ? $episodes->validate([
                'title' => $data['title'],
                'program' => $data['artist'] ?? null,
                'description' => $request->input('episode_description'),
                'aired_on' => Station::today(),
            ], $request->file('episode_cover'))
            : null;

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
            if ($problem = RadioAudio::problem($file)) {
                return $this->fail($problem);
            }
            if (! isset($data['duration'])) {
                return $this->fail('No pudimos leer la duración del audio. Prueba con otro archivo.');
            }
            $payload['file_path'] = RadioAudio::store($file, $data['kind']);
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
            $track = RadioTrack::query()->create($payload);
            if ($episode) {
                $episodes->handle($episode, $track, true, $request->file('episode_cover'));
            }
        }
        Station::flush();

        return $this->saved(match (true) {
            (bool) $existing => 'Audio actualizado.',
            (bool) $episode => 'Audio guardado en la biblioteca y publicado como episodio en la página de la radio.',
            default => 'Audio guardado en la biblioteca. No suena hasta que lo programes o lo lances desde la consola.',
        });
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
