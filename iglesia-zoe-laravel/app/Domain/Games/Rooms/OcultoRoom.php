<?php

namespace App\Domain\Games\Rooms;

use App\Domain\Games\Oculto;
use App\Models\GameRoom;
use App\Models\OcultoCategory;
use App\Models\OcultoWord;

/**
 * El Cristiano Oculto in a live room: every phone opens its own secret card, each player
 * still in the game gives one clue per round and then everyone votes from their phone.
 * The most voted player is out; the game goes on to the next round until the hidden
 * players are found or the rounds for that many players run out.
 */
class OcultoRoom implements RoomRules
{
    public function maxPlayers(): int
    {
        return 15;
    }

    public function settings(array $input): array
    {
        $themes = array_values(array_filter((array) ($input['categories'] ?? []), 'is_string'));

        return [
            'categories' => OcultoCategory::query()->where('active', true)->whereIn('id', $themes)->pluck('id')->all(),
            'impostors' => min(max((int) ($input['impostors'] ?? 1), 1), 2),
            'level' => Oculto::level($input['level'] ?? null) ?? Oculto::DEFAULT_LEVEL,
        ];
    }

    public function start(GameRoom $room): void
    {
        $seated = count($room->players);
        if ($seated < Oculto::MIN_PLAYERS) {
            throw new RoomError('Se necesitan al menos 3 jugadores.');
        }
        $settings = $room->settings;
        $word = Oculto::randomWord($settings['categories'] ?? [], $settings['level'] ?? Oculto::DEFAULT_LEVEL);
        if (! $word) {
            throw new RoomError('No hay palabras de este nivel para los temas elegidos. Elige otros temas.');
        }
        $order = $room->playerIds();
        shuffle($order);
        $hidden = $order;
        shuffle($hidden);

        $room->state = [
            'word' => $word->id,
            'impostors' => array_slice($hidden, 0, min($settings['impostors'] ?? 1, Oculto::maxImpostors($seated))),
            'names' => collect($room->players)->mapWithKeys(fn (array $player) => [$player['id'] => $player['name']])->all(),
            'order' => $order,
            'alive' => $order,
            'rounds' => Oculto::maxRounds($seated),
            'round' => 1,
            'turn' => 0,
            'votes' => [],
            'history' => [],
            'winner' => null,
        ];
        $room->status = 'clues';
    }

    public function act(GameRoom $room, array $player, string $action, array $input): array
    {
        $state = $room->state;

        if ($action === 'again') {
            if (! $player['host']) {
                throw new RoomError('Solo quien abrió la sala puede empezar otra partida.');
            }
            $this->start($room);

            return [];
        }

        if ($action === 'continue') {
            if ($room->status === 'reveal' && (int) ($input['round'] ?? $state['round']) === $state['round']) {
                $state['round']++;
                $state['turn'] = 0;
                $state['votes'] = [];
                $room->state = $state;
                $room->status = 'clues';
            }

            return [];
        }

        if ($action === 'spoke') {
            if ($room->status !== 'clues') {
                throw new RoomError('Ya terminó la ronda de pistas.');
            }
            $speaker = $state['alive'][$state['turn']] ?? null;
            if ($speaker !== $player['id'] && ! $player['host']) {
                throw new RoomError('Espera tu turno para dar la pista.');
            }
            $state['turn']++;
            $room->state = $state;
            $this->closeClues($room);

            return [];
        }

        if ($action === 'vote') {
            $target = (string) ($input['player'] ?? '');
            if ($room->status !== 'voting') {
                throw new RoomError('La votación no está abierta.');
            }
            if (! in_array($player['id'], $state['alive'], true)) {
                throw new RoomError('Ya saliste de esta partida; ahora solo miras.');
            }
            if ($target === $player['id']) {
                throw new RoomError('No puedes votar por ti.');
            }
            if (! in_array($target, $state['alive'], true)) {
                throw new RoomError('Ese jugador ya no está en la partida.');
            }
            $state['votes'][$player['id']] = $target;
            $room->state = $state;
            if (count($state['votes']) >= count($state['alive'])) {
                $this->resolve($room);
            }

            return [];
        }

        if ($action === 'reveal') {
            if (! $player['host']) {
                throw new RoomError('Solo quien abrió la sala puede cerrar la votación.');
            }
            if ($room->status !== 'voting' || ! $state['votes']) {
                throw new RoomError('Todavía no hay votos.');
            }
            $this->resolve($room);

            return [];
        }

        throw new RoomError('Esa jugada no existe.');
    }

    public function forget(GameRoom $room, string $playerId): void
    {
        $state = $room->state;
        if (! isset($state['alive'])) {
            return;
        }
        $position = array_search($playerId, $state['alive'], true);
        if ($position !== false) {
            array_splice($state['alive'], $position, 1);
            if ($position < $state['turn']) {
                $state['turn']--;
            }
        }
        $state['order'] = array_values(array_diff($state['order'], [$playerId]));
        unset($state['votes'][$playerId]);
        $state['votes'] = array_filter($state['votes'], fn (string $target) => $target !== $playerId);
        $room->state = $state;

        if ($room->status === 'result') {
            return;
        }
        if (count($state['alive']) < 2 || ! array_intersect($state['impostors'], $state['alive'])) {
            $room->status = 'lobby';
            $room->state = ['notice' => 'La partida se detuvo porque alguien salió. Vuelvan a empezar cuando estén listos.'];

            return;
        }
        if ($room->status === 'clues') {
            $this->closeClues($room);
        } elseif ($room->status === 'voting' && count($state['votes']) >= count($state['alive'])) {
            $this->resolve($room);
        }
    }

    public function view(GameRoom $room, array $player): array
    {
        $state = $room->state;
        if ($room->status === 'lobby' || ! isset($state['word'], $state['alive'])) {
            return ['notice' => $state['notice'] ?? null];
        }
        $word = OcultoWord::query()->with('category')->find($state['word']);
        $hidden = in_array($player['id'], $state['impostors'], true);
        $ended = $room->status === 'result';
        $name = fn (?string $id) => $id ? ($state['names'][$id] ?? $room->nameOf($id)) : null;
        $round = fn (array $entry) => [
            'round' => $entry['round'],
            'out' => $entry['out'],
            'name' => $name($entry['out']),
            'hidden' => $entry['hidden'],
            'tally' => collect($entry['tally'])->map(fn (int $votes, string $id) => ['id' => $id, 'name' => $name($id), 'votes' => $votes])->values()->all(),
        ];

        return [
            'card' => $hidden && ! $ended
                ? ['impostor' => true, 'category' => $word?->category?->name, 'level' => $word?->level]
                : ['impostor' => $hidden, ...($word?->card() ?? [])],
            'round' => $state['round'],
            'rounds' => $state['rounds'],
            'order' => $state['order'],
            'alive' => $state['alive'],
            'speaker' => $room->status === 'clues' ? ($state['alive'][$state['turn']] ?? null) : null,
            'voted' => array_keys($state['votes']),
            'my_vote' => $state['votes'][$player['id']] ?? null,
            'last' => $state['history'] ? $round(end($state['history'])) : null,
            'outcome' => $ended ? [
                'winner' => $state['winner'],
                'impostors' => array_map(fn (string $id) => ['id' => $id, 'name' => $name($id)], $state['impostors']),
                'history' => array_map($round, $state['history']),
            ] : null,
        ];
    }

    /** Once everyone still in the game has spoken, the vote opens. */
    private function closeClues(GameRoom $room): void
    {
        $state = $room->state;
        if ($state['turn'] >= count($state['alive'])) {
            $state['turn'] = 0;
            $state['votes'] = [];
            $room->state = $state;
            $room->status = 'voting';
        }
    }

    private function resolve(GameRoom $room): void
    {
        $state = $room->state;
        $result = Oculto::tally($state['votes']);
        $out = $result['out'];
        if ($out !== null) {
            $state['alive'] = array_values(array_diff($state['alive'], [$out]));
        }
        $state['history'][] = [
            'round' => $state['round'],
            'out' => $out,
            'hidden' => $out !== null && in_array($out, $state['impostors'], true),
            'tally' => $result['tally'],
        ];
        $state['votes'] = [];
        $state['winner'] = Oculto::winner($state['alive'], array_values(array_intersect($state['impostors'], $state['alive'])), $state['round'], $state['rounds']);
        $room->state = $state;
        $room->status = $state['winner'] ? 'result' : 'reveal';
    }
}
