<?php

namespace App\Http\Controllers\Web;

use App\Domain\Geo\GeoDirectory;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class GeoController extends Controller
{
    public function countries(): JsonResponse
    {
        return $this->cached(GeoDirectory::countries());
    }

    public function regions(string $country): JsonResponse
    {
        return $this->cached(GeoDirectory::regions($country));
    }

    public function cities(int $region): JsonResponse
    {
        return $this->cached(GeoDirectory::cities($region));
    }

    public function districts(int $city): JsonResponse
    {
        return $this->cached(GeoDirectory::districts($city));
    }

    private function cached(array $payload): JsonResponse
    {
        return response()->json($payload)->header('Cache-Control', 'public, max-age=86400');
    }
}
