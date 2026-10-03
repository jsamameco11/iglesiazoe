<?php

namespace Tests\Feature;

use App\Models\GameRoom;
use App\Models\LingoExercise;
use App\Models\LingoPath;
use App\Models\OcultoWord;
use App\Models\RebetQuestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GamesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_three_games_arrive_with_all_their_content(): void
    {
        $this->assertSame(228, RebetQuestion::query()->count());
        $this->assertSame(637, LingoExercise::query()->count());
        $this->assertSame(1100, OcultoWord::query()->count());
        $this->assertSame(947, OcultoWord::query()->where('active', true)->count());

        $this->get('/juegos')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Games/Index')
            ->where('stats.rebet', 228)
            ->where('stats.oculto', 947));
    }

    public function test_game_pages_never_send_the_answers_ahead(): void
    {
        $this->get('/juegos/rebet')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Games/Rebet')->has('themes', 37));

        $questions = $this->getJson('/juegos/rebet/preguntas?cantidad=5&dificultad=hard')->assertOk()->json('questions');
        $this->assertCount(5, $questions);
        $this->assertArrayNotHasKey('correct', $questions[0]);
        $this->assertCount(4, $questions[0]['options']);

        $path = LingoPath::query()->where('slug', 'la-salvacion')->firstOrFail();
        $lesson = $path->units()->first()->lessons()->first();
        $this->get('/juegos/lingobible/conociendo-la-biblia')->assertNotFound();
        $this->get("/juegos/lingobible/{$path->slug}/{$lesson->id}")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Games/LingoLesson')
            ->where('lesson.id', $lesson->id)
            ->missing('lesson.exercises.0.answer'));
    }

    public function test_rebet_rewards_right_and_fast_answers_only(): void
    {
        $question = RebetQuestion::query()->where('difficulty', 'expert')->firstOrFail();
        $wrong = ($question->correct + 1) % 4;

        $fast = $this->postJson('/juegos/rebet/responder', ['question' => $question->id, 'choice' => $question->correct, 'seconds' => 0, 'streak' => 2])->assertOk();
        $fast->assertJson(['correct' => true, 'right' => $question->correct, 'points' => (int) round((1000 + 500 + 100) * 2)]);

        $this->postJson('/juegos/rebet/responder', ['question' => $question->id, 'choice' => $wrong, 'seconds' => 1])->assertJson(['correct' => false, 'points' => 0]);
        $this->postJson('/juegos/rebet/responder', ['question' => $question->id, 'choice' => $question->correct, 'seconds' => 90])->assertJson(['correct' => false, 'points' => 0, 'late' => true]);
    }

    public function test_lingobible_grades_choices_and_true_or_false(): void
    {
        $choice = LingoExercise::query()->where('kind', 'choice')->firstOrFail();
        $this->postJson('/juegos/lingobible/responder', ['exercise' => $choice->id, 'choice' => $choice->answer])->assertJson(['correct' => true]);

        $truth = LingoExercise::query()->where('kind', 'truefalse')->where('answer', 0)->firstOrFail();
        $this->postJson('/juegos/lingobible/responder', ['exercise' => $truth->id, 'choice' => 0])->assertJson(['correct' => false, 'right' => 1]);
        $this->postJson('/juegos/lingobible/responder', ['exercise' => $truth->id, 'choice' => 1])->assertJson(['correct' => true]);
    }

    public function test_a_rebet_room_times_every_answer_and_finishes_when_everyone_is_done(): void
    {
        $host = $this->postJson('/juegos/salas', ['game' => 'rebet', 'name' => 'Pastor Luis', 'settings' => ['count' => 5]])->assertOk()->json();
        $code = $host['code'];
        $this->postJson("/juegos/salas/{$code}", ['action' => 'start'], ['X-Game-Token' => $host['token']])->assertStatus(422);

        $guest = $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'Ana'])->assertOk()->json('token');
        $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'ana'])->assertStatus(422);
        $this->postJson("/juegos/salas/{$code}", ['action' => 'start'], ['X-Game-Token' => $guest])->assertStatus(422);
        $this->postJson("/juegos/salas/{$code}", ['action' => 'start'], ['X-Game-Token' => $host['token']])->assertOk()->assertJson(['status' => 'playing', 'total' => 5]);

        foreach ([$host['token'] => true, $guest => false] as $token => $alwaysRight) {
            for ($i = 0; $i < 5; $i++) {
                $question = $this->postJson("/juegos/salas/{$code}", ['action' => 'next'], ['X-Game-Token' => $token])->assertOk()->json('mine.question');
                $this->assertArrayNotHasKey('correct', $question);
                $right = RebetQuestion::query()->findOrFail($question['id'])->correct;
                $reply = $this->postJson("/juegos/salas/{$code}", ['action' => 'answer', 'question' => $question['id'], 'choice' => $alwaysRight ? $right : ($right + 1) % 4], ['X-Game-Token' => $token])->assertOk();
                $reply->assertJsonPath('result.correct', $alwaysRight);
                $this->postJson("/juegos/salas/{$code}", ['action' => 'answer', 'question' => $question['id'], 'choice' => $right], ['X-Game-Token' => $token])->assertStatus(422);
            }
        }

        $board = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $guest])->assertOk()->assertJson(['status' => 'finished'])->json('board');
        $this->assertSame('Pastor Luis', $board[0]['name']);
        $this->assertSame(5, $board[0]['correct']);
        $this->assertGreaterThan(5000, $board[0]['score']);
        $this->assertSame(0, $board[1]['score']);
        $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => 'not-a-real-token-at-all-000'])->assertForbidden();
    }

    public function test_the_hidden_player_never_sees_the_word_and_is_caught_by_the_vote(): void
    {
        $host = $this->postJson('/juegos/salas', ['game' => 'oculto', 'name' => 'Fiorella', 'settings' => ['clue_rounds' => 1]])->assertOk()->json();
        $code = $host['code'];
        $tokens = ['Fiorella' => $host['token']];
        foreach (['Brayan', 'Kiara', 'Yolanda'] as $name) {
            $tokens[$name] = $this->postJson("/juegos/salas/{$code}/entrar", ['name' => $name])->assertOk()->json('token');
        }
        $this->postJson("/juegos/salas/{$code}", ['action' => 'start'], ['X-Game-Token' => $host['token']])->assertOk()->assertJson(['status' => 'clues']);
        $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'Tarde'])->assertStatus(422);

        $room = GameRoom::query()->where('code', $code)->firstOrFail();
        $byId = collect($room->players)->mapWithKeys(fn (array $player) => [$player['id'] => $tokens[$player['name']]]);
        $hiddenId = $room->state['impostors'][0];
        $word = OcultoWord::query()->findOrFail($room->state['word'])->word;

        $hiddenView = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$hiddenId]])->json();
        $this->assertTrue($hiddenView['card']['impostor']);
        $this->assertStringNotContainsString($word, json_encode($hiddenView, JSON_UNESCAPED_UNICODE));
        $faithfulId = collect($room->state['order'])->first(fn (string $id) => $id !== $hiddenId);
        $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$faithfulId]])->assertJsonPath('card.word', $word);

        $order = $room->state['order'];
        $notFirst = $order[1] === $room->players[0]['id'] ? $order[2] : $order[1];
        $this->postJson("/juegos/salas/{$code}", ['action' => 'spoke'], ['X-Game-Token' => $byId[$notFirst]])->assertStatus(422);
        foreach ($order as $id) {
            $this->postJson("/juegos/salas/{$code}", ['action' => 'spoke'], ['X-Game-Token' => $byId[$id]])->assertOk();
        }
        $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $host['token']])->assertJson(['status' => 'voting']);

        $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $hiddenId], ['X-Game-Token' => $byId[$hiddenId]])->assertStatus(422);
        $faithfulTarget = $faithfulId;
        foreach ($order as $id) {
            $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $id === $hiddenId ? $faithfulTarget : $hiddenId], ['X-Game-Token' => $byId[$id]])->assertOk();
        }

        $result = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$hiddenId]])->assertJson(['status' => 'result'])->json();
        $this->assertTrue($result['outcome']['caught']);
        $this->assertSame($word, $result['card']['word']);
        $this->assertCount(1, $result['outcome']['impostors']);
    }

    public function test_an_uncaught_hidden_player_escapes_to_another_round_with_the_same_word(): void
    {
        $host = $this->postJson('/juegos/salas', ['game' => 'oculto', 'name' => 'Fiorella', 'settings' => ['clue_rounds' => 1, 'rounds' => 2]])->json();
        $code = $host['code'];
        $tokens = ['Fiorella' => $host['token']];
        foreach (['Brayan', 'Kiara', 'Yolanda'] as $name) {
            $tokens[$name] = $this->postJson("/juegos/salas/{$code}/entrar", ['name' => $name])->json('token');
        }
        $this->postJson("/juegos/salas/{$code}", ['action' => 'start'], ['X-Game-Token' => $host['token']])->assertOk();
        $room = GameRoom::query()->where('code', $code)->firstOrFail();
        $byId = collect($room->players)->mapWithKeys(fn (array $player) => [$player['id'] => $tokens[$player['name']]]);
        $order = $room->state['order'];
        $hiddenId = $room->state['impostors'][0];
        $innocent = collect($order)->first(fn (string $id) => $id !== $hiddenId);

        foreach ($order as $id) {
            $this->postJson("/juegos/salas/{$code}", ['action' => 'spoke'], ['X-Game-Token' => $byId[$id]]);
        }
        foreach ($order as $id) {
            $target = $id === $innocent ? $hiddenId : $innocent;
            $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $target], ['X-Game-Token' => $byId[$id]])->assertOk();
        }

        $room->refresh();
        $this->assertSame('clues', $room->status);
        $this->assertSame(2, $room->state['round']);
        $this->assertSame($innocent, $room->state['escaped']['top']);
    }
}
