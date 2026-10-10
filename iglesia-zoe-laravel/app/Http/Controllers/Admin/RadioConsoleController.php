<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Radio\Autopilot;
use App\Domain\Radio\LiveSwitch;
use App\Domain\Radio\RadioAudio;
use App\Domain\Radio\Schedule;
use App\Domain\Radio\Signal;
use App\Domain\Radio\Station;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** The live console: microphone and mixer, pad bank, simultaneous players and «Al aire ahora». */
class RadioConsoleController extends RadioController
{
    private const MAX_SDP = 20000;

    /** Factory effects: longest one, heaviest WAV, and the author they are filed under in the library. */
    private const MAX_EFFECT_SECONDS = 30;

    private const MAX_EFFECT_MB = 6;

    private const EFFECTS_ARTIST = 'Efectos Zoe';

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
            'episode' => Station::scheduledLiveTitle(Station::nowMs()) ?? '',
            'playlists' => $this->playlists(true),
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
            Station::startLive($host, $this->episodeTitle($request));
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
                'title' => $request->has('title') ? $this->episodeTitle($request) : null,
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
                is_string($request->input('layer')) ? $request->input('layer') : null,
                is_numeric($request->input('at')) ? (int) $request->input('at') : null,
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
        if ($action === 'start') {
            return $this->start($request);
        }
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
            return $this->answered($this->autofillMessage($request->boolean('on')));
        }
        if ($action === 'repeat') {
            return $this->answered($this->repeatMessage($request->boolean('on')));
        }
        if ($action === 'next') {
            $song = Station::skipSong((string) $request->input('item'));
            if ($song === null) {
                return $this->fail('Esa canción ya terminó o no hay otra canción automática después de ella.', 409);
            }

            return $this->answered("Siguiente canción: «{$song['title']}» empieza para todos los oyentes en unos segundos.");
        }
        if ($action === 'drop') {
            $track = $this->find(RadioTrack::class, $request->input('id'));
            if (! $track || $track->kind !== 'musica') {
                return $this->fail('Esa canción ya no está en la biblioteca.', 404);
            }
            $track->update(['rotation' => false]);
            $lists = DB::table('radio_playlist_track')->where('radio_track_id', $track->id)->delete();
            Station::flush();
            $autopilot = Station::autopilot();

            return $this->answered("«{$track->title}» salió de la música automática"
                .($lists ? ' (y de '.($lists === 1 ? 'su lista' : "sus {$lists} listas").')' : '').' y no se repetirá.'
                .match (true) {
                    $autopilot['level'] === Autopilot::NONE => ' «'.$autopilot['label'].'» quedó sin canciones: los espacios libres estarán en silencio.',
                    $autopilot['level'] === Autopilot::LIBRARY => ' Tus listas quedaron vacías: las canciones aleatorias salen de toda la biblioteca.',
                    default => '',
                });
        }

        return $this->fail('Acción desconocida.');
    }

    /**
     * «Iniciar modo automático»: the chosen list (or random songs) starts for every listener in a
     * few seconds, from the chosen song, with the radio on air and the continuous music on.
     */
    private function start(Request $request): JsonResponse
    {
        $playlist = $this->playlistFrom($request);
        if ($playlist === false) {
            return $this->fail('Esa lista de reproducción ya no existe.', 404);
        }
        $shuffle = $request->boolean('shuffle', true);
        $crossfade = (int) round(Station::config()['crossfade'] * 1000);
        $source = Autopilot::resolve($playlist?->id, $shuffle, $crossfade);
        if ($source['level'] === Autopilot::NONE) {
            return $this->fail($playlist
                ? 'La lista «'.$playlist->name.'» no tiene canciones disponibles. Agrégale canciones en Listas o elige otra.'
                : 'No hay canciones disponibles para el modo automático. Sube música en Biblioteca.', 409);
        }

        $first = null;
        if ($request->filled('first')) {
            $first = collect($source['songs'])->firstWhere('id', (string) $request->input('first'));
            if ($first === null) {
                return $this->fail('Esa canción no está disponible en '.($playlist ? 'la lista «'.$playlist->name.'»' : 'la música automática').'. Elige otra.', 422);
            }
        }

        $repeat = $request->has('repeat') ? $request->boolean('repeat') : null;
        $since = Station::startAutopilot($playlist?->id, $shuffle, $first['id'] ?? null, $repeat);
        $what = $playlist ? 'la lista «'.$playlist->name.'» ('.($shuffle ? 'aleatorio' : 'en orden').')' : 'canciones aleatorias';
        $song = Station::firstSong($since);
        $message = $song
            ? "Modo automático iniciado: «{$song['title']}» de {$what} empieza para todos los oyentes en unos segundos."
            : "Modo automático listo: {$what} empezará".($first ? " con «{$first['title']}»" : '').' cuando termine lo que está programado ahora.';
        $until = Station::autopilot()['until'];
        if ($until !== null) {
            $message .= ' Sin repetir: suena una vez y a las '.Schedule::clock($until).' la radio queda en silencio.';
        }

        return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $message]);
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
            LiveSwitch::cut(Station::live()['title'] ?: 'En vivo');

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

    /**
     * A factory effect of the botonera, rendered in the browser: stored once in the library (as
     * «Efectos Zoe · category») and added at the end of the pad bank.
     */
    public function effect(Request $request): JsonResponse
    {
        $title = mb_substr(trim((string) $request->input('title')), 0, 160);
        $category = mb_substr(trim((string) $request->input('category')), 0, 60);
        $duration = (float) $request->input('duration');
        if ($title === '' || $category === '' || $duration < 0.1 || $duration > self::MAX_EFFECT_SECONDS) {
            return $this->fail('Ese efecto no es válido. Recarga la página.');
        }

        $pads = Station::pads()->pluck('id')->all();
        $artist = self::EFFECTS_ARTIST.' · '.$category;
        $track = RadioTrack::query()->where('kind', 'efecto')->where('title', $title)->where('artist', $artist)->first();
        if ($track && in_array($track->id, $pads, true)) {
            return $this->fail("«{$title}» ya está en la botonera.", 409);
        }
        if (count($pads) >= Station::MAX_PADS) {
            return $this->fail('La botonera tiene hasta '.Station::MAX_PADS.' botones. Quita uno con «Editar» para agregar este efecto.', 409);
        }

        if (! $track) {
            $file = $request->file('audio');
            $problem = $file instanceof UploadedFile ? RadioAudio::problem($file) : 'No llegó el audio del efecto. Inténtalo de nuevo.';
            if ($problem === null && $file->getSize() > self::MAX_EFFECT_MB * 1024 * 1024) {
                $problem = 'El efecto pesa demasiado.';
            }
            if ($problem !== null) {
                return $this->fail($problem);
            }
            $track = RadioTrack::query()->create([
                'kind' => 'efecto',
                'title' => $title,
                'artist' => $artist,
                'file_path' => RadioAudio::store($file, 'efecto'),
                'duration' => round($duration, 2),
                'rotation' => false,
                'duck' => false,
                'active' => true,
            ]);
        } elseif (! $track->active) {
            $track->update(['active' => true]);
        }
        Station::saveConfig(['pads' => [...$pads, $track->id]]);

        return response()->json([
            'ok' => true,
            'track' => $track->payload(),
            'pads' => Station::pads()->map->payload()->values(),
            'message' => "«{$title}» agregado a la botonera.",
        ]);
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

    private function episodeTitle(Request $request): string
    {
        return mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $request->input('title'))), 0, 120);
    }

    private function answered(string $message): JsonResponse
    {
        return response()->json(['ok' => true, ...$this->snapshot(), 'message' => $message]);
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
