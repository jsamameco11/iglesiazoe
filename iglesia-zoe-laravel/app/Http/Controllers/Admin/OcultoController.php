<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Shared\Support\Slug;
use App\Models\OcultoCategory;
use App\Models\OcultoWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** El Cristiano Oculto in the panel: themes and their secret words with description, cita and clues. */
class OcultoController extends GameContentController
{
    private const MAX_CLUES = 8;

    public function index(): Response
    {
        return Inertia::render('Admin/Juegos/Oculto', [
            'themes' => OcultoCategory::ordered()->withCount('words')->get()->map(fn (OcultoCategory $theme) => [
                'id' => $theme->id,
                'name' => $theme->name,
                'active' => $theme->active,
                'count' => $theme->words_count,
            ]),
            'words' => OcultoWord::query()->orderBy('word')->get()->map->full(),
        ]);
    }

    public function saveTheme(Request $request): JsonResponse
    {
        $theme = $this->find(OcultoCategory::class, $request->input('id'));
        if ($request->filled('id') && ! $theme) {
            return $this->fail('Ese tema ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, ['name' => 'required|string|min:2|max:80'], ['name' => 'nombre del tema']);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $data['active'] = $request->boolean('active');
        if (! $theme || $theme->name !== $data['name']) {
            $data['slug'] = Slug::unique(OcultoCategory::class, $data['name'], 'tema', 80, $theme?->id);
        }

        $theme ? $theme->update($data) : OcultoCategory::query()->create([...$data, 'sort_order' => $this->nextOrder(OcultoCategory::query())]);

        return $this->saved($theme ? 'Tema actualizado.' : 'Tema creado.');
    }

    public function moveTheme(Request $request): JsonResponse
    {
        return $this->move(OcultoCategory::query(), $request->input('id'), (string) $request->input('direction'));
    }

    public function deleteTheme(Request $request): JsonResponse
    {
        $this->find(OcultoCategory::class, $request->input('id'))?->delete();

        return $this->saved('Tema eliminado junto con sus palabras.');
    }

    public function saveWord(Request $request): JsonResponse
    {
        $word = $this->find(OcultoWord::class, $request->input('id'));
        if ($request->filled('id') && ! $word) {
            return $this->fail('Esa palabra ya no existe. Recarga la página.', 404);
        }
        $data = $this->check($request, [
            'oculto_category_id' => 'required|uuid|exists:oculto_categories,id',
            'word' => 'required|string|min:2|max:80',
            'description' => 'nullable|string|max:400',
            'reference' => 'nullable|string|max:120',
        ], [
            'oculto_category_id' => 'tema',
            'word' => 'palabra',
            'description' => 'descripción',
            'reference' => 'cita bíblica',
        ]);
        if ($data instanceof JsonResponse) {
            return $data;
        }
        $repeated = OcultoWord::query()->where('oculto_category_id', $data['oculto_category_id'])
            ->whereRaw('lower(word) = ?', [mb_strtolower($data['word'])])
            ->when($word, fn ($query) => $query->whereKeyNot($word->id))
            ->exists();
        if ($repeated) {
            return $this->fail('Esa palabra ya está en este tema.');
        }
        $data['clues'] = array_slice(array_values(array_unique(array_map(fn (string $clue) => mb_substr($clue, 0, 60), $this->lines($request->input('clues'))))), 0, self::MAX_CLUES);
        $data['active'] = $request->boolean('active');

        $word ? $word->update($data) : OcultoWord::query()->create($data);

        return $this->saved($word ? 'Palabra actualizada.' : 'Palabra creada.');
    }

    public function deleteWord(Request $request): JsonResponse
    {
        $this->find(OcultoWord::class, $request->input('id'))?->delete();

        return $this->saved('Palabra eliminada.');
    }
}
