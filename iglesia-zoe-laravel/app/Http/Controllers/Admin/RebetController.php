<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Shared\Support\Slug;
use App\Models\RebetCategory;
use App\Models\RebetQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** REBET in the panel: themes and their timed questions with four options. */
class RebetController extends GameContentController
{
    public function index(): Response
    {
        return Inertia::render('Admin/Juegos/Rebet', [
            'themes' => RebetCategory::ordered()->withCount('questions')->get()->map(fn (RebetCategory $theme) => [
                'id' => $theme->id,
                'name' => $theme->name,
                'active' => $theme->active,
                'questions' => $theme->questions_count,
            ]),
            'questions' => RebetQuestion::query()->orderBy('created_at')->get()->map->full(),
            'difficulties' => RebetQuestion::DIFFICULTIES,
        ]);
    }

    public function saveTheme(Request $request): JsonResponse
    {
        $theme = $this->find(RebetCategory::class, $request->input('id'));
        if ($request->filled('id') && ! $theme) {
            return $this->fail('Ese tema ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, ['name' => 'required|string|min:2|max:80'], ['name' => 'nombre del tema']);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $data['active'] = $request->boolean('active');
        if (! $theme || $theme->name !== $data['name']) {
            $data['slug'] = Slug::unique(RebetCategory::class, $data['name'], 'tema', 80, $theme?->id);
        }

        $theme ? $theme->update($data) : RebetCategory::query()->create([...$data, 'sort_order' => $this->nextOrder(RebetCategory::query())]);

        return $this->saved($theme ? 'Tema actualizado.' : 'Tema creado.');
    }

    public function moveTheme(Request $request): JsonResponse
    {
        return $this->move(RebetCategory::query(), $request->input('id'), (string) $request->input('direction'));
    }

    public function deleteTheme(Request $request): JsonResponse
    {
        $this->find(RebetCategory::class, $request->input('id'))?->delete();

        return $this->saved('Tema eliminado junto con sus preguntas.');
    }

    public function saveQuestion(Request $request): JsonResponse
    {
        $question = $this->find(RebetQuestion::class, $request->input('id'));
        if ($request->filled('id') && ! $question) {
            return $this->fail('Esa pregunta ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'rebet_category_id' => 'required|uuid|exists:rebet_categories,id',
            'difficulty' => 'required|in:'.implode(',', array_keys(RebetQuestion::DIFFICULTIES)),
            'question' => 'required|string|min:5|max:400',
            'explanation' => 'nullable|string|max:800',
            'reference' => 'nullable|string|max:120',
            'time_limit' => 'required|integer|between:10,60',
            'correct' => 'required|integer|between:0,3',
        ], [
            'rebet_category_id' => 'tema',
            'difficulty' => 'dificultad',
            'question' => 'pregunta',
            'explanation' => 'explicación',
            'reference' => 'cita bíblica',
            'time_limit' => 'tiempo',
            'correct' => 'respuesta correcta',
        ]);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $options = array_map(fn ($value) => is_string($value) ? mb_substr(trim($value), 0, 200) : '', array_pad(array_slice((array) $request->input('options'), 0, 4), 4, ''));
        if (in_array('', $options, true)) {
            return $this->fail('Escribe las cuatro opciones (A, B, C y D).');
        }
        if (count(array_unique(array_map('mb_strtolower', $options))) < 4) {
            return $this->fail('Las cuatro opciones deben ser distintas.');
        }
        $data['options'] = $options;
        $data['active'] = $request->boolean('active');

        $question ? $question->update($data) : RebetQuestion::query()->create($data);

        return $this->saved($question ? 'Pregunta actualizada.' : 'Pregunta creada.');
    }

    public function deleteQuestion(Request $request): JsonResponse
    {
        $this->find(RebetQuestion::class, $request->input('id'))?->delete();

        return $this->saved('Pregunta eliminada.');
    }
}
