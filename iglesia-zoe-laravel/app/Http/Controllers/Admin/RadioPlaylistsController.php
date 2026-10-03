<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Station;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
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
            'playlists' => RadioPlaylist::query()->with('tracks')->orderBy('sort_order')->orderBy('created_at')->get()->map->payload(),
            'songs' => RadioTrack::query()->where('kind', 'musica')->where('active', true)->orderBy('title')->get()->map->payload(),
            'autopilot' => Station::autopilot(),
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

        DB::transaction(function () use ($playlist, $name, $request, $ids) {
            $playlist->fill([
                'name' => $name,
                'description' => mb_substr(trim((string) $request->input('description', '')), 0, 240) ?: null,
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
            Station::switchAutopilot(null, (bool) Station::config()['auto_shuffle']);
        }
        Station::flush();

        return $this->saved('Lista eliminada. Donde sonaba, ahora suenan todas las listas.');
    }

    /** Automatic periods show the name of their list. */
    private function retitle(RadioPlaylist $playlist): void
    {
        RadioSlot::query()->where('radio_playlist_id', $playlist->id)->get()
            ->each(fn (RadioSlot $slot) => $slot->update(['title' => Schedule::autoTitle($playlist, $slot->shuffle)]));
    }
}
