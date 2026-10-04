<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Autopilot;
use App\Domain\Radio\LiveSwitch;
use App\Domain\Radio\Schedule;
use App\Domain\Radio\Signal;
use App\Domain\Radio\Station;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** The live console: microphone and mixer, pad bank, simultaneous players and «Al aire ahora». */
class RadioConsoleController extends RadioController
{
    private const MAX_SDP = 20000;

    public function index(Request $request): Response
    {
        $today = Station::today();

        return Inertia::render('Admin/Radio/Consola', [
            ...$this->snapshot(),
            'pads' => Station::pads()->map->payload()->values(),
            'library' => RadioTrack::query()->where('active', true)->orderBy('kind')->orderBy('title')->get()->map->payload(),
            'today' => $today,
            'day' => Schedule::day($today),
            'host' => $request->user()->full_name ?: $request->user()->username,
            'playlists' => $this->playlists(),
            'spotifyReferences' => $this->spotifyReferences(),
        ]);
    }

    public function live(Request $request): JsonResponse
    {
        $action = $request->input('action');
        if ($action === 'start') {
            $host = mb_substr(trim((string) $request->input('host')), 0, 80) ?: ($request->user()->full_name ?: 'Radio Zoe');
            if (! Station::config()['on_air']) {
                Station::saveConfig(['on_air' => true]);
            }
            Station::startLive($host);
        } elseif ($action === 'stop') {
            Station::endLive();
        } elseif ($action === 'air') {
            if (! $request->boolean('on')) {
                Station::endLive();
            }
            Station::saveConfig(['on_air' => $request->boolean('on')]);
        } elseif ($action === 'mix') {
            $session = Station::live()['session'];
            if ($request->boolean('mic') && ! $session) {
                return $this->fail('Abre la transmisión en vivo para hablar al aire.', 409);
            }
            if ($session) {
                Station::heartbeat();
            }
            $level = fn (string $key) => $request->has($key) ? max(0, min(100, (int) $request->input($key))) : null;
            Station::updateLive(fn () => array_filter([
                'music' => $level('music'),
                'overlay' => $level('overlay'),
                'muted' => $request->has('muted') ? $request->boolean('muted') : null,
                'bed' => $request->has('bed') ? $request->boolean('bed') : null,
                'mic' => $request->has('mic') ? $request->boolean('mic') : null,
                'host' => $request->filled('host') ? mb_substr(trim((string) $request->input('host')), 0, 80) : null,
            ], fn ($value) => $value !== null));
        } else {
            return $this->fail('Acción desconocida.');
        }

        return response()->json(['ok' => true, ...$this->snapshot()]);
    }

    /** Pads, players and beds: play a library audio on top of the program, stop or fade it out, or change its volume. */
    public function layer(Request $request): JsonResponse
    {
        $action = $request->input('action');
        $lane = $request->input('lane');
        if ($lane !== null && ! in_array($lane, Station::LANES, true)) {
            return $this->fail('Ese reproductor no existe.');
        }

        if ($action === 'play') {
            $track = $this->find(RadioTrack::class, $request->input('id'));
            if (! $track || ! $track->active) {
                return $this->fail('Ese audio ya no está en la biblioteca.', 404);
            }
            $duck = $request->has('duck') && $request->input('duck') !== '' ? $request->boolean('duck') : $track->duck;
            $layer = Station::playLayer(
                $track,
                $lane ?? 'pad',
                (int) $request->input('volume', 100),
                $duck,
                (float) $request->input('fade_in', 0),
                (float) $request->input('fade_out', 0),
                $request->boolean('loop'),
            );

            return response()->json(['ok' => true, 'layer' => $layer, ...$this->snapshot()]);
        }
        if ($action === 'stop') {
            $id = $request->input('layer');
            $id = is_string($id) ? $id : null;
            if ((float) $request->input('fade', 0) > 0) {
                $faded = Station::fadeLayers($lane, $id, (float) $request->input('fade'));

                return response()->json(['ok' => true, 'faded' => $faded, ...$this->snapshot()]);
            }
            $stopped = Station::stopLayers($lane, $id);

            return response()->json(['ok' => true, 'stopped' => $stopped, ...$this->snapshot()]);
        }
        if ($action === 'update') {
            $layer = Station::updateLayer((string) $request->input('layer'), (int) $request->input('volume', 100), $request->boolean('duck'));

            return response()->json(['ok' => $layer !== null, 'layer' => $layer, ...$this->snapshot()]);
        }

        return $this->fail('Acción desconocida.');
    }

    /**
     * The automatic music from the console: pause or resume it, take a song out of it so it stops
     * repeating, choose what it plays, and the live switch (cut the music for the live signal,
     * return to the music, automatic or manual mode). Every change reaches all listeners at once.
     */
    public function music(Request $request): JsonResponse
    {
        $action = $request->input('action');
        if ($action === 'source') {
            $message = $this->switchRequested($request);
            if ($message instanceof JsonResponse) {
                return $message;
            }

            return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $message]);
        }
        if ($action === 'cancel') {
            return response()->json(['ok' => true, 'message' => $this->cancelledMessage(), ...$this->snapshot()]);
        }
        if ($action === 'cut') {
            return $this->cut($request);
        }
        if ($action === 'mode') {
            $mode = $request->input('mode') === LiveSwitch::MANUAL ? LiveSwitch::MANUAL : LiveSwitch::AUTO;
            Station::saveConfig(['live_mode' => $mode]);

            return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $mode === LiveSwitch::AUTO
                ? 'En vivo automático: en los bloques en vivo la música se corta sola al conectarte y vuelve sola al terminar.'
                : 'En vivo manual: la música solo se corta y vuelve cuando lo indiques desde la consola.']);
        }
        if ($action === 'autofill') {
            $on = $request->boolean('on');
            Station::saveConfig(['autofill' => $on]);

            return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $on
                ? 'Música continua reanudada: vuelve a llenar los espacios libres.'
                : 'Música continua en pausa: solo suena lo programado y lo que lances desde la consola.']);
        }
        if ($action === 'drop') {
            $track = $this->find(RadioTrack::class, $request->input('id'));
            if (! $track || $track->kind !== 'musica') {
                return $this->fail('Esa canción ya no está en la biblioteca.', 404);
            }
            $track->update(['rotation' => false]);
            $lists = DB::table('radio_playlist_track')->where('radio_track_id', $track->id)->delete();
            Station::flush();
            $level = Autopilot::resolve(null, true, 0)['level'];

            return response()->json(['ok' => true, ...$this->snapshot(), 'message' => "«{$track->title}» salió de la música automática"
                .($lists ? ' (y de '.($lists === 1 ? 'su lista' : "sus {$lists} listas").')' : '').' y no se repetirá.'
                .match ($level) {
                    Autopilot::LIBRARY => ' Tus listas quedaron vacías: mientras tanto suenan canciones de la biblioteca en aleatorio.',
                    Autopilot::NONE => ' La música automática quedó vacía: los espacios libres estarán en silencio.',
                    default => '',
                }]);
        }

        return $this->fail('Acción desconocida.');
    }

    /**
     * «Ir al vivo» cuts the automatic music for the live signal; «Volver a la música» brings it
     * back at once, optionally with another playlist or order.
     */
    private function cut(Request $request): JsonResponse
    {
        $config = Station::config();
        if ($request->boolean('on')) {
            if (! $config['on_air']) {
                return $this->fail('La radio está fuera del aire. Ponla al aire primero.', 409);
            }
            $external = $config['live_source'] === LiveSwitch::EXTERNAL;
            if ($external && $config['live_url'] === '') {
                return $this->fail('Falta el enlace de la señal externa. Escríbelo en Ajustes › En vivo.', 409);
            }
            if (! $external && ! Station::live()['session']) {
                return $this->fail('Abre la transmisión en vivo (micrófono) antes de cortar la música.', 409);
            }
            LiveSwitch::cut(Station::live()['host'] ?: 'En vivo');

            return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $external
                ? 'Al aire la señal externa: la música automática se cortó para todos los oyentes.'
                : 'Estás al aire: la música automática se cortó para todos los oyentes.']);
        }

        $message = 'De vuelta a la música automática.';
        if ($request->has('playlist')) {
            $message = $this->switchRequested($request, true);
            if ($message instanceof JsonResponse) {
                return $message;
            }
        }
        LiveSwitch::resume();

        return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $message]);
    }

    /**
     * Reprograms a block of the main program from the console's warning: a few minutes later
     * or at another time. While the live transmission lasts, audios still wait for it to end.
     */
    public function reschedule(Request $request): JsonResponse
    {
        $slot = $this->find(RadioSlot::class, $request->input('id'));
        if (! $slot || $slot->layer !== RadioSlot::MAIN) {
            return $this->fail('Ese bloque ya no está en la programación.', 404);
        }
        $now = Station::nowMs();
        $date = Schedule::date($request->input('date')) ?? Station::today();
        if ($request->input('mode') === 'shift') {
            $minutes = (int) $request->input('minutes');
            if ($minutes < 1 || $minutes > 720) {
                return $this->fail('Corre el bloque entre 1 minuto y 12 horas.');
            }
            $start = max($slot->starts_at->getTimestampMs(), $now) + $minutes * 60000;
        } else {
            $start = Schedule::at($date, (string) $request->input('time'));
            if ($start === null) {
                return $this->fail('Escribe la nueva hora (por ejemplo 18:30).');
            }
        }
        if ($start < $now + 1000) {
            return $this->fail('Esa hora ya pasó. Elige una hora futura.');
        }
        $end = $start + (int) round($slot->duration * 1000);
        if ($conflict = Schedule::conflict($start, $end, RadioSlot::MAIN, $slot->id)) {
            return $this->fail($this->conflictMessage($conflict).' Elige otra hora.');
        }
        $slot->update(['starts_at' => Schedule::utc($start)]);
        Station::flush();

        $day = CarbonImmutable::createFromTimestampMs($start)->setTimezone(Station::TZ);
        $when = 'las '.$day->format('H:i').($day->toDateString() === Station::today() ? '' : ' del '.$day->format('d/m'));
        $waits = Station::holding(Station::live()) && ! in_array($slot->kind, [RadioSlot::LIVE, RadioSlot::AUTO], true);

        return response()->json(['ok' => true, ...$this->snapshot(), 'message' => '«'.$slot->title.'» quedó para '.$when.'.'
            .($waits ? ' Si a esa hora sigues en vivo, esperará a que termines la transmisión.' : '')]);
    }

    /** Saves which library audios fill the pad bank, in order. */
    public function pads(Request $request): JsonResponse
    {
        $ids = $this->uuids($request->input('tracks'))->unique()->values();
        if ($ids->count() > Station::MAX_PADS) {
            return $this->fail('La botonera tiene hasta '.Station::MAX_PADS.' botones.');
        }
        $known = RadioTrack::query()->whereIn('id', $ids)->pluck('id')->all();
        Station::saveConfig(['pads' => $ids->filter(fn ($id) => in_array($id, $known, true))->values()->all()]);

        return response()->json(['ok' => true, 'pads' => Station::pads()->map->payload()->values(), 'message' => 'Botonera guardada.']);
    }

    /** «Al aire ahora»: the chosen audios replace what plays on the main program right away. */
    public function launch(Request $request): JsonResponse
    {
        $blocks = $this->blocksFrom($request, RadioSlot::MAIN);
        if (is_string($blocks)) {
            return $this->fail($blocks);
        }
        Schedule::insertNow($blocks);

        return $this->saved('Al aire ahora. La programación siguiente se corrió para darle espacio.');
    }

    /** Console heartbeat: live state, the program, and the WebRTC handshakes to serve. */
    public function signal(): JsonResponse
    {
        Station::heartbeat();
        $snapshot = $this->snapshot();
        $session = $snapshot['live']['session'];
        if (random_int(1, 40) === 1) {
            Signal::prune();
        }

        return response()->json([
            ...$snapshot,
            'pending' => $session ? Signal::pending($session, (int) Station::config()['max_voice']) : [],
            'answers' => $session ? Signal::answers($session) : [],
            'alive' => $session ? Signal::alive($session) : [],
        ])->header('Cache-Control', 'no-store');
    }

    public function offer(Request $request): JsonResponse
    {
        $session = Station::live()['session'];
        $sdp = $request->input('sdp');
        $id = $request->input('id');
        if (! $session || ! is_string($id) || ! is_string($sdp) || strlen($sdp) > self::MAX_SDP) {
            return $this->fail('La transmisión no está abierta.', 409);
        }

        return response()->json(['ok' => Signal::offer($session, $id, $sdp)]);
    }

    private function snapshot(): array
    {
        $live = Station::live();

        return [
            'radio' => Station::state(),
            'live' => $live,
            'voice' => Station::voiceCount($live['session']),
            'config' => Station::config(),
            'autopilot' => Station::autopilot(),
            'upcoming' => Station::upcoming(Station::nowMs()),
        ];
    }
}
