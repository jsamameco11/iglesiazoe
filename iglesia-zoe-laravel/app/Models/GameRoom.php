<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

/**
 * A live game room people join with a short code from their own phones. Players have no
 * account: each one holds a secret token and the room keeps only its hash.
 *
 * @property list<array{id: string, token: string, name: string, host: bool}> $players
 */
class GameRoom extends UuidModel
{
    protected $fillable = ['game', 'code', 'status', 'settings', 'players', 'state', 'version', 'active_at'];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'players' => 'array',
            'state' => 'array',
            'version' => 'integer',
            'active_at' => 'datetime',
        ];
    }

    /** @return array{id: string, token: string, name: string, host: bool}|null */
    public function playerByToken(?string $token): ?array
    {
        if (! is_string($token) || strlen($token) < 20) {
            return null;
        }
        $hash = hash('sha256', $token);
        foreach ($this->players ?? [] as $player) {
            if (hash_equals($player['token'], $hash)) {
                return $player;
            }
        }

        return null;
    }

    /** @return array{id: string, token: string, name: string, host: bool}|null */
    public function player(string $id): ?array
    {
        return collect($this->players ?? [])->firstWhere('id', $id);
    }

    public function nameOf(?string $id): ?string
    {
        return $id === null ? null : $this->player($id)['name'] ?? null;
    }

    /** @return list<string> */
    public function playerIds(): array
    {
        return array_column($this->players ?? [], 'id');
    }
}
