<?php

namespace App\Http\Controllers\Web;

use App\Domain\Games\Oculto;
use App\Domain\Games\Rebet;
use App\Domain\Games\Rooms\Rooms;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Http\Controllers\Controller;
use App\Models\LingoExercise;
use App\Models\LingoLesson;
use App\Models\LingoPath;
use App\Models\LingoUnit;
use App\Models\OcultoWord;
use App\Models\RebetQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The Bible games of /juegos: REBET, LINGOBIBLE and El Cristiano Oculto. */
class GamesController extends Controller
{
    public function index(Request $request): Response
    {
        return $this->render('Games/Index', $request, [
            'stats' => [
                'rebet' => RebetQuestion::query()->where('active', true)->count(),
                'lingobible' => LingoLesson::query()->where('published', true)->whereHas('unit.path', fn ($query) => $query->where('published', true))->count(),
                'oculto' => OcultoWord::query()->where('active', true)->count(),
            ],
        ]);
    }

    public function rebet(Request $request): Response
    {
        return $this->render('Games/Rebet', $request, [
            'themes' => Rebet::themes(),
            'difficulties' => RebetQuestion::DIFFICULTIES,
            'counts' => Rebet::COUNTS,
        ]);
    }

    public function rebetQuestions(Request $request): JsonResponse
    {
        $questions = Rebet::pick(
            array_values(array_filter((array) $request->query('temas', []), 'is_string')),
            (string) $request->query('dificultad', 'mixed'),
            (int) $request->query('cantidad', 10),
        );

        return response()->json(['questions' => $questions->map->card()->values()]);
    }

    public function rebetAnswer(Request $request): JsonResponse
    {
        $question = $this->find(RebetQuestion::class, $request->input('question'));
        if (! $question || ! $question->active) {
            return $this->fail('Esa pregunta ya no está disponible.', 404);
        }

        return response()->json(Rebet::grade(
            $question,
            (int) $request->input('choice', -1),
            (float) $request->input('seconds', 0),
            min(max((int) $request->input('streak', 0), 0), 50),
        ));
    }

    public function lingobible(Request $request): Response
    {
        $paths = LingoPath::ordered()->where('published', true)
            ->with(['units.lessons' => fn ($query) => $query->where('published', true)->withCount('exercises')])
            ->get()
            ->map(fn (LingoPath $path) => [
                'id' => $path->id,
                'slug' => $path->slug,
                'title' => $path->title,
                'description' => $path->description,
                'units' => $path->units->count(),
                'lessons' => $path->units->flatMap->lessons->pluck('id')->all(),
            ])
            ->filter(fn (array $path) => $path['lessons'])
            ->values();

        return $this->render('Games/Lingobible', $request, ['paths' => $paths]);
    }

    public function lingoPath(Request $request, string $slug): Response
    {
        $path = LingoPath::query()->where('published', true)->where('slug', $slug)
            ->with(['units.lessons' => fn ($query) => $query->where('published', true)->withCount('exercises')])
            ->first();
        abort_unless($path, 404);

        return $this->render('Games/LingoPath', $request, [
            'path' => [
                'slug' => $path->slug,
                'title' => $path->title,
                'description' => $path->description,
                'units' => $path->units->map(fn (LingoUnit $unit) => [
                    'id' => $unit->id,
                    'title' => $unit->title,
                    'description' => $unit->description,
                    'lessons' => $unit->lessons->filter(fn (LingoLesson $lesson) => $lesson->exercises_count > 0)->map(fn (LingoLesson $lesson) => [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'xp' => $lesson->xp,
                        'exercises' => $lesson->exercises_count,
                    ])->values(),
                ])->filter(fn (array $unit) => $unit['lessons']->isNotEmpty())->values(),
            ],
        ]);
    }

    public function lingoLesson(Request $request, string $slug, string $lesson): Response
    {
        $path = LingoPath::query()->where('published', true)->where('slug', $slug)
            ->with(['units.lessons' => fn ($query) => $query->where('published', true)->has('exercises')])
            ->first();
        $sequence = $path?->units->flatMap->lessons->values();
        $position = $sequence?->search(fn (LingoLesson $item) => $item->id === $lesson);
        abort_unless($path && $position !== false && $position !== null, 404);

        $current = $sequence[$position]->load(['exercises', 'unit']);
        $next = $sequence[$position + 1] ?? null;

        return $this->render('Games/LingoLesson', $request, [
            'path' => ['slug' => $path->slug, 'title' => $path->title],
            'lesson' => [
                'id' => $current->id,
                'title' => $current->title,
                'unit' => $current->unit->title,
                'xp' => $current->xp,
                'number' => $position + 1,
                'total' => $sequence->count(),
                'previous' => $sequence[$position - 1]->id ?? null,
                'exercises' => $current->exercises->map->card()->values(),
            ],
            'next' => $next ? ['id' => $next->id, 'title' => $next->title] : null,
        ]);
    }

    public function lingoAnswer(Request $request): JsonResponse
    {
        $exercise = $this->find(LingoExercise::class, $request->input('exercise'));
        if (! $exercise) {
            return $this->fail('Ese ejercicio ya no está disponible.', 404);
        }
        $right = $exercise->rightChoice();

        return response()->json([
            'correct' => (int) $request->input('choice', -1) === $right,
            'right' => $right,
            'reference' => $exercise->passage_reference,
        ]);
    }

    public function oculto(Request $request): Response
    {
        return $this->render('Games/Oculto', $request, ['themes' => Oculto::themes()]);
    }

    public function ocultoWord(Request $request): JsonResponse
    {
        $word = Oculto::randomWord(
            array_values(array_filter((array) $request->query('temas', []), 'is_string')),
            (string) $request->query('nivel', Oculto::DEFAULT_LEVEL),
        );

        return $word
            ? response()->json(['word' => $word->card()])
            : $this->fail('No hay palabras de este nivel para los temas elegidos.', 404);
    }

    public function rebetRoom(Request $request, string $code): Response
    {
        return $this->room($request, 'rebet', $code);
    }

    public function ocultoRoom(Request $request, string $code): Response
    {
        return $this->room($request, 'oculto', $code);
    }

    /** Links shared before each game had its own rooms still land in the right game. */
    public function legacyRoom(string $code): RedirectResponse
    {
        $room = Rooms::find($code);

        return redirect($room ? '/juegos/'.Rooms::PATHS[$room->game].'/sala/'.$room->code : '/juegos');
    }

    private function room(Request $request, string $game, string $code): Response
    {
        $room = Rooms::find($code);
        $open = $room && $room->status !== 'closed';

        return $this->render('Games/Room', $request, [
            'code' => mb_strtoupper($code),
            'game' => $game,
            'found' => $open && $room->game === $game,
            'elsewhere' => $open && $room->game !== $game ? $room->game : null,
            'joinable' => $room?->status === 'lobby' && $room->game === $game,
            'themes' => $game === 'rebet' ? Rebet::themes() : Oculto::themes(),
        ]);
    }

    /** @param  array<string, mixed>  $props */
    private function render(string $component, Request $request, array $props): Response
    {
        return Inertia::render($component, [
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'serveAreas' => LoadPublicSite::serveAreas(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'skin' => ResolveSiteSkin::fromRequest($request),
            ...$props,
        ]);
    }
}
