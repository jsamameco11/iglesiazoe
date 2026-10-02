<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Station;
use App\Http\Controllers\Controller;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Illuminate\Http\Request;

/** Shared helpers of the radio areas (console, schedule, library and settings), each behind its own permission. */
abstract class RadioController extends Controller
{
    /**
     * @template T of \Illuminate\Database\Eloquent\Model
     *
     * @param  class-string<T>  $model
     * @return T|null
     */
    protected function find(string $model, mixed $id): mixed
    {
        return is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id) ? $model::query()->find($id) : null;
    }

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
        $duck = $request->has('duck') && $request->input('duck') !== '' ? $request->boolean('duck') : null;

        return Schedule::trackBlocks($tracks, $note, $layer, $duck, (int) $request->input('volume', 100));
    }

    protected function conflictMessage(RadioSlot $conflict): string
    {
        return 'Se cruza con «'.$conflict->title.'» en la '.RadioSlot::layerLabel($conflict->layer)
            .' ('.Schedule::clock($conflict->starts_at->getTimestampMs()).'–'.Schedule::clock($conflict->endsAt()->getTimestampMs()).').';
    }
}
