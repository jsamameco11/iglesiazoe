<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Station;
use App\Http\Controllers\Controller;
use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioSpotifyPlaylist;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/** Shared helpers of the radio areas (console, schedule, library and settings), each behind its own permission. */
abstract class RadioController extends Controller
{
    /** Requested timeline layer, or null when it does not exist. */
    protected function layerFrom(Request $request): ?int
    {
        $layer = filter_var($request->input('layer', RadioSlot::MAIN), FILTER_VALIDATE_INT);

        return $layer !== false && $layer >= RadioSlot::MAIN && $layer <= RadioSlot::OVERLAYS ? $layer : null;
    }

    /**
     * Blocks to place from the request: one live block (main layer only) or library audios.
     *
     * @return list<array<string, mixed>>|string
     */
    protected function blocksFrom(Request $request, int $layer = RadioSlot::MAIN): array|string
    {
        $note = mb_substr(trim((string) $request->input('note', '')), 0, 240) ?: null;

        if ($request->input('type') === 'vivo') {
            if ($layer !== RadioSlot::MAIN) {
                return 'Los bloques en vivo van en la pista principal.';
            }
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
                'layer' => RadioSlot::MAIN,
                'title' => $title,
                'duration' => round($minutes * 60, 2),
                'radio_track_id' => null,
                'bed' => $request->boolean('bed'),
                'note' => $note,
            ]];
        }

        $ids = $this->uuids($request->input('tracks'));
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
        $duck = $request->has('duck') && $request->input('duck') !== '' ? $request->boolean('duck') : null;

        return Schedule::trackBlocks($tracks, $note, $layer, $duck, (int) $request->input('volume', 100));
    }

    /** Requested playlist: the list, null for random songs, or false when it no longer exists. */
    protected function playlistFrom(Request $request): RadioPlaylist|false|null
    {
        $id = $request->input('playlist');
        if ($id === null || $id === '') {
            return null;
        }

        return $this->find(RadioPlaylist::class, $id) ?? false;
    }

    /** Playlists to choose from, in order, each with its Spotify reference (and the ids of its songs, in order, with $tracks). */
    protected function playlists(bool $tracks = false): array
    {
        return RadioPlaylist::query()->with(['tracks', 'spotify'])->orderBy('sort_order')->orderBy('created_at')->get()
            ->map(fn (RadioPlaylist $playlist) => $tracks ? $playlist->payload() : Arr::except($playlist->payload(), 'tracks'))->all();
    }

    /** Spotify playlists of the panel that a list can take as its reference. */
    protected function spotifyReferences(): array
    {
        return RadioSpotifyPlaylist::ordered()->get()->map->card()->all();
    }

    /**
     * Switches the automatic music to the requested source (a list or random songs) and says when
     * the change is heard; a failure when the list no longer exists.
     */
    protected function switchRequested(Request $request, bool $immediately = false): JsonResponse|string
    {
        $playlist = $this->playlistFrom($request);
        if ($playlist === false) {
            return $this->fail('Esa lista de reproducción ya no existe.', 404);
        }

        return $this->switchedMessage($playlist, $request->boolean('shuffle', true), $immediately);
    }

    /** Changes the automatic music of the gaps and says when the change is heard. */
    protected function switchedMessage(?RadioPlaylist $playlist, bool $shuffle, bool $immediately = false): string
    {
        $since = Station::switchAutopilot($playlist?->id, $shuffle, $immediately);
        $what = $playlist !== null ? 'lista «'.$playlist->name.'» '.($shuffle ? 'en aleatorio' : 'en orden') : 'canciones aleatorias';
        if ($since <= Station::nowMs() + 1000) {
            return "Música automática: {$what}. Ya está sonando.";
        }
        $autopilot = Station::autopilot();

        return "Cambio programado: {$what} empieza a las ".Schedule::clock($since).'; justo cuando termina la canción que suene, sin cortes. Hasta entonces sigue '.$autopilot['pending']['label'].'. Puedes cancelarlo antes.';
    }

    /** Calls off a pending change of the automatic music. */
    protected function cancelledMessage(): string
    {
        return Station::cancelAutopilotSwitch()
            ? 'Cambio cancelado: sigue sonando '.Station::autopilot()['label'].'.'
            : 'No había un cambio pendiente: ya está sonando '.Station::autopilot()['label'].'.';
    }

    protected function conflictMessage(RadioSlot $conflict): string
    {
        return 'Se cruza con «'.$conflict->title.'» en la '.RadioSlot::layerLabel($conflict->layer)
            .' ('.Schedule::clock($conflict->starts_at->getTimestampMs()).'–'.Schedule::clock($conflict->endsAt()->getTimestampMs()).').';
    }
}
