<?php

namespace App\Http\Controllers\Web;

use App\Domain\Stream\LiveState;
use App\Domain\Stream\SignalHooks;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class LiveController extends Controller
{
    /** Live state for the Enseñanzas page and the EN VIVO button. */
    public function state(): JsonResponse
    {
        return response()->json(LiveState::current())->header('Cache-Control', 'public, max-age=10');
    }

    /**
     * The media server asks before accepting a connection (MediaMTX HTTP authentication).
     * Watching is open; publishing needs the stream key.
     */
    public function publisher(Request $request): Response
    {
        if ($request->input('action') !== 'publish') {
            return response()->noContent(200);
        }
        $allowed = SignalHooks::mayPublish(
            is_string($request->input('path')) ? $request->input('path') : null,
            is_string($request->input('user')) ? $request->input('user') : null,
            is_string($request->input('password')) ? $request->input('password') : null,
        );

        return response()->noContent($allowed ? 200 : 401);
    }
}
