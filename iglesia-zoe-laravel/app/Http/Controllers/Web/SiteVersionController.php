<?php

namespace App\Http\Controllers\Web;

use App\Domain\Site\Support\SiteVersion;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class SiteVersionController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['version' => SiteVersion::current()])->header('Cache-Control', 'no-store');
    }
}
