<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Spotify;
use App\Models\RadioSpotifyPlaylist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** The church's Spotify playlists: name, cover and a short text, shown on /radio in Spotify's own player. */
class RadioSpotifyController extends RadioController
{
    private const BAD_LINK = 'Pega el enlace de una playlist de Spotify. En Spotify: ··· › Compartir › Copiar enlace de la playlist.';

    private const NOT_FOUND = 'Spotify no encuentra esa playlist. Revisa el enlace y que la playlist sea pública.';

    public function index(): Response
    {
        return Inertia::render('Admin/Radio/Spotify', [
            'playlists' => RadioSpotifyPlaylist::ordered()->get()->map->full(),
        ]);
    }

    /** Reads the public name and cover of a playlist before saving it. */
    public function lookup(Request $request): JsonResponse
    {
        $id = Spotify::playlistId((string) $request->input('link'));
        if ($id === null) {
            return $this->fail(self::BAD_LINK);
        }
        $found = Spotify::lookup($id);
        if ($found['found'] === false) {
            return $this->fail(self::NOT_FOUND);
        }

        return response()->json([
            'ok' => true,
            'spotify_id' => $id,
            'name' => $found['name'],
            'cover' => $found['cover'],
            'embed' => Spotify::embed($id),
            'message' => $found['found'] ? null : 'No pudimos hablar con Spotify ahora: escribe el nombre a mano. Para traer la carátula, vuelve a guardarla más tarde.',
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $playlist = $request->filled('id') ? $this->find(RadioSpotifyPlaylist::class, $request->input('id')) : new RadioSpotifyPlaylist;
        if (! $playlist) {
            return $this->fail('Esa playlist ya no existe. Recarga la página.', 404);
        }
        $id = Spotify::playlistId((string) $request->input('link'));
        if ($id === null) {
            return $this->fail(self::BAD_LINK);
        }
        $twin = RadioSpotifyPlaylist::query()->where('spotify_id', $id)->whereKeyNot($playlist->id)->first();
        if ($twin) {
            return $this->fail('Esa playlist ya está agregada como «'.$twin->name.'».');
        }

        $found = Spotify::lookup($id);
        if ($found['found'] === false) {
            return $this->fail(self::NOT_FOUND);
        }
        $name = mb_substr(trim((string) $request->input('name')), 0, 80) ?: $found['name'];
        if ($name === null || mb_strlen($name) < 2) {
            return $this->fail('Ponle un nombre a la playlist (por ejemplo «Alabanza Zoe»).');
        }

        $playlist->fill([
            'spotify_id' => $id,
            'name' => $name,
            'description' => mb_substr(trim((string) $request->input('description', '')), 0, 240) ?: null,
            'cover_url' => $found['cover'] ?? ($playlist->spotify_id === $id ? $playlist->cover_url : null),
            'published' => $request->boolean('published', true),
        ]);
        if (! $playlist->exists) {
            $playlist->sort_order = (int) RadioSpotifyPlaylist::query()->max('sort_order') + 1;
        }
        $playlist->save();

        return response()->json([
            'ok' => true,
            'reload' => true,
            'id' => $playlist->id,
            'message' => $playlist->published
                ? '«'.$name.'» guardada y visible en la página de la radio.'
                : '«'.$name.'» guardada como oculta: no se ve en la página hasta que la publiques.',
        ]);
    }

    /** Order of the playlists on /radio. */
    public function order(Request $request): JsonResponse
    {
        DB::transaction(function () use ($request) {
            foreach ($this->uuids($request->input('ids'))->unique()->values() as $position => $id) {
                RadioSpotifyPlaylist::query()->whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return $this->saved('Orden guardado.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->find(RadioSpotifyPlaylist::class, $request->input('id'))?->delete();

        return $this->saved('Playlist quitada de la página de la radio. En Spotify sigue igual.');
    }
}
