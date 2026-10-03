<?php

namespace App\Domain\Games\Rooms;

use App\Domain\Games\Rebet;
use App\Models\GameRoom;
use App\Models\RebetCategory;
use App\Models\RebetQuestion;

/**
 * REBET in a live room: everyone answers the same questions on their own phone at their
 * own pace, the server times each answer, and the scoreboard updates as they play.
 */
class RebetRoom implements RoomRules
{
    public function maxPlayers(): int
    {
        return 30;
    }

    public function settings(array $input): array
    {
        $difficulty = (string) ($input['difficulty'] ?? 'mixed');
        $count = (int) ($input['count'] ?? 10);
        $themes = array_values(array_filter((array) ($input['categories'] ?? []), 'is_string'));

        return [
            'categories' => RebetCategory::query()->where('active', true)->whereIn('id', $themes)->pluck('id')->all(),
            'difficulty' => array_key_exists($difficulty, RebetQuestion::DIFFICULTIES) ? $difficulty : 'mixed',
            'count' => in_array($count, Rebet::COUNTS, true) ? $count : 10,
        ];
    }

    public function start(GameRoom $room): void
    {
        if (count($room->players) < 2) {
            throw new RoomError('Espera a que entre al menos una persona más.');
        }
        $settings = $room->settings;
        $questions = Rebet::pick($settings['categories'], $settings['difficulty'], $settings['count'])->pluck('id')->all();
        if (! $questions) {
            throw new RoomError('No hay preguntas publicadas para empezar.');
        }

        $room->state = [
            'questions' => $questions,
            'progress' => collect($room->playerIds())->mapWithKeys(fn (string $id) => [$id => $this->fresh()])->all(),
        ];
        $room->status = 'playing';
    }

    public function act(GameRoom $room, array $player, string $action, array $input): array
    {
        $state = $room->state;
        $mine = $state['progress'][$player['id']] ?? null;

        if ($action === 'finish') {
            if (! $player['host']) {
                throw new RoomError('Solo quien abrió la sala puede terminar la partida.');
            }
            $room->status = 'finished';

            return [];
        }
        if ($room->status !== 'playing' || ! $mine) {
            throw new RoomError('La partida ya terminó.');
        }
        $total = count($state['questions']);

        if ($action === 'next') {
            if ($mine['index'] >= 0 && ! $mine['answered']) {
                return [];
            }
            if ($total <= $mine['index'] + 1) {
                throw new RoomError('Ya respondiste todas las preguntas.');
            }
            $mine = [...$mine, 'index' => $mine['index'] + 1, 'asked' => microtime(true), 'answered' => false];
            $state['progress'][$player['id']] = $mine;
            $room->state = $state;

            return [];
        }

        if ($action === 'answer') {
            $questionId = $state['questions'][$mine['index']] ?? null;
            if ($mine['index'] < 0 || $mine['answered'] || $questionId !== ($input['question'] ?? null)) {
                throw new RoomError('Esa pregunta ya se respondió.');
            }
            $question = RebetQuestion::query()->find($questionId);
            if (! $question) {
                throw new RoomError('Esa pregunta ya no existe.');
            }
            $result = Rebet::grade($question, (int) ($input['choice'] ?? -1), microtime(true) - (float) $mine['asked'], $mine['streak']);
            $streak = $result['correct'] ? $mine['streak'] + 1 : 0;
            $state['progress'][$player['id']] = [
                ...$mine,
                'answered' => true,
                'score' => $mine['score'] + $result['points'],
                'correct' => $mine['correct'] + ($result['correct'] ? 1 : 0),
                'streak' => $streak,
                'best' => max($mine['best'], $streak),
            ];
            $room->state = $state;
            $this->finishWhenEveryoneIsDone($room);

            return ['result' => $result];
        }

        throw new RoomError('Esa jugada no existe.');
    }

    public function forget(GameRoom $room, string $playerId): void
    {
        $state = $room->state;
        unset($state['progress'][$playerId]);
        $room->state = $state;
        if ($room->status === 'playing') {
            $this->finishWhenEveryoneIsDone($room);
        }
    }

    public function view(GameRoom $room, array $player): array
    {
        $state = $room->state;
        if (! $state || $room->status === 'lobby') {
            return [];
        }
        $total = count($state['questions']);
        $mine = $state['progress'][$player['id']] ?? null;
        $current = null;
        if ($mine && $room->status === 'playing' && $mine['index'] >= 0 && ! $mine['answered']) {
            $question = RebetQuestion::query()->with('category')->find($state['questions'][$mine['index']]);
            $current = $question ? [...$question->card(), 'elapsed' => round(microtime(true) - (float) $mine['asked'], 2)] : null;
        }

        return [
            'total' => $total,
            'mine' => $mine ? [
                'index' => $mine['index'],
                'answered' => $mine['answered'],
                'score' => $mine['score'],
                'correct' => $mine['correct'],
                'streak' => $mine['streak'],
                'best' => $mine['best'],
                'done' => $this->isDone($mine, $total),
                'question' => $current,
            ] : null,
            'board' => collect($state['progress'])
                ->map(fn (array $progress, string $id) => [
                    'id' => $id,
                    'name' => $room->nameOf($id),
                    'score' => $progress['score'],
                    'correct' => $progress['correct'],
                    'answered' => $progress['index'] + ($progress['answered'] && $progress['index'] >= 0 ? 1 : 0),
                    'done' => $this->isDone($progress, $total),
                ])
                ->filter(fn (array $row) => $row['name'] !== null)
                ->sortByDesc('score')->values()->all(),
        ];
    }

    private function finishWhenEveryoneIsDone(GameRoom $room): void
    {
        $total = count($room->state['questions']);
        $progress = $room->state['progress'];
        if ($progress && collect($progress)->every(fn (array $mine) => $this->isDone($mine, $total))) {
            $room->status = 'finished';
        }
    }

    /** @param  array{index: int, answered: bool}  $mine */
    private function isDone(array $mine, int $total): bool
    {
        return $mine['index'] === $total - 1 && $mine['answered'];
    }

    /** @return array{index: int, asked: ?float, answered: bool, score: int, correct: int, streak: int, best: int} */
    private function fresh(): array
    {
        return ['index' => -1, 'asked' => null, 'answered' => true, 'score' => 0, 'correct' => 0, 'streak' => 0, 'best' => 0];
    }
}
