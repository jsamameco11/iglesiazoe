<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Stream\YouTube\YouTubeClient;
use App\Domain\Stream\YouTube\YouTubeError;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Connects the church's YouTube channel with Google sign-in (OAuth). */
class YouTubeController extends Controller
{
    private const BACK = '/admin/transmision';

    public function connect(Request $request): RedirectResponse
    {
        if (! YouTubeClient::configured()) {
            return redirect(self::BACK)->with('notice', YouTubeError::because('notConfigured')->getMessage());
        }
        $state = Str::random(40);
        $request->session()->put('youtube_state', $state);

        return redirect()->away(YouTubeClient::authUrl($state));
    }

    public function callback(Request $request): RedirectResponse
    {
        $expected = $request->session()->pull('youtube_state');
        if (! is_string($expected) || ! hash_equals($expected, (string) $request->query('state'))) {
            return redirect(self::BACK)->with('notice', 'La conexión con YouTube venció. Vuelve a intentarlo.');
        }
        if ($request->filled('error') || ! $request->filled('code')) {
            return redirect(self::BACK)->with('notice', 'No se conectó la cuenta: Google no dio el permiso.');
        }

        try {
            $youtube = YouTubeClient::connect((string) $request->query('code'));
        } catch (YouTubeError $error) {
            return redirect(self::BACK)->with('notice', $error->getMessage());
        }

        $channel = $youtube['channel']['title'] ?? 'YouTube';

        return redirect(self::BACK)->with('notice', ! empty($youtube['error'])
            ? 'Canal «'.$channel.'» conectado, con un aviso: '.$youtube['error']
            : 'Canal «'.$channel.'» conectado. Cada transmisión saldrá también en YouTube y se guardará en el canal.');
    }

    public function disconnect(): JsonResponse
    {
        YouTubeClient::disconnect();

        return $this->saved('Cuenta de YouTube desconectada.');
    }

    public function playlists(): JsonResponse
    {
        try {
            return response()->json(['playlists' => YouTubeClient::playlists()]);
        } catch (YouTubeError $error) {
            return response()->json(['playlists' => [], 'error' => $error->getMessage()]);
        }
    }
}
