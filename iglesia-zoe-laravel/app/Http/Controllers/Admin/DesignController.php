<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Auth\Support\Entrance;
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
    public function index(): Response
    {
        return Inertia::render('Admin/Diseno', [
            'stored' => LoadPublicSite::design(),
            'fonts' => collect(config('design.fonts'))->map(fn ($font) => [...$font, 'local' => (bool) ($font['local'] ?? false)])->values(),
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
            return response()->json(['error' => 'No se pudo leer el diseño.'], 422);
        }
        $design = NormalizeDesign::run($input);
        SiteSetting::query()->updateOrCreate(['key' => 'design'], ['value' => $design, 'updated_at' => now()]);

        return response()->json(['ok' => true, 'message' => 'Diseño publicado en la web.', 'design' => $design]);
    }

    public function reset(): JsonResponse
    {
        SiteSetting::query()->where('key', 'design')->delete();
        LoadPublicSite::flush();

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Se restauró el diseño original.']);
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
