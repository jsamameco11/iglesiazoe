<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Shared\Support\Slug;
use App\Models\LingoExercise;
use App\Models\LingoLesson;
use App\Models\LingoPath;
use App\Models\LingoUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** LINGOBIBLE in the panel: paths, their units, lessons and the exercises of each lesson. */
class LingobibleController extends GameContentController
{
    public function index(Request $request): Response
    {
        $paths = LingoPath::ordered()->withCount('units')->get();
        $selected = $paths->firstWhere('id', $request->query('ruta')) ?? $paths->first();
        $selected?->load(['units.lessons.exercises']);

        return Inertia::render('Admin/Juegos/Lingobible', [
            'paths' => $paths->map(fn (LingoPath $path) => [
                'id' => $path->id,
                'slug' => $path->slug,
                'title' => $path->title,
                'description' => $path->description,
                'published' => $path->published,
                'units' => $path->units_count,
            ]),
            'selected' => $selected ? [
                'id' => $selected->id,
                'units' => $selected->units->map(fn (LingoUnit $unit) => [
                    'id' => $unit->id,
                    'title' => $unit->title,
                    'description' => $unit->description,
                    'lessons' => $unit->lessons->map(fn (LingoLesson $lesson) => [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'xp' => $lesson->xp,
                        'published' => $lesson->published,
                        'exercises' => $lesson->exercises->map->full()->values(),
                    ])->values(),
                ])->values(),
            ] : null,
        ]);
    }

    public function savePath(Request $request): JsonResponse
    {
        $path = $this->find(LingoPath::class, $request->input('id'));
        if ($request->filled('id') && ! $path) {
            return $this->fail('Esa ruta ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'title' => 'required|string|min:2|max:120',
            'description' => 'nullable|string|max:400',
        ], ['title' => 'título', 'description' => 'descripción']);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $data['published'] = $request->boolean('published');
        if (! $path || $path->title !== $data['title']) {
            $data['slug'] = Slug::unique(LingoPath::class, $data['title'], 'ruta', 100, $path?->id);
        }
        $saved = $path ? tap($path)->update($data) : LingoPath::query()->create([...$data, 'sort_order' => $this->nextOrder(LingoPath::query())]);

        return response()->json(['ok' => true, 'reload' => true, 'id' => $saved->id, 'message' => $path ? 'Ruta actualizada.' : 'Ruta creada.']);
    }

    public function saveUnit(Request $request): JsonResponse
    {
        $unit = $this->find(LingoUnit::class, $request->input('id'));
        if ($request->filled('id') && ! $unit) {
            return $this->fail('Esa unidad ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'lingo_path_id' => 'required|uuid|exists:lingo_paths,id',
            'title' => 'required|string|min:2|max:120',
            'description' => 'nullable|string|max:400',
        ], ['lingo_path_id' => 'ruta', 'title' => 'título', 'description' => 'descripción']);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $unit
            ? $unit->update($data)
            : LingoUnit::query()->create([...$data, 'sort_order' => $this->nextOrder(LingoUnit::query()->where('lingo_path_id', $data['lingo_path_id']))]);

        return $this->saved($unit ? 'Unidad actualizada.' : 'Unidad creada.');
    }

    public function saveLesson(Request $request): JsonResponse
    {
        $lesson = $this->find(LingoLesson::class, $request->input('id'));
        if ($request->filled('id') && ! $lesson) {
            return $this->fail('Esa lección ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'lingo_unit_id' => 'required|uuid|exists:lingo_units,id',
            'title' => 'required|string|min:2|max:120',
            'xp' => 'required|integer|between:5,100',
        ], ['lingo_unit_id' => 'unidad', 'title' => 'título', 'xp' => 'XP']);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $data['published'] = $request->boolean('published');
        $lesson
            ? $lesson->update($data)
            : LingoLesson::query()->create([...$data, 'sort_order' => $this->nextOrder(LingoLesson::query()->where('lingo_unit_id', $data['lingo_unit_id']))]);

        return $this->saved($lesson ? 'Lección actualizada.' : 'Lección creada.');
    }

    public function saveExercise(Request $request): JsonResponse
    {
        $exercise = $this->find(LingoExercise::class, $request->input('id'));
        if ($request->filled('id') && ! $exercise) {
            return $this->fail('Ese ejercicio ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'lingo_lesson_id' => 'required|uuid|exists:lingo_lessons,id',
            'kind' => 'required|in:'.implode(',', array_keys(LingoExercise::KINDS)),
            'prompt' => 'required|string|min:5|max:500',
            'passage_reference' => 'nullable|string|max:120',
            'passage_text' => 'nullable|string|max:1500',
            'answer' => 'required|integer|between:0,5',
        ], [
            'lingo_lesson_id' => 'lección',
            'kind' => 'tipo',
            'prompt' => 'pregunta',
            'passage_reference' => 'cita',
            'passage_text' => 'texto bíblico',
            'answer' => 'respuesta correcta',
        ]);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        if ($data['kind'] === 'choice') {
            $options = array_map(fn (string $option) => mb_substr($option, 0, 200), $this->lines($request->input('options')));
            if (count($options) < 2 || count($options) > 6) {
                return $this->fail('Escribe entre 2 y 6 opciones.');
            }
            if ($data['answer'] >= count($options)) {
                return $this->fail('Marca cuál de las opciones es la correcta.');
            }
            $data['options'] = $options;
        } else {
            $data['options'] = null;
            $data['answer'] = $data['answer'] === 1 ? 1 : 0;
        }
        $exercise
            ? $exercise->update($data)
            : LingoExercise::query()->create([...$data, 'sort_order' => $this->nextOrder(LingoExercise::query()->where('lingo_lesson_id', $data['lingo_lesson_id']))]);

        return $this->saved($exercise ? 'Ejercicio actualizado.' : 'Ejercicio creado.');
    }

    public function reorder(Request $request): JsonResponse
    {
        $direction = (string) $request->input('direction');
        $id = $request->input('id');

        return match ($request->input('type')) {
            'path' => $this->move(LingoPath::query(), $id, $direction),
            'unit' => ($unit = $this->find(LingoUnit::class, $id)) ? $this->move(LingoUnit::query()->where('lingo_path_id', $unit->lingo_path_id), $id, $direction) : $this->saved(),
            'lesson' => ($lesson = $this->find(LingoLesson::class, $id)) ? $this->move(LingoLesson::query()->where('lingo_unit_id', $lesson->lingo_unit_id), $id, $direction) : $this->saved(),
            'exercise' => ($exercise = $this->find(LingoExercise::class, $id)) ? $this->move(LingoExercise::query()->where('lingo_lesson_id', $exercise->lingo_lesson_id), $id, $direction) : $this->saved(),
            default => $this->fail('No se pudo mover.'),
        };
    }

    public function destroy(Request $request): JsonResponse
    {
        $id = $request->input('id');
        [$model, $message] = match ($request->input('type')) {
            'path' => [LingoPath::class, 'Ruta eliminada con sus unidades, lecciones y ejercicios.'],
            'unit' => [LingoUnit::class, 'Unidad eliminada con sus lecciones y ejercicios.'],
            'lesson' => [LingoLesson::class, 'Lección eliminada con sus ejercicios.'],
            'exercise' => [LingoExercise::class, 'Ejercicio eliminado.'],
            default => [null, null],
        };
        if (! $model) {
            return $this->fail('No se pudo eliminar.');
        }
        $this->find($model, $id)?->delete();

        return $this->saved($message);
    }
}
