<?php

namespace App\Http\Controllers\Web;

use App\Domain\Access\Permissions;
use App\Domain\Auth\Actions\AuthenticateLeader;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Domain\Studies\Classroom;
use App\Http\Controllers\Controller;
use App\Models\StudyLevel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StudiesController extends Controller
{
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    public function route(Request $request): Response
    {
        return Inertia::render('ServerRoute', [
            ...$this->shared($request),
            'studyLevels' => StudyLevel::ordered()->where('active', true)->get()->map->card()->all(),
        ]);
    }

    public function login(Request $request): Response|RedirectResponse
    {
        if (Permissions::isStudent($request->user())) {
            return redirect('/estudios/mi-ruta');
        }

        return Inertia::render('Estudios/Acceso', [
            ...$this->shared($request),
            'levels' => StudyLevel::ordered()->where('active', true)->pluck('name'),
        ]);
    }

    public function authenticate(Request $request, AuthenticateLeader $authenticate): RedirectResponse
    {
        $request->validate([
            'username' => 'required|string|max:80',
            'password' => 'required|string|max:120',
        ], [
            'username.required' => 'Escribe tu DNI o usuario.',
            'password.required' => 'Escribe tu clave.',
        ]);

        $key = 'estudios:'.Str::lower($request->string('username')->trim()->toString()).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            throw ValidationException::withMessages(['username' => 'Demasiados intentos. Vuelve a intentarlo en '.RateLimiter::availableIn($key).' segundos.']);
        }

        $user = $authenticate->attempt($request->string('username')->toString(), $request->string('password')->toString());
        if (! $user) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            throw ValidationException::withMessages(['username' => 'DNI o clave incorrectos.']);
        }
        if (! Permissions::isStudent($user)) {
            throw ValidationException::withMessages(['username' => 'Esta cuenta no es de estudiante. Si eres servidor o administrador, ingresa desde «Acceso al sistema».']);
        }

        RateLimiter::clear($key);
        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect('/estudios/mi-ruta');
    }

    public function classroom(Request $request): Response
    {
        return Inertia::render('Estudios/MiRuta', [
            ...Classroom::for($request->user()),
            'today' => now(StudyLevel::TIMEZONE)->toDateString(),
        ]);
    }

    public function password(Request $request): JsonResponse
    {
        $user = $request->user();
        $current = (string) $request->input('current');
        $password = (string) $request->input('password');
        if (! Hash::check($current, $user->password)) {
            return response()->json(['error' => 'Tu clave actual no es correcta.'], 422);
        }
        if (mb_strlen($password) < 6) {
            return response()->json(['error' => 'La nueva clave debe tener al menos 6 caracteres.'], 422);
        }
        if ($password !== (string) $request->input('confirm')) {
            return response()->json(['error' => 'Las dos claves nuevas no coinciden.'], 422);
        }
        $user->password = $password;
        $user->save();

        return response()->json(['ok' => true, 'message' => 'Listo, tu clave fue actualizada.']);
    }

    private function shared(Request $request): array
    {
        return [
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'serveAreas' => LoadPublicSite::serveAreas(),
            'mediaOverrides' => LoadPublicSite::mediaOverrides(),
            'skin' => ResolveSiteSkin::fromRequest($request),
        ];
    }
}
