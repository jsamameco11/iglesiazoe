<?php

namespace App\Http\Middleware;

use App\Domain\Auth\Support\Entrance;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps each host to its own audience: the admin site has no public pages,
 * and a session only lives on the door its account belongs to.
 */
class EnsureEntrance
{
    private const PUBLIC_PAGES = ['home', 'marea', 'about', 'ministries', 'ministry', 'visit', 'baptisms', 'sermons', 'give', 'contact'];

    public function handle(Request $request, Closure $next): Response
    {
        $adminHost = Entrance::isAdminHost($request);

        if ($adminHost && $request->isMethod('GET') && $request->routeIs(...self::PUBLIC_PAGES)) {
            return $request->routeIs('home')
                ? redirect('/acceso')
                : redirect()->away(Entrance::siteUrl($request->getRequestUri()));
        }

        $user = $request->user();
        if ($user && ! $request->routeIs('logout') && ! Entrance::fits($user, $request)) {
            $target = Entrance::loginUrlFor($user);
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            if ($request->header('X-Inertia')) {
                return Inertia::location($target);
            }

            return $request->expectsJson()
                ? response()->json(['error' => 'Tu cuenta ingresa por otra página.', 'redirect' => $target], 409)
                : redirect()->away($target);
        }

        return $next($request);
    }
}
