<?php

namespace App\Domain\Games\Rooms;

use App\Models\GameRoom;

/** What a game adds to a live room: its settings, how it starts, its moves and what each player sees. */
interface RoomRules
{
    public function maxPlayers(): int;

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function settings(array $input): array;

    public function start(GameRoom $room): void;

    /**
     * Applies a move of a player while the game runs.
     *
     * @param  array{id: string, name: string, host: bool}  $player
     * @param  array<string, mixed>  $input
     * @return array<string, mixed> Extra data for the player who moved.
     */
    public function act(GameRoom $room, array $player, string $action, array $input): array;

    /** Keeps a running game consistent after a player leaves. */
    public function forget(GameRoom $room, string $playerId): void;

    /**
     * @param  array{id: string, name: string, host: bool}  $player
     * @return array<string, mixed>
     */
    public function view(GameRoom $room, array $player): array;
}
