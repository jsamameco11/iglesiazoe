<?php

namespace App\Domain\Games\Rooms;

use App\Models\GameRoom;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Live rooms shared by REBET and El Cristiano Oculto: a host opens a room, everyone joins
 * with its code from their phone, and each move is applied under a row lock so two phones
 * tapping at once never overwrite each other.
 */
class Rooms
{
    public const GAMES = ['rebet' => RebetRoom::class, 'oculto' => OcultoRoom::class];

    public const TITLES = ['rebet' => 'REBET', 'oculto' => 'El Cristiano Oculto'];

    /** Address of each game's page; its rooms live under it. */
    public const PATHS = ['rebet' => 'rebet', 'oculto' => 'el-cristiano-oculto'];

    /** Once a game is over anyone can take the group back to the room. */
    private const ENDED = ['result', 'finished'];

    private const CODE_WORDS = ['FE', 'LUZ', 'REY', 'PAZ', 'VID', 'SOL', 'MAR', 'ARCA', 'ROCA', 'MANA'];

    /** Rooms nobody touched for this long are gone. */
    private const IDLE_HOURS = 12;

    private const NAME_MAX = 24;

    public static function rules(string $game): RoomRules
    {
        return app(self::GAMES[$game]);
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array{0: GameRoom, 1: string} The room and the host's token.
     */
    public static function create(string $game, string $name, array $settings): array
    {
        if (! array_key_exists($game, self::GAMES)) {
            throw new RoomError('Ese juego no existe.');
        }
        GameRoom::query()->where('active_at', '<', now()->subDay())->delete();

        [$host, $token] = self::seat(self::cleanName($name), true);
        $room = GameRoom::query()->create([
            'game' => $game,
            'code' => self::freshCode(),
            'status' => 'lobby',
            'settings' => self::rules($game)->settings($settings),
            'players' => [$host],
            'state' => null,
            'active_at' => now(),
        ]);

        return [$room, $token];
    }

    /** An open room by its code, whatever the case it was typed in. */
    public static function find(string $code): ?GameRoom
    {
        $room = GameRoom::query()->where('code', mb_strtoupper(trim($code)))->first();

        return $room && $room->active_at?->gt(now()->subHours(self::IDLE_HOURS)) ? $room : null;
    }

    /** Seats a new player and returns their token; a code only opens rooms of the game it was typed in. */
    public static function join(string $code, string $name, ?string $game = null): string
    {
        $name = self::cleanName($name);

        return self::locked($code, function (GameRoom $room) use ($name, $game) {
            if ($game && $room->game !== $game) {
                throw new RoomError('Ese código es de una sala de '.(self::TITLES[$room->game] ?? 'otro juego').'. Entra desde ese juego.');
            }
            if ($room->status === 'closed') {
                throw new RoomError('Esta sala ya se cerró.');
            }
            if ($room->status !== 'lobby') {
                throw new RoomError('La partida ya empezó. Entra cuando vuelvan a la sala.');
            }
            $players = $room->players;
            if (count($players) >= self::rules($room->game)->maxPlayers()) {
                throw new RoomError('La sala está llena.');
            }
            if (collect($players)->contains(fn (array $player) => mb_strtolower($player['name']) === mb_strtolower($name))) {
                throw new RoomError('Ese nombre ya está en la sala. Usa otro.');
            }
            [$player, $token] = self::seat($name, false);
            $room->players = [...$players, $player];

            return $token;
        });
    }

    /**
     * Applies a move of the player holding the token.
     *
     * @param  array<string, mixed>  $input
     * @return array{0: GameRoom, 1: array<string, mixed>|null, 2: array<string, mixed>} The room, the player (null once they left) and extra data for them.
     */
    public static function act(string $code, ?string $token, string $action, array $input): array
    {
        $extra = [];
        $player = null;
        $room = self::locked($code, function (GameRoom $room) use ($token, $action, $input, &$extra, &$player) {
            $player = $room->playerByToken($token);
            if (! $player) {
                throw new RoomError('Ya no estás en esta sala.');
            }
            if ($room->status === 'closed') {
                throw new RoomError('Esta sala ya se cerró.');
            }
            $rules = self::rules($room->game);

            switch ($action) {
                case 'leave':
                    self::remove($room, $player['id']);
                    $player = null;
                    break;
                case 'kick':
                    self::hostOnly($player);
                    $target = (string) ($input['player'] ?? '');
                    if ($target === $player['id'] || ! $room->player($target)) {
                        throw new RoomError('Ese jugador ya no está en la sala.');
                    }
                    self::remove($room, $target);
                    break;
                case 'close':
                    self::hostOnly($player);
                    $room->status = 'closed';
                    break;
                case 'settings':
                    self::hostOnly($player);
                    if ($room->status !== 'lobby') {
                        throw new RoomError('Cambia los ajustes cuando vuelvan a la sala.');
                    }
                    $room->settings = $rules->settings([...$room->settings, ...$input]);
                    break;
                case 'start':
                    self::hostOnly($player);
                    if ($room->status !== 'lobby') {
                        throw new RoomError('La partida ya empezó.');
                    }
                    $rules->start($room);
                    break;
                case 'lobby':
                    if (! in_array($room->status, self::ENDED, true)) {
                        self::hostOnly($player);
                    }
                    $room->status = 'lobby';
                    $room->state = null;
                    break;
                default:
                    if ($room->status === 'lobby') {
                        throw new RoomError('La partida todavía no empezó.');
                    }
                    $extra = $rules->act($room, $player, $action, $input);
            }

            return $room;
        });

        return [$room, $player ? $room->player($player['id']) : null, $extra];
    }

    /**
     * What one player sees of the room.
     *
     * @param  array{id: string, name: string, host: bool}  $player
     * @return array<string, mixed>
     */
    public static function view(GameRoom $room, array $player): array
    {
        return [
            'code' => $room->code,
            'game' => $room->game,
            'status' => $room->status,
            'version' => $room->version,
            'settings' => $room->settings,
            'me' => ['id' => $player['id'], 'name' => $player['name'], 'host' => $player['host']],
            'players' => array_map(fn (array $seat) => ['id' => $seat['id'], 'name' => $seat['name'], 'host' => $seat['host']], $room->players),
            'max' => self::rules($room->game)->maxPlayers(),
            ...($room->status === 'closed' ? [] : self::rules($room->game)->view($room, $player)),
        ];
    }

    /**
     * @template T
     *
     * @param  callable(GameRoom): T  $change
     * @return T
     */
    private static function locked(string $code, callable $change): mixed
    {
        return DB::transaction(function () use ($code, $change) {
            $room = self::find($code);
            $room = $room ? GameRoom::query()->whereKey($room->id)->lockForUpdate()->first() : null;
            if (! $room) {
                throw new RoomError('No encontramos esa sala. Revisa el código.');
            }
            $result = $change($room);
            $room->version = $room->version + 1;
            $room->active_at = now();
            $room->save();

            return $result;
        });
    }

    private static function remove(GameRoom $room, string $playerId): void
    {
        $leaving = $room->player($playerId);
        $players = array_values(array_filter($room->players, fn (array $player) => $player['id'] !== $playerId));
        if (! $players) {
            $room->players = [];
            $room->status = 'closed';

            return;
        }
        if ($leaving['host'] ?? false) {
            $players[0]['host'] = true;
        }
        $room->players = $players;
        if ($room->status !== 'lobby') {
            self::rules($room->game)->forget($room, $playerId);
        }
    }

    /** @param  array{host: bool}  $player */
    private static function hostOnly(array $player): void
    {
        if (! $player['host']) {
            throw new RoomError('Solo quien abrió la sala puede hacer eso.');
        }
    }

    /** @return array{0: array{id: string, token: string, name: string, host: bool}, 1: string} */
    private static function seat(string $name, bool $host): array
    {
        $token = Str::random(40);

        return [['id' => 'p'.Str::lower(Str::random(9)), 'token' => hash('sha256', $token), 'name' => $name, 'host' => $host], $token];
    }

    public static function cleanName(string $name): string
    {
        $name = trim((string) preg_replace('/\s+/u', ' ', strip_tags($name)));
        if (mb_strlen($name) < 2) {
            throw new RoomError('Escribe tu nombre (al menos 2 letras).');
        }

        return mb_substr($name, 0, self::NAME_MAX);
    }

    private static function freshCode(): string
    {
        for ($attempt = 0; $attempt < 30; $attempt++) {
            $code = self::CODE_WORDS[array_rand(self::CODE_WORDS)].random_int(100, 999);
            if (! GameRoom::query()->where('code', $code)->exists()) {
                return $code;
            }
        }

        return 'SALA'.random_int(1000, 9999);
    }
}
