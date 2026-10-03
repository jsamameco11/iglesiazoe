<?php

namespace App\Http\Controllers\Web;

use App\Domain\Games\Rooms\RoomError;
use App\Domain\Games\Rooms\Rooms;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Live rooms of REBET and El Cristiano Oculto; each phone sends its secret token in X-Game-Token. */
class GameRoomsController extends Controller
{
    public function create(Request $request): JsonResponse
    {
        return $this->attempt(function () use ($request) {
            [$room, $token] = Rooms::create(
                (string) $request->input('game'),
                (string) $request->input('name'),
                (array) $request->input('settings', []),
            );

            return response()->json(['code' => $room->code, 'token' => $token]);
        });
    }

    public function join(Request $request, string $code): JsonResponse
    {
        return $this->attempt(fn () => response()->json([
            'code' => mb_strtoupper($code),
            'token' => Rooms::join($code, (string) $request->input('name')),
        ]));
    }

    public function state(Request $request, string $code): JsonResponse
    {
        $room = Rooms::find($code);
        if (! $room || $room->status === 'closed') {
            return response()->json(['error' => 'Esta sala ya se cerró.', 'closed' => true], 410);
        }
        $player = $room->playerByToken($request->header('X-Game-Token'));
        if (! $player) {
            return response()->json(['error' => 'Ya no estás en esta sala.', 'gone' => true], 403);
        }

        return response()->json(Rooms::view($room, $player))->header('Cache-Control', 'no-store');
    }

    public function act(Request $request, string $code): JsonResponse
    {
        return $this->attempt(function () use ($request, $code) {
            [$room, $player, $extra] = Rooms::act($code, $request->header('X-Game-Token'), (string) $request->input('action'), $request->except('action'));
            if (! $player || $room->status === 'closed') {
                return response()->json(['closed' => $room->status === 'closed', 'left' => ! $player]);
            }

            return response()->json([...Rooms::view($room, $player), ...$extra]);
        });
    }

    private function attempt(callable $reply): JsonResponse
    {
        try {
            return $reply();
        } catch (RoomError $error) {
            return $this->fail($error->getMessage());
        }
    }
}
