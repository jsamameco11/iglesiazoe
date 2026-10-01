<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
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
            'fonts' => config('design.fonts'),
            'pages' => collect(config('design.pages'))->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $input = json_decode((string) $request->input('design', '{}'), true);
        if (! is_array($input)) {
            return response()->json(['error' => 'No se pudo leer el diseño.'], 422);
        }
        $design = LoadPublicSite::normalizeDesign($input);
        SiteSetting::query()->updateOrCreate(['key' => 'design'], ['value' => $design, 'updated_at' => now()]);
        $site = LoadPublicSite::settings();
        $site['paperColor'] = $design['palette']['paper'];
        $site['headingColor'] = $design['palette']['ink'];
        $site['bodyColor'] = $design['palette']['muted'];
        $site['accentColor'] = $design['palette']['accent'];
        $site['stoneColor'] = $design['palette']['stone'];
        $site['clayColor'] = $design['palette']['clay'];
        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $site, 'updated_at' => now()]);

        return response()->json(['ok' => true, 'message' => 'Diseño publicado en la web.', 'design' => $design]);
    }

    public function reset(): JsonResponse
    {
        SiteSetting::query()->where('key', 'design')->delete();
        $site = LoadPublicSite::settings();
        foreach (['headingColor', 'bodyColor', 'accentColor', 'paperColor', 'stoneColor', 'clayColor'] as $key) {
            $site[$key] = config("zoe.settings.$key");
        }
        SiteSetting::query()->updateOrCreate(['key' => 'site'], ['value' => $site, 'updated_at' => now()]);

        return response()->json(['ok' => true, 'reload' => true, 'message' => 'Se restauró el diseño original.']);
    }
}
