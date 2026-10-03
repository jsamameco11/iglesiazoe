<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Auth\Support\Entrance;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Design\NormalizeDesign;
use App\Http\Controllers\Controller;
use App\Models\Devotional;
use App\Models\ServiceGallery;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DesignController extends Controller
{
    private const FOLDER = 'medios/diseno';

    public function index(): Response
    {
        return Inertia::render('Admin/Diseno', [
            'stored' => LoadPublicSite::design(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'fonts' => collect(config('design.fonts'))->map(fn ($font) => [...$font, 'local' => (bool) ($font['local'] ?? false)])->values(),
            'fontCategories' => collect(config('design.font_categories'))->map(fn ($category, $key) => [
                'key' => $key,
                ...$category,
                'count' => collect(config('design.fonts'))->where('category', $key)->count(),
            ])->values(),
            'pages' => $this->pages(),
            'art' => collect(config('design.art'))->map(fn ($spec, $key) => [
                'key' => $key,
                'label' => $spec['label'],
                'text' => $spec['text'],
                'page' => $spec['page'],
                'canHide' => $spec['can_hide'],
                'colors' => collect($spec['colors'])->map(fn ($color, $slot) => ['key' => $slot, ...$color])->values(),
            ])->values(),
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $input = json_decode((string) $request->input('design', '{}'), true);
        if (! is_array($input)) {
            return $this->fail('No se pudo leer el diseño.');
        }
        $before = NormalizeDesign::files($this->published());
        $design = NormalizeDesign::run($input);
        SiteSetting::query()->updateOrCreate(['key' => 'design'], ['value' => $design, 'updated_at' => now()]);
        $this->forget(array_diff($before, NormalizeDesign::files($design)));
        $this->sweep(NormalizeDesign::files($design));

        return response()->json(['ok' => true, 'message' => 'Diseño publicado en la web.', 'design' => $design]);
    }

    public function reset(): JsonResponse
    {
        $files = NormalizeDesign::files($this->published());
        SiteSetting::query()->where('key', 'design')->delete();
        LoadPublicSite::flush();
        $this->forget($files);

        return $this->saved('Se restauró el diseño original.');
    }

    /** Uploads a picture, GIF or video for a page or band background; it shows on the site once the design is published. */
    public function upload(Request $request): JsonResponse
    {
        $file = $request->file('file');
        $extension = MediaLibrary::extension($file, [...NormalizeDesign::IMAGES, ...NormalizeDesign::VIDEOS]);
        $kind = in_array($extension, NormalizeDesign::IMAGES, true) ? 'image' : (in_array($extension, NormalizeDesign::VIDEOS, true) ? 'video' : null);
        if (! $kind) {
            return $this->fail('Sube una imagen (JPG, PNG, WebP, GIF o AVIF) o un video (MP4, WebM o MOV).');
        }
        $limit = $kind === 'video' ? 60 : 12;
        if ($file->getSize() > $limit * 1024 * 1024) {
            return $this->fail(($kind === 'video' ? 'El video' : 'La imagen').' pesa más de '.$limit.' MB.');
        }

        return response()->json(['ok' => true, 'kind' => $kind, 'src' => MediaLibrary::storePublic($file, self::FOLDER, $extension)]);
    }

    private function published(): array
    {
        $stored = SiteSetting::query()->where('key', 'design')->first()?->value;

        return is_array($stored) ? $stored : [];
    }

    /** Uploads left behind by discarded drafts; a day of grace keeps files another open editor may still publish. */
    private function sweep(array $keep): void
    {
        try {
            $disk = MediaLibrary::publicDisk();
            $limit = now()->subDay()->getTimestamp();
            foreach ($disk->files(self::FOLDER) as $key) {
                if (! in_array(MediaLibrary::PUBLIC_PREFIX.$key, $keep, true) && $disk->lastModified($key) < $limit) {
                    $disk->delete($key);
                }
            }
        } catch (\Throwable $error) {
            report($error);
        }
    }

    /** Deletes background files the design no longer uses; files of the photo library stay. */
    private function forget(array $files): void
    {
        foreach ($files as $file) {
            if (str_starts_with((string) MediaLibrary::keyOf($file), self::FOLDER.'/')) {
                MediaLibrary::deletePublic($file);
            }
        }
    }

    /** Editable pages with the address the live preview opens; detail pages use their first published item. */
    private function pages(): array
    {
        $slugs = [
            'ministry' => fn () => collect(LoadPublicSite::ministries())->value('slug'),
            'serve' => fn () => collect(LoadPublicSite::serveAreas())->value('slug'),
            'devotional' => fn () => Devotional::published()->value('slug'),
            'gallery' => fn () => ServiceGallery::query()->where('active', true)->get()->first(fn ($gallery) => $gallery->photoList() !== [])?->slug,
        ];

        return collect(config('design.pages'))->map(function ($page, $key) use ($slugs) {
            $path = $page['path'];
            if (isset($page['slug'])) {
                $slug = $slugs[$page['slug']]();
                $path = $slug ? str_replace('{slug}', $slug, $path) : null;
            }
            $base = ($page['host'] ?? 'site') === 'admin' ? Entrance::adminUrl() : Entrance::siteUrl();

            return ['key' => $key, 'label' => $page['label'], 'url' => $path ? $base.$path : null];
        })->values()->all();
    }
}
