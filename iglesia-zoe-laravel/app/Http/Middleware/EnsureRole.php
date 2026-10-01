<?php

namespace App\Http\Middleware;

use App\Domain\Access\Permissions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string $gate = 'leader'): Response
    {
        $user = $request->user();
        if (! $user) {
            return redirect('/acceso?next='.urlencode($request->getRequestUri()));
        }

        if ($user->active === false) {
            Auth::logout();
            $request->session()->invalidate();

            return redirect('/acceso');
        }

        if ($gate === 'superadmin' && ! Permissions::isSuperadmin($user)) {
            return $request->expectsJson()
                ? response()->json(['error' => 'Solo el SUPERADMI puede hacer esto.'], 403)
                : redirect('/admin');
        }

        return $next($request);
    }
}
