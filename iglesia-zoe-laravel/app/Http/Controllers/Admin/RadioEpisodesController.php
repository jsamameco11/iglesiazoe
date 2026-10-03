<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Actions\SaveEpisode;
use App\Domain\Radio\RadioAudio;
use App\Domain\Radio\Station;
use App\Models\RadioEpisode;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;

/** Episodes: recorded programs published on /radio, with cover, title and a short description. */
class RadioEpisodesController extends RadioController
{
    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Radio/Episodios', [
            'episodes' => RadioEpisode::query()->with('track')->orderByDesc('aired_on')->orderByDesc('created_at')->get()->map->full(),
            'tracks' => RadioTrack::query()->where('active', true)->get()
                ->sortBy(fn (RadioTrack $track) => ($track->kind === 'programa' ? '0' : '1').mb_strtolower($track->title))
                ->values()->map->payload(),
            'kinds' => RadioTrack::KINDS,
            'prefill' => $this->find(RadioTrack::class, $request->query('audio'))?->id,
            'today' => Station::today(),
            'maxMb' => RadioAudio::MAX_MB,
            'maxDescription' => SaveEpisode::MAX_DESCRIPTION,
        ]);
    }

    public function save(Request $request, SaveEpisode $episodes): JsonResponse
    {
        $existing = $this->find(RadioEpisode::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese episodio ya no existe. Recarga la página.', 404);
        }
        $data = $episodes->validate($request->all(), $request->file('cover'));
        $published = $request->has('published') ? $request->boolean('published') : true;

        $audio = $request->file('audio');
        if ($audio instanceof UploadedFile) {
            if ($problem = RadioAudio::problem($audio)) {
                return $this->fail($problem);
            }
            $seconds = (float) $request->input('duration');
            if ($seconds < 0.5 || $seconds > Station::MAX_BLOCK) {
                return $this->fail('No pudimos leer la duración del audio. Prueba con otro archivo.');
            }
            $track = RadioTrack::query()->create([
                'kind' => 'programa',
                'title' => $data['title'],
                'artist' => $data['program'],
                'file_path' => RadioAudio::store($audio, 'programa'),
                'duration' => round($seconds, 2),
                'rotation' => false,
                'duck' => in_array('programa', RadioTrack::DUCK_BY_DEFAULT, true),
                'active' => true,
            ]);
        } else {
            $track = $this->find(RadioTrack::class, $request->input('track_id'));
            if (! $track) {
                return $this->fail('Elige el audio del episodio: uno de la biblioteca o sube uno nuevo.');
            }
        }

        $episodes->handle($data, $track, $published, $request->file('cover'), $existing, $request->boolean('remove_cover'));

        return $this->saved(match (true) {
            (bool) $existing => 'Episodio actualizado.',
            $published => 'Episodio publicado en la página de la radio.',
            default => 'Episodio guardado como oculto: no aparece en la página hasta que lo publiques.',
        });
    }

    public function destroy(Request $request): JsonResponse
    {
        $episode = $this->find(RadioEpisode::class, $request->input('id'));
        if ($episode) {
            MediaLibrary::deletePublic($episode->cover_path);
            $episode->delete();
        }

        return $this->saved('Episodio quitado de la página. El audio sigue en la biblioteca.');
    }
}
