<?php

namespace App\Domain\Media\Actions;

use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ManageSiteMedia
{
    private const ALLOWED = [
        'image' => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
        'video' => ['mp4', 'webm', 'mov'],
    ];

    public function save(Request $request): array
    {
        $id = (string) $request->input('id');
        $intent = (string) $request->input('intent', 'save');
        $overrides = $this->overrides();

        if ($intent === 'restore') {
            unset($overrides[$id]);
            $this->persist($overrides);

            return ['ok' => true];
        }

        if ($intent === 'remove-gallery') {
            $index = $this->galleryIndex($id);
            if ($index <= 6) {
                return ['error' => 'Las primeras 6 fotos del carrusel no se pueden quitar.'];
            }
            unset($overrides[$id]);
            $overrides = $this->compactGallery($overrides);
            $this->persist($overrides);

            return ['ok' => true];
        }

        $kind = (string) $request->input('kind');
        if (! in_array($kind, ['image', 'video'], true)) {
            return ['error' => 'Elige imagen o video.'];
        }

        $previous = $overrides[$id] ?? null;
        $file = $request->file('file');
        $poster = $request->file('poster');
        $src = $previous['src'] ?? '';
        $posterSrc = $previous['poster'] ?? '';

        if ($file instanceof UploadedFile && ! $this->extension($file, $kind)) {
            return ['error' => $kind === 'video' ? 'El video debe ser MP4, WebM o MOV.' : 'La imagen debe ser JPG, PNG, WebP, GIF o AVIF.'];
        }
        if ($kind === 'video' && $poster instanceof UploadedFile && ! $this->extension($poster, 'image')) {
            return ['error' => 'La portada debe ser JPG, PNG, WebP, GIF o AVIF.'];
        }

        if ($file instanceof UploadedFile) {
            $src = $this->store($file, $id, $kind);
        }
        if ($kind === 'video' && $poster instanceof UploadedFile) {
            $posterSrc = $this->store($poster, $id.'-poster', 'image');
        }
        if ($kind === 'image') {
            $posterSrc = '';
        }
        if ($src === '') {
            return ['error' => $kind === 'video' ? 'Sube el video que quieres publicar.' : 'Sube la imagen que quieres publicar.'];
        }

        $overrides[$id] = [
            'kind' => $kind,
            'src' => $src,
            'poster' => $posterSrc,
            'alt' => Str::limit((string) $request->input('alt'), 160, ''),
            'ratio' => (string) $request->input('ratio', 'natural'),
            'fit' => (string) $request->input('fit', 'fill'),
            'posX' => (int) $request->input('posX', 50),
            'posY' => (int) $request->input('posY', 50),
            'zoom' => (int) $request->input('zoom', 100),
            'radius' => (int) $request->input('radius', 24),
            'feather' => $request->boolean('featherOn') ? (int) $request->input('feather', 16) : 0,
        ];
        $this->persist($overrides);

        return ['ok' => true];
    }

    public function addGallerySlot(): array
    {
        $overrides = $this->overrides();
        $next = 7;
        while ($next <= 12 && isset($overrides['gallery-'.$next])) {
            $next++;
        }
        if ($next > 12) {
            return ['error' => 'Puedes tener hasta 12 fotos en el carrusel.'];
        }
        $overrides['gallery-'.$next] = [
            'kind' => 'image',
            'src' => '/images/pastores.jpg',
            'poster' => '',
            'alt' => 'Foto '.$next.' del carrusel',
        ];
        $this->persist($overrides);

        return ['ok' => true];
    }

    public function renameMinistry(string $from, string $to): void
    {
        $overrides = $this->overrides();
        $prefix = 'ministry:'.$from;
        $renamed = [];
        foreach ($overrides as $key => $asset) {
            if ($key === $prefix || str_starts_with($key, $prefix.':')) {
                $renamed['ministry:'.$to.substr($key, strlen($prefix))] = $asset;
            } else {
                $renamed[$key] = $asset;
            }
        }
        if ($renamed !== $overrides) {
            $this->persist($renamed);
        }
    }

    private function overrides(): array
    {
        $stored = SiteSetting::query()->where('key', 'media')->first()?->value;

        return is_array($stored) ? ($stored['assets'] ?? []) : [];
    }

    private function persist(array $overrides): void
    {
        SiteSetting::query()->updateOrCreate(
            ['key' => 'media'],
            ['value' => ['assets' => $overrides], 'updated_at' => now()],
        );
    }

    private function extension(UploadedFile $file, string $kind): ?string
    {
        $ext = $file->isValid() ? strtolower((string) $file->guessExtension()) : '';

        return in_array($ext, self::ALLOWED[$kind] ?? [], true) ? $ext : null;
    }

    private function store(UploadedFile $file, string $id, string $kind): string
    {
        $ext = $this->extension($file, $kind);
        $path = 'medios/site/'.str_replace(':', '/', $id).'/'.time().'.'.$ext;
        Storage::disk('public')->putFileAs(dirname($path), $file, basename($path));

        return '/storage/'.$path;
    }

    private function galleryIndex(string $id): int
    {
        return preg_match('/^gallery-(\d+)$/', $id, $match) ? (int) $match[1] : 0;
    }

    private function compactGallery(array $overrides): array
    {
        $extras = [];
        for ($i = 7; $i <= 12; $i++) {
            $key = 'gallery-'.$i;
            if (! empty($overrides[$key]['src'])) {
                $extras[] = $overrides[$key];
            }
            unset($overrides[$key]);
        }
        foreach ($extras as $offset => $asset) {
            $overrides['gallery-'.(7 + $offset)] = $asset;
        }

        return $overrides;
    }
}
