<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Support\Slug;
use App\Http\Controllers\Controller;
use App\Models\ServiceGallery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Recursos · Galería de cultos: one album per Sunday, midweek or special service. */
class GalleriesController extends Controller
{
    private const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    private const KIND_TITLES = [
        'dominical' => 'Culto dominical',
        'media-semana' => 'Culto de media semana',
        'especial' => 'Servicio especial',
    ];

    public function index(): Response
    {
        return Inertia::render('Admin/Galeria', [
            'galleries' => ServiceGallery::query()->orderByDesc('service_date')->orderByDesc('created_at')->get()->map->full(),
            'today' => now('America/Lima')->toDateString(),
            'maxPhotos' => ServiceGallery::MAX_PHOTOS,
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $existing = $this->find(ServiceGallery::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Ese álbum ya no existe. Recarga la página.', 404);
        }

        $validator = Validator::make($request->all(), [
            'kind' => ['required', Rule::in(ServiceGallery::KINDS)],
            'service_date' => 'required|date',
            'title' => 'nullable|string|max:160',
            'summary' => 'nullable|string|max:400',
        ], [
            'required' => 'Completa el campo :attribute.',
            'in' => 'Elige una opción válida en :attribute.',
            'date' => 'Elige una fecha válida.',
            'max' => 'El campo :attribute es demasiado largo.',
        ], [
            'kind' => 'tipo de culto',
            'service_date' => 'fecha',
            'title' => 'título',
            'summary' => 'descripción',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = $validator->validated();
        $date = Carbon::parse($data['service_date']);
        $payload = [
            'kind' => $data['kind'],
            'service_date' => $date->toDateString(),
            'title' => trim((string) ($data['title'] ?? '')) ?: self::KIND_TITLES[$data['kind']],
            'summary' => trim((string) ($data['summary'] ?? '')) ?: null,
            'active' => $request->boolean('active'),
        ];
        $renamed = ! $existing || $existing->title !== $payload['title'] || $existing->service_date?->toDateString() !== $payload['service_date'];
        if ($renamed) {
            $payload['slug'] = Slug::unique(ServiceGallery::class, $payload['title'].' '.$date->format('d-m-Y'), 'culto', ignore: $existing?->id);
        }

        $gallery = $existing ? tap($existing)->update($payload) : ServiceGallery::query()->create([...$payload, 'photos' => []]);

        return response()->json([
            'ok' => true,
            'id' => $gallery->id,
            'message' => $existing ? 'Álbum actualizado.' : 'Álbum creado. Ahora sube las fotos.',
        ]);
    }

    public function upload(Request $request): JsonResponse
    {
        $gallery = $this->find(ServiceGallery::class, $request->input('id'));
        if (! $gallery) {
            return $this->fail('Ese álbum ya no existe. Recarga la página.', 404);
        }
        $photo = $request->file('photo');
        $ext = MediaLibrary::extension($photo, self::IMAGE_TYPES);
        if (! $ext || $photo->getSize() > 12 * 1024 * 1024) {
            return $this->fail('Cada foto debe ser JPG, PNG o WEBP de hasta 12 MB.');
        }
        if (count($gallery->photoList()) >= ServiceGallery::MAX_PHOTOS) {
            return $this->fail('Este álbum ya tiene '.ServiceGallery::MAX_PHOTOS.' fotos. Crea otro álbum para el resto.');
        }

        $path = MediaLibrary::storePublic($photo, 'galeria/'.$gallery->service_date->format('Y'), $ext);
        $count = DB::transaction(function () use ($gallery, $path) {
            $fresh = ServiceGallery::query()->lockForUpdate()->findOrFail($gallery->id);
            $fresh->photos = [...$fresh->photoList(), $path];
            $fresh->save();

            return count($fresh->photos);
        });

        return response()->json(['ok' => true, 'path' => $path, 'count' => $count]);
    }

    public function removePhoto(Request $request): JsonResponse
    {
        $gallery = $this->find(ServiceGallery::class, $request->input('id'));
        $path = (string) $request->input('path');
        if ($gallery && in_array($path, $gallery->photoList(), true)) {
            $gallery->update(['photos' => array_values(array_diff($gallery->photoList(), [$path]))]);
            MediaLibrary::deletePublic($path);
        }

        return $this->saved();
    }

    public function cover(Request $request): JsonResponse
    {
        $gallery = $this->find(ServiceGallery::class, $request->input('id'));
        $path = (string) $request->input('path');
        if ($gallery && in_array($path, $gallery->photoList(), true)) {
            $gallery->update(['photos' => [$path, ...array_values(array_diff($gallery->photoList(), [$path]))]]);
        }

        return $this->saved('Portada actualizada.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $gallery = $this->find(ServiceGallery::class, $request->input('id'));
        if ($gallery) {
            foreach ($gallery->photoList() as $path) {
                MediaLibrary::deletePublic($path);
            }
            $gallery->delete();
        }

        return $this->saved('Álbum eliminado.');
    }
}
