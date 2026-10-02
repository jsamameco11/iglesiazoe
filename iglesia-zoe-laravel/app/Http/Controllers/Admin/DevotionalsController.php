<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use App\Models\Devotional;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class DevotionalsController extends Controller
{
    private const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    public function index(): Response
    {
        return Inertia::render('Admin/Devocionales', [
            'devotionals' => Devotional::query()->orderByDesc('publish_on')->orderByDesc('created_at')->get()->map->full(),
            'today' => now('America/Lima')->toDateString(),
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $existing = $this->find($request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return response()->json(['error' => 'Ese devocional ya no existe. Recarga la página.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:160',
            'publish_on' => 'required|date',
            'verse_ref' => 'nullable|string|max:80',
            'verse_text' => 'nullable|string|max:600',
            'body' => 'required|string|min:40|max:20000',
            'author' => 'nullable|string|max:100',
        ], [
            'required' => 'Completa el campo :attribute.',
            'date' => 'Elige una fecha válida.',
            'body.min' => 'El devocional es muy corto: escribe al menos un párrafo.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], [
            'title' => 'título',
            'publish_on' => 'fecha de publicación',
            'verse_ref' => 'cita bíblica',
            'verse_text' => 'versículo',
            'body' => 'devocional',
            'author' => 'autor',
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $data = array_map(fn ($value) => is_string($value) ? (trim($value) ?: null) : $value, $validator->validated());
        $data['body'] = str_replace("\r\n", "\n", $data['body']);
        $data['active'] = $request->boolean('active');
        if (! $existing || $existing->title !== $data['title']) {
            $data['slug'] = $this->uniqueSlug($data['title'], $existing?->id);
        }

        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $ext = $image->isValid() ? strtolower((string) $image->guessExtension()) : '';
            if (! in_array($ext, self::IMAGE_TYPES, true) || $image->getSize() > 8 * 1024 * 1024) {
                return response()->json(['error' => 'La imagen debe ser JPG, PNG o WEBP de hasta 8 MB.'], 422);
            }
            $data['image_path'] = MediaLibrary::storePublic($image, 'devocionales', $ext);
            MediaLibrary::deletePublic($existing?->image_path);
        } elseif ($existing && $request->boolean('remove_image')) {
            MediaLibrary::deletePublic($existing->image_path);
            $data['image_path'] = null;
        }

        $existing ? $existing->update($data) : Devotional::query()->create($data);

        return response()->json(['ok' => true, 'reload' => true, 'message' => $existing ? 'Devocional actualizado.' : 'Devocional publicado.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $devotional = $this->find($request->input('id'));
        if ($devotional) {
            MediaLibrary::deletePublic($devotional->image_path);
            $devotional->delete();
        }

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Devocional eliminado.']);
    }

    private function find(mixed $id): ?Devotional
    {
        return is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id) ? Devotional::query()->find($id) : null;
    }

    private function uniqueSlug(string $text, ?string $ignore): string
    {
        $base = Str::limit(Str::slug($text), 120, '') ?: 'devocional';
        $slug = $base;
        for ($n = 2; Devotional::query()->where('slug', $slug)->when($ignore, fn ($query) => $query->whereKeyNot($ignore))->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }
}
