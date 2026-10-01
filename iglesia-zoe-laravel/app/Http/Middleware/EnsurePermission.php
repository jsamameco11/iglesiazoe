<?php

namespace App\Http\Middleware;

use App\Domain\Access\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (Permissions::any($request->user(), $permissions)) {
            return $next($request);
        }

        return $request->expectsJson()
            ? response()->json(['error' => 'Tu cuenta no tiene este acceso. Pídelo al SUPERADMI.'], 403)
            : redirect('/admin')->with('denied', true);
    }
}
