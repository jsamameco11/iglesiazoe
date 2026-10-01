<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Access\Permissions;
use App\Domain\Auth\Actions\AuthenticateLeader;
use App\Domain\Reports\Support\WeekCalendar;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AccesoController extends Controller
{
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    public function create(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $preview = $user && $request->query('vista') === 'indicaciones' && Permissions::has($user, 'notices.manage');
        if ($user && ! $preview) {
            return redirect()->to($this->destination($request, $user));
        }

        $notice = LoadPublicSite::weeklyNotice();
        $visible = $notice['points'] && ($notice['enabled'] || $preview);

        return Inertia::render('Acceso', [
            'next' => $request->query('next'),
            'skin' => 'aire',
            'notice' => $visible ? [
                ...Arr::except($notice, ['updated_by']),
                'period' => $notice['period'] ?: WeekCalendar::currentLabel(),
            ] : null,
            'preview' => $preview ? ['enabled' => (bool) $notice['enabled']] : null,
        ]);
    }

    public function store(Request $request, AuthenticateLeader $authenticate): RedirectResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $key = 'acceso:'.Str::lower($request->string('username')->trim()->toString()).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'username' => "Demasiados intentos. Vuelve a intentarlo en {$seconds} segundos.",
            ]);
        }

        $user = $authenticate->attempt(
            $request->string('username')->toString(),
            $request->string('password')->toString(),
        );

        if (! $user) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            throw ValidationException::withMessages([
                'username' => 'Usuario o clave incorrectos.',
            ]);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->to($this->destination($request, $user));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    private function destination(Request $request, $user): string
    {
        $next = (string) $request->input('next', $request->query('next', ''));
        if ($next !== '' && str_starts_with($next, '/') && ! str_starts_with($next, '//')) {
            return $next;
        }

        return AuthenticateLeader::home($user);
    }
}
