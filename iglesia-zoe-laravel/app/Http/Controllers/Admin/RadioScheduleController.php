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
            'playlists' => $this->playlists(),
            'spotifyReferences' => $this->spotifyReferences(),
            'autopilot' => Station::autopilot(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        $mode = $request->input('mode');
        $layer = $this->layerFrom($request);
        if (! $date || ! in_array($mode, ['end', 'at', 'now'], true) || $layer === null) {
            return $this->fail('Elige el día, la pista y cuándo debe sonar.');
        }
        if ($request->input('type') === RadioSlot::AUTO) {
            return $this->storeAuto($request, $date, $mode, $layer);
        }

        $blocks = $this->blocksFrom($request, $layer);
        if (is_string($blocks)) {
            return $this->fail($blocks);
        }

        if ($mode === 'now' && $layer === RadioSlot::MAIN) {
            Schedule::insertNow($blocks);

            return $this->saved('Al aire ahora. La programación siguiente se corrió para darle espacio.');
        }

        $now = Station::nowMs();
        $start = match ($mode) {
            'now' => $now + 400,
            'end' => Schedule::dayEnd($date, $layer) ?? Schedule::at($date, (string) $request->input('time', '06:00')),
            default => Schedule::at($date, (string) $request->input('time')),
        };
        if ($start === null) {
            return $this->fail('Escribe la hora de inicio (por ejemplo 18:30 o 18:30:15).');
        }
        if ($start < $now - 1000) {
            if ($mode === 'end' && $date === Station::today()) {
                $start = $now + 3000;
            } else {
                return $this->fail('Esa hora ya pasó. Elige una hora futura o usa «Al aire ahora».');
            }
        }

        $end = $start + Schedule::length($blocks);
        if ($conflict = Schedule::conflict($start, $end, $layer)) {
            return $this->fail($this->conflictMessage($conflict).' Elige otra hora, otra capa o mueve ese bloque.');
        }
        Schedule::place($blocks, $start);
        $count = count($blocks);
        $where = $layer === RadioSlot::MAIN ? '' : ' en la '.RadioSlot::layerLabel($layer);

        return $this->saved(($count === 1 ? 'Bloque programado' : $count.' bloques programados').$where.' de '.Schedule::clock($start).' a '.Schedule::clock($end).'.');
    }

    public function update(Request $request): JsonResponse
    {
        $slot = $this->find(RadioSlot::class, $request->input('id'));
        if (! $slot) {
            return $this->fail('Ese bloque ya no existe. Recarga la página.', 404);
        }
        $date = Schedule::date($request->input('date')) ?? $slot->starts_at->setTimezone(Station::TZ)->toDateString();
        $start = $request->filled('time') ? Schedule::at($date, (string) $request->input('time')) : $slot->starts_at->getTimestampMs();
        if ($start === null) {
            return $this->fail('Escribe una hora válida (por ejemplo 18:30 o 18:30:15).');
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
                return $this->fail('Un bloque en vivo dura entre 1 minuto y 6 horas.');
            }
            $data['duration'] = round($minutes * 60, 2);
            $data['bed'] = $request->boolean('bed');
        } elseif ($slot->kind === RadioSlot::AUTO) {
            $playlist = $this->playlistFrom($request);
            if ($playlist === false) {
                return $this->fail('Esa lista de reproducción ya no existe.');
            }
            $until = $request->filled('until') ? Schedule::at($date, (string) $request->input('until')) : $slot->endsAt()->getTimestampMs();
            if ($until === null) {
                return $this->fail('Escribe la hora en que termina (por ejemplo 18:00).');
            }
            $until += $until <= $start ? 86400000 : 0;
            $seconds = ($until - $start) / 1000;
            if ($seconds < 60 || $seconds > Station::MAX_BLOCK) {
                return $this->fail('Al editar, un periodo dura entre 1 minuto y 6 horas. Para uno más largo, quítalo y prográmalo de nuevo.');
            }
            $shuffle = $playlist === null || $request->boolean('shuffle', $slot->shuffle);
            $data = [
                ...$data,
                'duration' => round($seconds, 2),
                'radio_playlist_id' => $playlist?->id,
                'shuffle' => $shuffle,
                'title' => Schedule::autoTitle($playlist, $shuffle),
            ];
        } else {
            $layer = $request->has('layer') ? $this->layerFrom($request) : $slot->layer;
            if ($layer === null) {
                return $this->fail('Elige una pista válida.');
            }
            $data['layer'] = $layer;
            $data['duck'] = $layer !== RadioSlot::MAIN && $request->boolean('duck', $slot->duck);
            $data['volume'] = $layer === RadioSlot::MAIN ? 100 : max(0, min(100, (int) $request->input('volume', $slot->volume)));
        }

        $end = $start + (int) round(($data['duration'] ?? $slot->duration) * 1000);
        if ($conflict = Schedule::conflict($start, $end, $data['layer'] ?? $slot->layer, $slot->id)) {
            return $this->fail($this->conflictMessage($conflict).' Elige otra hora.');
        }
        $slot->update($data);
        Station::flush();

        return $this->saved('Bloque actualizado.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->find(RadioSlot::class, $request->input('id'))?->delete();
        Station::flush();

        return $this->saved('Bloque quitado de la programación.');
    }

    public function clear(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        if (! $date) {
            return $this->fail('Elige un día.');
        }
        [$from, $to] = Station::dayBounds($date);
        $removed = RadioSlot::query()->where('starts_at', '>=', Schedule::utc(max($from, Station::nowMs())))->where('starts_at', '<', Schedule::utc($to))->delete();
        Station::flush();

        return $this->saved($removed ? "Se quitaron {$removed} bloques del día." : 'No había bloques por quitar.');
    }

    public function copy(Request $request): JsonResponse
    {
        $date = Schedule::date($request->input('date'));
        $targets = collect((array) $request->input('targets', []))->map(fn ($value) => Schedule::date($value))->filter()
            ->reject(fn ($value) => $value === $date || $value < Station::today())->unique()->values()->all();
        if (! $date || ! $targets) {
            return $this->fail('Elige uno o más días futuros para copiar la programación.');
        }
        if (count($targets) > 31) {
            return $this->fail('Copia hasta 31 días a la vez.');
        }
        [$copied, $skipped] = Schedule::copyDay($date, $targets, $request->boolean('replace'));
        $message = "Se copiaron {$copied} bloques a ".count($targets).' día(s).';
        if ($skipped) {
            $message .= " {$skipped} no se copiaron porque se cruzaban con bloques ya programados.";
        }

        return $this->saved($message);
    }

    /** Chooses the songs of the continuous music that fills the gaps of the main program. */
    public function rotation(Request $request): JsonResponse
    {
        $ids = $this->uuids($request->input('tracks'))->unique()->values()->all();
        $music = RadioTrack::query()->where('kind', 'musica')->where('active', true);
        (clone $music)->whereIn('id', $ids)->update(['rotation' => true]);
        (clone $music)->whereNotIn('id', $ids)->update(['rotation' => false]);
        Station::flush();
        $count = (clone $music)->where('rotation', true)->count();

        return $this->saved($count
            ? "Música continua: {$count} ".($count === 1 ? 'canción' : 'canciones').' en rotación.'
            : 'Música continua vacía: los huecos de la programación quedarán en silencio.');
    }

    /** The automatic music of the gaps: one list or all of them; or calls off a pending change. */
    public function autopilot(Request $request): JsonResponse
    {
        if ($request->boolean('cancel')) {
            return $this->saved($this->cancelledMessage());
        }
        $message = $this->switchRequested($request);

        return $message instanceof JsonResponse ? $message : $this->saved($message);
    }

    /** «Música automática» from one time to another: a period of the main program for a playlist. */
    private function storeAuto(Request $request, string $date, string $mode, int $layer): JsonResponse
    {
        if ($layer !== RadioSlot::MAIN) {
            return $this->fail('La música automática va en la pista principal.');
        }
        $playlist = $this->playlistFrom($request);
        if ($playlist === false) {
            return $this->fail('Esa lista de reproducción ya no existe.');
        }

        $now = Station::nowMs();
        $start = match ($mode) {
            'now' => $now + 400,
            'end' => Schedule::dayEnd($date) ?? Schedule::at($date, (string) $request->input('time', '06:00')),
            default => Schedule::at($date, (string) $request->input('time')),
        };
        if ($start === null) {
            return $this->fail('Escribe la hora de inicio (por ejemplo 06:00).');
        }
        if ($start < $now - 1000) {
            if ($mode !== 'end' || $date !== Station::today()) {
                return $this->fail('Esa hora ya pasó. Elige una hora futura o usa «Al aire ahora».');
            }
            $start = $now + 3000;
        }
        $until = Schedule::at($date, (string) $request->input('until'));
        if ($until === null) {
            return $this->fail('Escribe la hora en que termina la música automática (por ejemplo 18:00).');
        }
        while ($until <= $start) {
            $until += 86400000;
        }
        $seconds = intdiv($until - $start, 1000);
        if ($seconds < 60 || $seconds > 86400) {
            return $this->fail('Un periodo de música automática dura entre 1 minuto y 24 horas.');
        }

        if ($conflict = Schedule::conflict($start, $until)) {
            return $this->fail($this->conflictMessage($conflict).' Ajusta el periodo o mueve ese bloque.');
        }
        $shuffle = $request->boolean('shuffle', true);
        $note = mb_substr(trim((string) $request->input('note', '')), 0, 240) ?: null;
        Schedule::place(Schedule::autoBlocks($playlist, $shuffle, $seconds, $note), $start);

        return $this->saved('Música automática de '.Schedule::clock($start).' a '.Schedule::clock($until).': '
            .($playlist ? 'lista «'.$playlist->name.'», '.($shuffle ? 'en aleatorio sin repetir' : 'en orden') : 'canciones aleatorias').'.');
    }
}
