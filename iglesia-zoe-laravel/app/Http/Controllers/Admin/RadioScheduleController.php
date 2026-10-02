<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Station;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The timeline of each day: the main program, the overlay layers and the continuous music. */
class RadioScheduleController extends RadioController
{
    public function index(Request $request): Response
    {
        $today = Station::today();
        $date = Schedule::date($request->query('fecha')) ?? $today;

        return Inertia::render('Admin/Radio/Programacion', [
            'date' => $date,
            'today' => $today,
            'now' => Station::nowMs(),
            'blocks' => Schedule::day($date),
            'dayEnds' => Schedule::dayEnds($date),
            'days' => Schedule::overview($today, 21),
            'tracks' => RadioTrack::query()->where('active', true)->orderBy('kind')->orderBy('title')->get()->map->payload(),
            'config' => Station::config(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        $mode = $request->input('mode');
        $layer = $this->layerFrom($request);
        if (! $date || ! in_array($mode, ['end', 'at', 'now'], true) || $layer === null) {
            return response()->json(['error' => 'Elige el día, la pista y cuándo debe sonar.'], 422);
        }

        $blocks = $this->blocksFrom($request, $layer);
        if (is_string($blocks)) {
            return response()->json(['error' => $blocks], 422);
        }

        if ($mode === 'now' && $layer === RadioSlot::MAIN) {
            Schedule::insertNow($blocks);

            return response()->json(['ok' => true, 'reload' => true, 'message' => 'Al aire ahora. La programación siguiente se corrió para darle espacio.']);
        }

        $now = Station::nowMs();
        $start = match ($mode) {
            'now' => $now + 400,
            'end' => Schedule::dayEnd($date, $layer) ?? Schedule::at($date, (string) $request->input('time', '06:00')),
            default => Schedule::at($date, (string) $request->input('time')),
        };
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
        if ($conflict = Schedule::conflict($start, $end, $layer)) {
            return response()->json(['error' => $this->conflictMessage($conflict).' Elige otra hora, otra capa o mueve ese bloque.'], 422);
        }
        Schedule::place($blocks, $start);
        $count = count($blocks);
        $where = $layer === RadioSlot::MAIN ? '' : ' en la '.RadioSlot::layerLabel($layer);

        return response()->json(['ok' => true, 'reload' => true, 'message' => ($count === 1 ? 'Bloque programado' : $count.' bloques programados').$where.' de '.Schedule::clock($start).' a '.Schedule::clock($end).'.']);
    }

    public function update(Request $request): JsonResponse
    {
        $slot = $this->find(RadioSlot::class, $request->input('id'));
        if (! $slot) {
            return response()->json(['error' => 'Ese bloque ya no existe. Recarga la página.'], 404);
        }
        $date = Schedule::date($request->input('date')) ?? $slot->starts_at->setTimezone(Station::TZ)->toDateString();
        $start = $request->filled('time') ? Schedule::at($date, (string) $request->input('time')) : $slot->starts_at->getTimestampMs();
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
        } else {
            $layer = $request->has('layer') ? $this->layerFrom($request) : $slot->layer;
            if ($layer === null) {
                return response()->json(['error' => 'Elige una pista válida.'], 422);
            }
            $data['layer'] = $layer;
            $data['duck'] = $layer !== RadioSlot::MAIN && $request->boolean('duck', $slot->duck);
            $data['volume'] = $layer === RadioSlot::MAIN ? 100 : max(0, min(100, (int) $request->input('volume', $slot->volume)));
        }

        $end = $start + (int) round(($data['duration'] ?? $slot->duration) * 1000);
        if ($conflict = Schedule::conflict($start, $end, $data['layer'] ?? $slot->layer, $slot->id)) {
            return response()->json(['error' => $this->conflictMessage($conflict).' Elige otra hora.'], 422);
        }
        $slot->update($data);
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Bloque actualizado.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->find(RadioSlot::class, $request->input('id'))?->delete();
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Bloque quitado de la programación.']);
    }

    public function clear(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        if (! $date) {
            return response()->json(['error' => 'Elige un día.'], 422);
        }
        [$from, $to] = Station::dayBounds($date);
        $removed = RadioSlot::query()->where('starts_at', '>=', Schedule::utc(max($from, Station::nowMs())))->where('starts_at', '<', Schedule::utc($to))->delete();
        Station::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => $removed ? "Se quitaron {$removed} bloques del día." : 'No había bloques por quitar.']);
    }

    public function copy(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        $targets = collect((array) $request->input('targets', []))->map(fn ($value) => Schedule::date($value))->filter()
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

    /** Chooses the songs of the continuous music that fills the gaps of the main program. */
    public function rotation(Request $request): JsonResponse
    {
        $ids = collect((array) $request->input('tracks', []))->filter(fn ($id) => is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id))->unique()->values()->all();
        $music = RadioTrack::query()->where('kind', 'musica')->where('active', true);
        (clone $music)->whereIn('id', $ids)->update(['rotation' => true]);
        (clone $music)->whereNotIn('id', $ids)->update(['rotation' => false]);
        Station::flush();
        $count = (clone $music)->where('rotation', true)->count();

        return response()->json(['ok' => true, 'reload' => true, 'message' => $count
            ? "Música continua: {$count} ".($count === 1 ? 'canción' : 'canciones').' en rotación.'
            : 'Música continua vacía: los huecos de la programación quedarán en silencio.']);
    }
}
