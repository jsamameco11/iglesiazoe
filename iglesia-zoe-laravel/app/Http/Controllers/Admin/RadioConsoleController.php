<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Schedule;
use App\Domain\Radio\Signal;
use App\Domain\Radio\Station;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
                return response()->json(['error' => 'Abre la transmisión en vivo para hablar al aire.'], 409);
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
            return response()->json(['error' => 'Acción desconocida.'], 422);
        }

        return response()->json(['ok' => true, ...$this->snapshot()]);
    }

    /** Pads, players and beds: play a library audio on top of the program, stop or fade it out, or change its volume. */
    public function layer(Request $request): JsonResponse
    {
        $action = $request->input('action');
        $lane = $request->input('lane');
        if ($lane !== null && ! in_array($lane, Station::LANES, true)) {
            return response()->json(['error' => 'Ese reproductor no existe.'], 422);
        }

        if ($action === 'play') {
            $track = $this->find(RadioTrack::class, $request->input('id'));
            if (! $track || ! $track->active) {
                return response()->json(['error' => 'Ese audio ya no está en la biblioteca.'], 404);
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

        return response()->json(['error' => 'Acción desconocida.'], 422);
    }

    /** Saves which library audios fill the pad bank, in order. */
    public function pads(Request $request): JsonResponse
    {
        $ids = collect((array) $request->input('tracks', []))->filter(fn ($id) => is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id))->unique()->values();
        if ($ids->count() > Station::MAX_PADS) {
            return response()->json(['error' => 'La botonera tiene hasta '.Station::MAX_PADS.' botones.'], 422);
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
            return response()->json(['error' => $blocks], 422);
        }
        Schedule::insertNow($blocks);

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Al aire ahora. La programación siguiente se corrió para darle espacio.']);
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
            return response()->json(['error' => 'La transmisión no está abierta.'], 409);
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
        ];
    }
}
