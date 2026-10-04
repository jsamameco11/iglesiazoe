<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use App\Models\PastEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

/** «Conoce más de nuestros eventos anteriores»: a cover, a title, a date and the post it opens. */
class PastEventsController extends Controller
{
    private const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    public function save(Request $request): JsonResponse
    {
        $existing = $request->filled('id') ? PastEvent::query()->find((string) $request->input('id')) : null;
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese evento ya no existe. Recarga la página.', 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:160',
            'held_on' => 'required|date|before_or_equal:today',
            'url' => 'required|string|max:500',
        ], [
            'required' => 'Completa el campo :attribute.',
            'date' => 'Elige una fecha válida en :attribute.',
            'before_or_equal' => 'La fecha del evento debe ser de hoy o anterior.',
            'min' => 'Revisa el campo :attribute.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], [
            'title' => 'nombre del evento',
            'held_on' => 'fecha del evento',
            'url' => 'enlace',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = array_map(fn ($value) => is_string($value) ? trim($value) : $value, $validator->validated());
        if (! PastEvent::platformOf($data['url'])) {
            return $this->fail('Pega el enlace completo de la publicación en Instagram, Facebook, TikTok o YouTube (empieza con https://).');
        }
        $data['active'] = $request->boolean('active');

        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $ext = MediaLibrary::extension($image, self::IMAGE_TYPES);
            if (! $ext || $image->getSize() > 8 * 1024 * 1024) {
                return $this->fail('La portada debe ser JPG, PNG o WEBP de hasta 8 MB.');
            }
            $data['image_path'] = MediaLibrary::storePublic($image, 'eventos-anteriores', $ext);
            MediaLibrary::deletePublic($existing?->image_path);
        } elseif (! $existing?->image_path) {
            return $this->fail('Sube la portada del evento.');
        }

        $existing ? $existing->update($data) : PastEvent::query()->create($data);

        return $this->saved($existing ? 'Evento anterior actualizado.' : 'Evento anterior publicado.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $event = PastEvent::query()->find((string) $request->input('id'));
        if ($event) {
            MediaLibrary::deletePublic($event->image_path);
            $event->delete();
        }

        return $this->saved('Evento anterior eliminado.');
    }
}
