<?php

namespace App\Domain\Games\Rooms;

use App\Domain\Games\Oculto;
use App\Models\GameRoom;
use App\Models\OcultoCategory;
use App\Models\OcultoWord;

/**
 * El Cristiano Oculto in a live room: every phone opens its own secret card, players give
 * their clues in turn, then vote in secret. A hidden player who is not caught escapes to
 * another round with the same word, up to the rounds the host chose.
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
            'clue_rounds' => min(max((int) ($input['clue_rounds'] ?? Oculto::CLUE_PASSES), 1), 3),
            'rounds' => min(max((int) ($input['rounds'] ?? 1), 1), 8),
        ];
    }

    public function start(GameRoom $room): void
    {
        $seated = count($room->players);
        if ($seated < Oculto::MIN_PLAYERS) {
            throw new RoomError('Se necesitan al menos 3 jugadores.');
        }
        $settings = $room->settings;
        $word = Oculto::randomWord($settings['categories']);
        if (! $word) {
            throw new RoomError('No hay palabras publicadas para estos temas.');
        }
        $order = $room->playerIds();
        shuffle($order);
        $hidden = $order;
        shuffle($hidden);

        $room->state = [
            'word' => $word->id,
            'impostors' => array_slice($hidden, 0, min($settings['impostors'], Oculto::maxImpostors($seated))),
            'order' => $order,
            'rounds' => min($settings['rounds'], Oculto::maxRounds($seated)),
            'round' => 1,
            'pass' => 1,
            'turn' => 0,
            'votes' => [],
            'escaped' => null,
            'outcome' => null,
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

        if ($action === 'spoke') {
            if ($room->status !== 'clues') {
                throw new RoomError('Ya terminó la ronda de pistas.');
            }
            $speaker = $state['order'][$state['turn']] ?? null;
            if ($speaker !== $player['id'] && ! $player['host']) {
                throw new RoomError('Espera tu turno para dar la pista.');
            }
            $state['turn']++;
            if ($state['turn'] >= count($state['order'])) {
                $state['turn'] = 0;
                $state['pass']++;
                if ($state['pass'] > $room->settings['clue_rounds']) {
                    $state['votes'] = [];
                    $room->status = 'voting';
                }
            }
            $room->state = $state;

            return [];
        }

        if ($action === 'vote') {
            $target = (string) ($input['player'] ?? '');
            if ($room->status !== 'voting') {
                throw new RoomError('La votación no está abierta.');
            }
            if ($target === $player['id']) {
                throw new RoomError('No puedes votar por ti.');
            }
            if (! in_array($target, $state['order'], true)) {
                throw new RoomError('Ese jugador ya no está en la partida.');
            }
            $state['votes'][$player['id']] = $target;
            $room->state = $state;
            if (count($state['votes']) >= count($state['order'])) {
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
        $position = array_search($playerId, $state['order'], true);
        if ($position !== false) {
            array_splice($state['order'], $position, 1);
            if ($position < $state['turn']) {
                $state['turn']--;
            }
            if ($state['turn'] >= count($state['order'])) {
                $state['turn'] = 0;
            }
        }
        $state['impostors'] = array_values(array_diff($state['impostors'], [$playerId]));
        unset($state['votes'][$playerId]);
        $state['votes'] = array_filter($state['votes'], fn (string $target) => $target !== $playerId);
        $room->state = $state;

        if (in_array($room->status, ['clues', 'voting'], true) && (count($state['order']) < Oculto::MIN_PLAYERS || ! $state['impostors'])) {
            $room->status = 'lobby';
            $room->state = ['notice' => 'La partida se detuvo porque alguien salió. Vuelvan a empezar cuando estén listos.'];

            return;
        }
        if ($room->status === 'voting' && $state['order'] && count($state['votes']) >= count($state['order'])) {
            $this->resolve($room);
        }
    }

    public function view(GameRoom $room, array $player): array
    {
        $state = $room->state;
        if ($room->status === 'lobby' || ! $state || ! isset($state['word'])) {
            return ['notice' => $state['notice'] ?? null];
        }
        $word = OcultoWord::query()->with('category')->find($state['word']);
        $hidden = in_array($player['id'], $state['impostors'], true);
        $ended = $room->status === 'result';
        $names = fn (array $ids) => array_values(array_filter(array_map(fn (string $id) => $room->nameOf($id), $ids)));

        return [
            'card' => $hidden && ! $ended
                ? ['impostor' => true, 'category' => $word?->category?->name]
                : ['impostor' => $hidden, ...($word?->card() ?? [])],
            'round' => $state['round'],
            'rounds' => $state['rounds'],
            'pass' => min($state['pass'], $room->settings['clue_rounds']),
            'order' => $state['order'],
            'speaker' => $room->status === 'clues' ? ($state['order'][$state['turn']] ?? null) : null,
            'voted' => array_keys($state['votes']),
            'my_vote' => $state['votes'][$player['id']] ?? null,
            'escaped' => $state['escaped'] ? [...$state['escaped'], 'top' => $room->nameOf($state['escaped']['top'])] : null,
            'outcome' => $ended ? [
                ...$state['outcome'],
                'top' => $room->nameOf($state['outcome']['top']),
                'impostors' => $names($state['impostors']),
                'tally' => collect($state['outcome']['tally'])->map(fn (int $votes, string $id) => ['name' => $room->nameOf($id), 'votes' => $votes])->filter(fn (array $row) => $row['name'])->values()->all(),
            ] : null,
        ];
    }

    private function resolve(GameRoom $room): void
    {
        $state = $room->state;
        $result = Oculto::tally($state['votes'], $state['impostors']);
        if (! $result['caught'] && $state['round'] < $state['rounds']) {
            $state['escaped'] = ['round' => $state['round'], 'top' => $result['top']];
            $state['round']++;
            $state['pass'] = 1;
            $state['turn'] = 0;
            $state['votes'] = [];
            $room->state = $state;
            $room->status = 'clues';

            return;
        }
        $state['outcome'] = ['caught' => $result['caught'], 'top' => $result['top'], 'tally' => $result['tally']];
        $room->state = $state;
        $room->status = 'result';
    }
}
