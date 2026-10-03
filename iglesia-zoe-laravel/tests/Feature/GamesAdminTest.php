<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\LingoExercise;
use App\Models\LingoLesson;
use App\Models\LingoPath;
use App\Models\OcultoCategory;
use App\Models\OcultoWord;
use App\Models\RebetCategory;
use App\Models\RebetQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class GamesAdminTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    public function test_only_game_managers_open_the_games_panel(): void
    {
        $this->assertContains('games.manage', Permissions::forTypes(['visuales']));

        $this->actingAs($this->admin('marisol', ['visuales']))->get(self::ADMIN.'/admin/juegos')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Juegos/Rebet')
                ->has('themes', 37)
                ->has('questions', 228));
        $this->get(self::ADMIN.'/admin/juegos/lingobible')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Juegos/Lingobible')->has('selected.units'));
        $this->get(self::ADMIN.'/admin/juegos/cristiano-oculto')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Juegos/Oculto')->has('words', 1100));

        $this->assertNotContains('games.manage', Permissions::forTypes(['atmosfera']));
        $this->actingAs($this->admin('renato', ['atmosfera']));
        $this->get(self::ADMIN.'/admin/juegos')->assertRedirect('/admin');
        $this->postJson(self::ADMIN.'/admin/juegos/rebet/tema/eliminar', ['id' => RebetCategory::query()->value('id')])->assertForbidden();
        $this->assertSame(37, RebetCategory::query()->count());
    }

    public function test_rebet_questions_need_four_distinct_options_and_a_theme_takes_its_questions_when_deleted(): void
    {
        $this->actingAs($this->admin('marisol', ['visuales']));
        $this->postJson(self::ADMIN.'/admin/juegos/rebet/tema', ['name' => 'Milagros de Jesús', 'active' => '1'])->assertOk();
        $theme = RebetCategory::query()->where('name', 'Milagros de Jesús')->firstOrFail();
        $question = [
            'rebet_category_id' => $theme->id,
            'difficulty' => 'medium',
            'question' => '¿En qué boda convirtió Jesús el agua en vino?',
            'options' => ['Caná', 'Caná', 'Betania', 'Jericó'],
            'correct' => 0,
            'time_limit' => 20,
            'reference' => 'Juan 2:1-11',
        ];

        $this->postJson(self::ADMIN.'/admin/juegos/rebet/pregunta', $question)->assertStatus(422)->assertJsonPath('error', 'Las cuatro opciones deben ser distintas.');
        $this->postJson(self::ADMIN.'/admin/juegos/rebet/pregunta', [...$question, 'options' => ['Caná', 'Naín', '', 'Jericó']])->assertStatus(422);
        $this->postJson(self::ADMIN.'/admin/juegos/rebet/pregunta', [...$question, 'options' => ['Caná', 'Naín', 'Betania', 'Jericó'], 'active' => '1'])->assertOk();
        $this->postJson(self::ADMIN.'/admin/juegos/rebet/pregunta', [...$question, 'question' => '¿Cuántas tinajas de agua había en la boda?', 'options' => ['Seis', 'Tres', 'Doce', 'Siete']])->assertOk();

        $saved = $theme->questions()->get()->keyBy('question');
        $this->assertTrue($saved[$question['question']]->active);
        $this->assertSame(['Caná', 'Naín', 'Betania', 'Jericó'], $saved[$question['question']]->options);
        $this->assertFalse($saved['¿Cuántas tinajas de agua había en la boda?']->active);

        $this->postJson(self::ADMIN.'/admin/juegos/rebet/tema/eliminar', ['id' => $theme->id])->assertOk();
        $this->assertDatabaseMissing('rebet_categories', ['id' => $theme->id]);
        $this->assertSame(0, RebetQuestion::query()->where('rebet_category_id', $theme->id)->count());
    }

    public function test_lingobible_answers_stay_within_their_options_and_records_reorder_inside_their_lesson(): void
    {
        $this->actingAs($this->admin('marisol', ['visuales']));
        $pathId = $this->postJson(self::ADMIN.'/admin/juegos/lingobible/ruta', ['title' => 'Los Salmos', 'published' => '1'])->assertOk()->json('id');
        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/unidad', ['lingo_path_id' => $pathId, 'title' => 'Alabanza'])->assertOk();
        $unit = LingoPath::query()->findOrFail($pathId)->units()->firstOrFail();
        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/leccion', ['lingo_unit_id' => $unit->id, 'title' => 'El buen pastor', 'xp' => 15, 'published' => '1'])->assertOk();
        $lesson = LingoLesson::query()->where('lingo_unit_id', $unit->id)->firstOrFail();
        $exercise = ['lingo_lesson_id' => $lesson->id, 'kind' => 'choice', 'prompt' => '¿Quién es mi pastor según el Salmo 23?', 'passage_reference' => 'Salmo 23:1'];

        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/ejercicio', [...$exercise, 'options' => "El Señor\nDavid\nMoisés", 'answer' => 3])
            ->assertStatus(422)->assertJsonPath('error', 'Marca cuál de las opciones es la correcta.');
        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/ejercicio', [...$exercise, 'options' => ['El Señor', '  ', 'David', 'Moisés'], 'answer' => 0])->assertOk();
        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/ejercicio', [...$exercise, 'kind' => 'truefalse', 'prompt' => 'El Salmo 23 dice que nada me faltará.', 'options' => ['x', 'y'], 'answer' => 1])->assertOk();

        [$choice, $statement] = LingoExercise::query()->where('lingo_lesson_id', $lesson->id)->orderBy('sort_order')->get()->all();
        $this->assertSame(['El Señor', 'David', 'Moisés'], $choice->options);
        $this->assertNull($statement->options);
        $this->assertSame(1, $statement->answer);

        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/orden', ['type' => 'exercise', 'id' => $statement->id, 'direction' => 'up'])->assertOk();
        $this->assertSame([$statement->id, $choice->id], LingoExercise::query()->where('lingo_lesson_id', $lesson->id)->orderBy('sort_order')->pluck('id')->all());

        $this->postJson(self::ADMIN.'/admin/juegos/lingobible/eliminar', ['type' => 'path', 'id' => $pathId])->assertOk();
        $this->assertSame(0, LingoExercise::query()->where('lingo_lesson_id', $lesson->id)->count());
    }

    public function test_oculto_words_are_unique_per_theme_and_take_one_clue_per_line(): void
    {
        $this->actingAs($this->admin('marisol', ['visuales']));
        $theme = OcultoCategory::query()->firstOrFail();
        $existing = OcultoWord::query()->where('oculto_category_id', $theme->id)->firstOrFail();

        $this->postJson(self::ADMIN.'/admin/juegos/cristiano-oculto/palabra', ['oculto_category_id' => $theme->id, 'word' => mb_strtoupper($existing->word), 'active' => '1'])
            ->assertStatus(422)->assertJsonPath('error', 'Esa palabra ya está en este tema.');

        $this->postJson(self::ADMIN.'/admin/juegos/cristiano-oculto/palabra', [
            'oculto_category_id' => $theme->id,
            'word' => 'Zarza ardiente',
            'reference' => 'Éxodo 3:2',
            'clues' => "fuego\r\nmonte\n\nfuego\nsandalias",
            'active' => '1',
        ])->assertOk();

        $word = $theme->words()->where('word', 'Zarza ardiente')->firstOrFail();
        $this->assertSame(['fuego', 'monte', 'sandalias'], $word->clues);
        $this->assertTrue($word->active);

        $this->postJson(self::ADMIN.'/admin/juegos/cristiano-oculto/palabra', ['id' => $word->id, 'oculto_category_id' => $theme->id, 'word' => 'Zarza ardiente'])->assertOk();
        $this->assertFalse($word->fresh()->active);
    }

    /** @param  list<string>  $types */
    private function admin(string $username, array $types): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
