<?php

namespace App\Http\Middleware;

use App\Domain\Site\Support\SiteVersion;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Moves the site version after every successful change to what the public site shows. */
class BumpSiteVersion
{
    /** Admin sections whose changes visitors see on the public site. */
    private const SECTIONS = [
        'bautismos', 'contenido', 'devocionales', 'diseno', 'estudios', 'eventos', 'galeria',
        'indicaciones', 'involucrate', 'medios', 'ministerios', 'predicas', 'recursos', 'textos',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        if (! $request->isMethodSafe() && $response->getStatusCode() < 400 && $this->editsSite($request)) {
            SiteVersion::bump();
        }

        return $response;
    }

    private function editsSite(Request $request): bool
    {
        return $request->segment(1) === 'admin' && in_array($request->segment(2), self::SECTIONS, true);
    }
}
