<?php

namespace App\Domain\Media\Actions;

use App\Domain\Media\Support\MediaLibrary;
use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class ManageSiteMedia
{
    private const ALLOWED = [
        'image' => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
        'video' => ['mp4', 'webm', 'mov'],
    ];

    /** Single-photo slots that also take more photos and then show as a carousel on the site. */
    public const CAROUSEL = [
        'hero', 'home-cells', 'about-pastors', 'visit', 'sermons', 'giving', 'contact', 'events', 'teachings',
        'gallery', 'devotionals', 'serve-cover', 'route-cover', 'route-1', 'route-2', 'route-3', 'route-4', 'route-5', 'route-6',
    ];

    public const MAX_SLIDES = 12;

    private const SLIDE_MAX_BYTES = 12 * 1024 * 1024;

    public function save(Request $request): array
    {
        $id = (string) $request->input('id');
        $intent = (string) $request->input('intent', 'save');
        $overrides = $this->overrides();

        if ($intent === 'restore') {
            MediaLibrary::deletePublic($overrides[$id]['src'] ?? null);
            MediaLibrary::deletePublic($overrides[$id]['poster'] ?? null);
            foreach ($overrides[$id]['slides'] ?? [] as $slide) {
                MediaLibrary::deletePublic($slide['src'] ?? null);
            }
            unset($overrides[$id]);
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

        foreach (['src', 'poster'] as $field) {
            $old = $previous[$field] ?? '';
            if ($old !== '' && $old !== ($field === 'src' ? $src : $posterSrc)) {
                MediaLibrary::deletePublic($old);
            }
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
        if (! empty($previous['slides'])) {
            $overrides[$id]['slides'] = $previous['slides'];
        }
        $this->persist($overrides);

        return ['ok' => true];
    }

    /**
     * More photos of a slot: add, remove, move, frame or make one the main photo.
     * They share the frame, fit and corners of the main photo.
     */
    public function slides(Request $request): array
    {
        $id = (string) $request->input('id');
        if (! in_array($id, self::CAROUSEL, true)) {
            return ['error' => 'Esta sección no admite varias fotos.'];
        }
        $overrides = $this->overrides();
        $asset = $overrides[$id] ?? $this->originalAsset($request);
        if (! $asset) {
            return ['error' => 'Primero publica la foto principal de esta sección.'];
        }
        if (($asset['kind'] ?? 'image') !== 'image') {
            return ['error' => 'El carrusel es solo para fotos: cambia la foto principal a una imagen y publícala.'];
        }

        $slides = $this->cleanSlides($asset['slides'] ?? []);
        $index = (int) $request->input('index', -1);
        $intent = (string) $request->input('intent');
        if ($intent !== 'add' && ! isset($slides[$index])) {
            return ['error' => 'Esa foto ya no está en el carrusel. Recarga la página.'];
        }

        switch ($intent) {
            case 'add':
                if (count($slides) >= self::MAX_SLIDES) {
                    return ['error' => 'El carrusel admite hasta '.self::MAX_SLIDES.' fotos además de la principal.'];
                }
                $file = $request->file('file');
                if (! $file instanceof UploadedFile || ! $this->extension($file, 'image')) {
                    return ['error' => 'La foto debe ser JPG, PNG, WebP, GIF o AVIF.'];
                }
                if ($file->getSize() > self::SLIDE_MAX_BYTES) {
                    return ['error' => 'Cada foto puede pesar hasta 12 MB.'];
                }
                $slides[] = ['src' => $this->store($file, $id.':carrusel', 'image'), 'alt' => '', 'posX' => 50, 'posY' => 50, 'zoom' => 100];
                break;
            case 'remove':
                MediaLibrary::deletePublic($slides[$index]['src']);
                array_splice($slides, $index, 1);
                break;
            case 'move':
                $to = $index + ($request->input('direction') === 'left' ? -1 : 1);
                if (isset($slides[$to])) {
                    [$slides[$index], $slides[$to]] = [$slides[$to], $slides[$index]];
                }
                break;
            case 'frame':
                $slides[$index] = [
                    ...$slides[$index],
                    'alt' => Str::limit((string) $request->input('alt'), 160, ''),
                    'posX' => max(0, min(100, (int) $request->input('posX', 50))),
                    'posY' => max(0, min(100, (int) $request->input('posY', 50))),
                    'zoom' => max(100, min(220, (int) $request->input('zoom', 100))),
                ];
                break;
            case 'promote':
                $main = ['src' => $asset['src'], 'alt' => (string) ($asset['alt'] ?? ''), 'posX' => (int) ($asset['posX'] ?? 50), 'posY' => (int) ($asset['posY'] ?? 50), 'zoom' => (int) ($asset['zoom'] ?? 100)];
                $asset = [...$asset, ...$slides[$index]];
                $slides[$index] = $main;
                break;
            default:
                return ['error' => 'Acción no reconocida.'];
        }

        $asset['slides'] = array_values($slides);
        if (! $asset['slides']) {
            unset($asset['slides']);
        }
        $overrides[$id] = $asset;
        $this->persist($overrides);

        return ['ok' => true];
    }

    /**
     * The slot still shows its original photo: it becomes the main photo of the carousel,
     * but only when it is one of the site's own images.
     */
    private function originalAsset(Request $request): ?array
    {
        $src = (string) $request->input('base_src');
        if (! preg_match('#^/images/[A-Za-z0-9][A-Za-z0-9_\-/]*\.(jpe?g|png|webp|avif)$#i', $src) || ! MediaLibrary::validKey(ltrim($src, '/'))) {
            return null;
        }

        return [
            'kind' => 'image',
            'src' => $src,
            'poster' => '',
            'alt' => Str::limit((string) $request->input('base_alt'), 160, ''),
            'ratio' => (string) $request->input('base_ratio', 'natural'),
            'fit' => (string) $request->input('base_fit', 'fill'),
            'posX' => (int) $request->input('base_posX', 50),
            'posY' => (int) $request->input('base_posY', 50),
            'zoom' => (int) $request->input('base_zoom', 100),
            'radius' => (int) $request->input('base_radius', 24),
            'feather' => (int) $request->input('base_feather', 0),
        ];
    }

    /** @return list<array{src: string, alt: string, posX: int, posY: int, zoom: int}> */
    private function cleanSlides(mixed $slides): array
    {
        return collect(is_array($slides) ? $slides : [])
            ->filter(fn ($slide) => is_array($slide) && is_string($slide['src'] ?? null) && $slide['src'] !== '')
            ->map(fn (array $slide) => [
                'src' => $slide['src'],
                'alt' => (string) ($slide['alt'] ?? ''),
                'posX' => (int) ($slide['posX'] ?? 50),
                'posY' => (int) ($slide['posY'] ?? 50),
                'zoom' => (int) ($slide['zoom'] ?? 100),
            ])
            ->values()
            ->all();
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
        return MediaLibrary::extension($file, self::ALLOWED[$kind] ?? []);
    }

    private function store(UploadedFile $file, string $id, string $kind): string
    {
        return MediaLibrary::storePublic($file, 'medios/site/'.str_replace(':', '/', $id), $this->extension($file, $kind));
    }
}
