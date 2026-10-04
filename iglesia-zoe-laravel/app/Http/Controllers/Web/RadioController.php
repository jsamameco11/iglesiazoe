<?php

namespace App\Http\Controllers\Web;

use App\Domain\Radio\RadioHealth;
use App\Domain\Radio\Signal;
use App\Domain\Radio\Station;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Http\Controllers\Controller;
use App\Models\RadioEpisode;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RadioController extends Controller
{
    private const MAX_SDP = 20000;

    public function page(Request $request): Response
    {
        $today = Station::today();
        $tomorrow = CarbonImmutable::parse($today, Station::TZ)->addDay()->toDateString();

        return Inertia::render('Radio', [
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'serveAreas' => LoadPublicSite::serveAreas(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'skin' => ResolveSiteSkin::fromRequest($request),
            'radio' => Station::state(),
            'program' => [
                ['date' => $today, 'items' => $this->program($today)],
                ['date' => $tomorrow, 'items' => $this->program($tomorrow)],
            ],
            'episodes' => RadioEpisode::published()->limit(60)->get()->map->card(),
        ]);
    }

    private function program(string $date): array
    {
        [$from, $to] = Station::dayBounds($date);

        return Station::items($from, $to, false);
    }

    public function state(Request $request): JsonResponse
    {
        $state = Station::state();
        $id = $this->listenerId($request->query('oyente'));
        if ($id) {
            $state['voice'] = Signal::voiceOf(Signal::touch($id), $state['live']['session']);
        }

        return response()->json($state)->header('Cache-Control', 'no-store');
    }

    public function voice(Request $request): JsonResponse
    {
        $id = $this->listenerId($request->input('oyente'));
        $session = Station::state()['live']['session'];
        if (! $id || ! $session || $request->input('session') !== $session) {
            return $this->fail('La transmisión en vivo ya terminó.', 409);
        }
        Signal::request($id, $session);

        return response()->json(['ok' => true]);
    }

    public function answer(Request $request): JsonResponse
    {
        $id = $this->listenerId($request->input('oyente'));
        $sdp = $request->input('sdp');
        if (! $id || ! is_string($sdp) || strlen($sdp) > self::MAX_SDP || ! is_string($request->input('session'))) {
            return $this->fail('Respuesta inválida.');
        }

        return Signal::answer($id, $request->input('session'), $sdp)
            ? response()->json(['ok' => true])
            : $this->fail('La conexión expiró. Volvemos a intentarlo.', 409);
    }

    /** A listener's player could not play an audio: the station checks it (see RadioHealth). */
    public function failed(Request $request): JsonResponse
    {
        $id = $this->listenerId($request->input('oyente'));
        $trackId = $request->input('track');
        $track = $id && is_string($trackId) && Str::isUuid($trackId) ? RadioTrack::query()->find($trackId) : null;
        if (! $track) {
            return $this->fail('Ese audio no está en la radio.', 404);
        }
        RadioHealth::report($track, (string) $request->ip());

        return response()->json(['ok' => true], 202);
    }

    public function leave(Request $request): JsonResponse
    {
        $id = $this->listenerId($request->input('oyente'));
        if ($id) {
            Signal::leave($id);
        }

        return response()->json(['ok' => true]);
    }

    private function listenerId(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) ? strtolower($value) : null;
    }
}
