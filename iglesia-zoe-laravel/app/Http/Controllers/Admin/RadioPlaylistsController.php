<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Station;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioSpotifyPlaylist;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Playlists of the automatic music: which songs, in which order, and the order of the lists. */
class RadioPlaylistsController extends RadioController
{
    private const MAX_SONGS = 1000;

    public function index(): Response
    {
        return Inertia::render('Admin/Radio/Listas', [
            'playlists' => RadioPlaylist::query()->with(['tracks', 'spotify'])->orderBy('sort_order')->orderBy('created_at')->get()->map->payload(),
            'songs' => RadioTrack::query()->where('kind', 'musica')->where('active', true)->orderBy('title')->get()->map->payload(),
            'autopilot' => Station::autopilot(),
            'spotifyReferences' => $this->spotifyReferences(),
        ]);
    }

    /** Points a list to the Spotify playlist that serves as its reference, or to none. */
    public function reference(Request $request): JsonResponse
    {
        $playlist = $this->find(RadioPlaylist::class, $request->input('playlist'));
        if (! $playlist) {
            return $this->fail('Esa lista ya no existe. Recarga la página.', 404);
        }
        $spotify = $this->spotifyFrom($request);
        if ($spotify === false) {
            return $this->fail('Esa playlist de Spotify ya no está en el panel. Recarga la página.', 404);
        }
        $playlist->update(['radio_spotify_playlist_id' => $spotify?->id]);

        return response()->json([
            'ok' => true,
            'message' => $spotify
                ? '«'.$playlist->name.'» tiene como referencia «'.$spotify->name.'» de Spotify.'
                : '«'.$playlist->name.'» ya no tiene referencia de Spotify.',
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $playlist = $request->filled('id') ? $this->find(RadioPlaylist::class, $request->input('id')) : new RadioPlaylist;
        if (! $playlist) {
            return $this->fail('Esa lista ya no existe. Recarga la página.', 404);
        }
        $name = mb_substr(trim((string) $request->input('name')), 0, 80);
        if (mb_strlen($name) < 2) {
            return $this->fail('Ponle un nombre a la lista (por ejemplo «Alabanza» o «Adoración»).');
        }
        $ids = $this->uuids($request->input('tracks'))->unique()->values();
        if ($ids->count() > self::MAX_SONGS) {
            return $this->fail('Una lista tiene hasta '.self::MAX_SONGS.' canciones.');
        }
        $known = RadioTrack::query()->whereIn('id', $ids)->where('kind', 'musica')->pluck('id')->all();
        $ids = $ids->filter(fn (string $id) => in_array($id, $known, true))->values();
        $spotify = $this->spotifyFrom($request);
        if ($spotify === false) {
            return $this->fail('Esa playlist de Spotify ya no está en el panel. Recarga la página.', 404);
        }

        DB::transaction(function () use ($playlist, $name, $request, $ids, $spotify) {
            $playlist->fill([
                'name' => $name,
                'description' => mb_substr(trim((string) $request->input('description', '')), 0, 240) ?: null,
                'radio_spotify_playlist_id' => $spotify?->id,
            ]);
            if (! $playlist->exists) {
                $playlist->sort_order = (int) RadioPlaylist::query()->max('sort_order') + 1;
            }
            $playlist->save();
            $playlist->tracks()->sync($ids->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all());
            $this->retitle($playlist);
        });
        Station::flush();

        return response()->json([
            'ok' => true,
            'reload' => true,
            'id' => $playlist->id,
            'message' => '«'.$name.'» guardada con '.$ids->count().' '.($ids->count() === 1 ? 'canción' : 'canciones').'.',
        ]);
    }

    /** Order of the lists: «Todas las listas» plays them one after another in this order. */
    public function order(Request $request): JsonResponse
    {
        DB::transaction(function () use ($request) {
            foreach ($this->uuids($request->input('ids'))->unique()->values() as $position => $id) {
                RadioPlaylist::query()->whereKey($id)->update(['sort_order' => $position]);
            }
        });
        Station::flush();

        return $this->saved('Orden de las listas guardado.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $playlist = $this->find(RadioPlaylist::class, $request->input('id'));
        if (! $playlist) {
            return $this->saved();
        }
        DB::transaction(function () use ($playlist) {
            RadioSlot::query()->where('radio_playlist_id', $playlist->id)->get()
                ->each(fn (RadioSlot $slot) => $slot->update(['radio_playlist_id' => null, 'title' => Schedule::autoTitle(null, $slot->shuffle)]));
            $playlist->delete();
        });
        if (Station::config()['auto_playlist'] === $playlist->id) {
            Station::switchAutopilot(null, true);
        }
        Station::flush();

        return $this->saved('Lista eliminada. Donde sonaba, ahora suenan canciones aleatorias.');
    }

    /** Requested Spotify reference: the playlist, null for none, or false when it left the panel. */
    private function spotifyFrom(Request $request): RadioSpotifyPlaylist|false|null
    {
        $id = $request->input('spotify');
        if ($id === null || $id === '') {
            return null;
        }

        return $this->find(RadioSpotifyPlaylist::class, $id) ?? false;
    }

    /** Automatic periods show the name of their list. */
    private function retitle(RadioPlaylist $playlist): void
    {
        RadioSlot::query()->where('radio_playlist_id', $playlist->id)->get()
            ->each(fn (RadioSlot $slot) => $slot->update(['title' => Schedule::autoTitle($playlist, $slot->shuffle)]));
    }
}
