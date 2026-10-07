<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Media\Actions\ManageSiteMedia;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Photos and videos of each slot of the public site. */
class SiteMediaController extends Controller
{
    public function medios(Request $request): Response
    {
        return Inertia::render('Admin/Medios', [
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'ministries' => collect(LoadPublicSite::ministries())->map(fn ($item) => ['slug' => $item['slug'], 'name' => $item['name']])->all(),
        ]);
    }

    public function saveMedia(Request $request, ManageSiteMedia $media): JsonResponse
    {
        return response()->json($media->save($request));
    }

    public function saveSlides(Request $request, ManageSiteMedia $media): JsonResponse
    {
        return response()->json($media->slides($request));
    }
}
