<?php

namespace Tests\Feature;

use App\Domain\Games\Oculto;
use App\Models\GameRoom;
use App\Models\LingoExercise;
use App\Models\LingoPath;
use App\Models\OcultoWord;
use App\Models\RebetQuestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GamesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_three_games_arrive_with_all_their_content(): void
    {
        $this->assertSame(228, RebetQuestion::query()->count());
        $this->assertSame(637, LingoExercise::query()->count());
        $this->assertSame(1122, OcultoWord::query()->count());
        $this->assertSame(969, OcultoWord::query()->where('active', true)->count());

        $this->get('/juegos')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Games/Index')
            ->where('stats.rebet', 228)
            ->where('stats.oculto', 969));
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

    public function test_the_hidden_player_never_sees_the_word_and_is_caught_in_the_first_vote(): void
    {
        [$code, $byId, $room] = $this->ocultoRoom(['Brayan', 'Kiara', 'Yolanda'], ['level' => 'intermedio']);
        $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'Tarde'])->assertStatus(422);
        $hiddenId = $room->state['impostors'][0];
        $word = OcultoWord::query()->findOrFail($room->state['word']);
        $this->assertSame('intermedio', $word->level);
        $this->assertSame(2, $room->state['rounds']);

        $hiddenView = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$hiddenId]])->json();
        $this->assertTrue($hiddenView['card']['impostor']);
        $this->assertStringNotContainsString($word->word, json_encode($hiddenView, JSON_UNESCAPED_UNICODE));
        $order = $room->state['order'];
        $faithfulId = collect($order)->first(fn (string $id) => $id !== $hiddenId);
        $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$faithfulId]])->assertJsonPath('card.word', $word->word);

        $notFirst = $order[1] === $room->players[0]['id'] ? $order[2] : $order[1];
        $this->postJson("/juegos/salas/{$code}", ['action' => 'spoke'], ['X-Game-Token' => $byId[$notFirst]])->assertStatus(422);
        $this->giveClues($code, $byId, $order);
        $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$faithfulId]])->assertJson(['status' => 'voting']);
        $this->postJson("/juegos/salas/{$code}", ['action' => 'lobby'], ['X-Game-Token' => $byId[$faithfulId]])->assertStatus(422);

        $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $hiddenId], ['X-Game-Token' => $byId[$hiddenId]])->assertStatus(422);
        $this->vote($code, $byId, $order, fn (string $voter) => $voter === $hiddenId ? $faithfulId : $hiddenId);

        $result = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$hiddenId]])->assertJson(['status' => 'result'])->json();
        $this->assertSame('group', $result['outcome']['winner']);
        $this->assertSame($word->word, $result['card']['word']);
        $this->assertSame([['id' => $hiddenId, 'name' => $room->nameOf($hiddenId)]], $result['outcome']['impostors']);
        $this->assertSame($hiddenId, $result['outcome']['history'][0]['out']);
        $this->assertTrue($result['outcome']['history'][0]['hidden']);

        $this->postJson("/juegos/salas/{$code}", ['action' => 'lobby'], ['X-Game-Token' => $byId[$faithfulId]])->assertOk()->assertJson(['status' => 'lobby']);
    }

    public function test_a_wrong_vote_sends_that_player_out_and_the_game_goes_to_the_next_round(): void
    {
        [$code, $byId, $room] = $this->ocultoRoom(['Brayan', 'Kiara', 'Yolanda']);
        $order = $room->state['order'];
        $hiddenId = $room->state['impostors'][0];
        [$first, $second] = array_values(array_diff($order, [$hiddenId]));

        $this->giveClues($code, $byId, $order);
        $this->vote($code, $byId, $order, fn (string $voter) => $voter === $first ? $hiddenId : $first);

        $reveal = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$second]])->assertJson(['status' => 'reveal', 'round' => 1])->json();
        $this->assertSame($first, $reveal['last']['out']);
        $this->assertFalse($reveal['last']['hidden']);
        $this->assertNotContains($first, $reveal['alive']);

        $this->postJson("/juegos/salas/{$code}", ['action' => 'continue', 'round' => 1], ['X-Game-Token' => $byId[$second]])->assertOk()->assertJson(['status' => 'clues', 'round' => 2]);
        $this->postJson("/juegos/salas/{$code}", ['action' => 'continue', 'round' => 1], ['X-Game-Token' => $byId[$hiddenId]])->assertOk()->assertJson(['round' => 2]);

        $alive = array_values(array_diff($order, [$first]));
        $this->giveClues($code, $byId, $alive);
        $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $hiddenId], ['X-Game-Token' => $byId[$first]])->assertStatus(422);
        $this->vote($code, $byId, $alive, fn (string $voter) => $voter === $second ? $hiddenId : $second);

        $result = $this->getJson("/juegos/salas/{$code}", ['X-Game-Token' => $byId[$first]])->assertJson(['status' => 'result'])->json();
        $this->assertSame('hidden', $result['outcome']['winner']);
        $this->assertCount(2, $result['outcome']['history']);
        $this->assertSame(1, Oculto::maxRounds(3));
    }

    public function test_a_room_code_only_opens_rooms_of_its_own_game(): void
    {
        $code = $this->postJson('/juegos/salas', ['game' => 'rebet', 'name' => 'Pastor Luis'])->json('code');

        $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'Ana', 'game' => 'oculto'])->assertStatus(422)->assertJsonFragment(['error' => 'Ese código es de una sala de REBET. Entra desde ese juego.']);
        $this->postJson("/juegos/salas/{$code}/entrar", ['name' => 'Ana', 'game' => 'rebet'])->assertOk();

        $this->get("/juegos/el-cristiano-oculto/sala/{$code}")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Games/Room')->where('game', 'oculto')->where('found', false)->where('elsewhere', 'rebet'));
        $this->get("/juegos/rebet/sala/{$code}")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('found', true)->where('joinable', true));
        $this->get("/juegos/sala/{$code}")->assertRedirect("/juegos/rebet/sala/{$code}");
    }

    public function test_each_oculto_level_deals_its_own_words(): void
    {
        $this->assertSame('intermedio', OcultoWord::query()->where('word', 'Moisés')->value('level'));
        $this->assertSame('dificil', OcultoWord::query()->where('word', 'Abed-nego')->value('level'));
        $this->assertSame('intermedio', OcultoWord::query()->where('word', 'Los Diez Mandamientos')->value('level'));

        foreach (['intermedio', 'dificil'] as $level) {
            for ($i = 0; $i < 5; $i++) {
                $this->getJson("/juegos/el-cristiano-oculto/palabra?nivel={$level}")->assertOk()->assertJsonPath('word.level', $level);
            }
        }
        $this->get('/juegos/el-cristiano-oculto')->assertInertia(fn (AssertableInertia $page) => $page->has('themes.0.levels.intermedio'));
    }

    /**
     * Opens a started El Cristiano Oculto room with Fiorella as host.
     *
     * @param  list<string>  $guests
     * @param  array<string, mixed>  $settings
     * @return array{0: string, 1: Collection<string, string>, 2: GameRoom}
     */
    private function ocultoRoom(array $guests, array $settings = []): array
    {
        $host = $this->postJson('/juegos/salas', ['game' => 'oculto', 'name' => 'Fiorella', 'settings' => $settings])->assertOk()->json();
        $tokens = ['Fiorella' => $host['token']];
        foreach ($guests as $name) {
            $tokens[$name] = $this->postJson("/juegos/salas/{$host['code']}/entrar", ['name' => $name, 'game' => 'oculto'])->assertOk()->json('token');
        }
        $this->postJson("/juegos/salas/{$host['code']}", ['action' => 'start'], ['X-Game-Token' => $host['token']])->assertOk()->assertJson(['status' => 'clues']);
        $room = GameRoom::query()->where('code', $host['code'])->firstOrFail();

        return [$host['code'], collect($room->players)->mapWithKeys(fn (array $player) => [$player['id'] => $tokens[$player['name']]]), $room];
    }

    /** @param  list<string>  $speakers */
    private function giveClues(string $code, Collection $byId, array $speakers): void
    {
        foreach ($speakers as $id) {
            $this->postJson("/juegos/salas/{$code}", ['action' => 'spoke'], ['X-Game-Token' => $byId[$id]])->assertOk();
        }
    }

    /**
     * @param  list<string>  $voters
     * @param  callable(string): string  $choice
     */
    private function vote(string $code, Collection $byId, array $voters, callable $choice): void
    {
        foreach ($voters as $id) {
            $this->postJson("/juegos/salas/{$code}", ['action' => 'vote', 'player' => $choice($id)], ['X-Game-Token' => $byId[$id]])->assertOk();
        }
    }
}
