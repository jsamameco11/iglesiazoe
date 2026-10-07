<?php

namespace App\Providers;

use App\Domain\Shared\Support\PostgresConnector;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind('db.connector.pgsql', PostgresConnector::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('web-forms', fn (Request $request) => Limit::perMinute(6)->by($request->ip())
            ->response(fn () => response()->json(['error' => 'Recibimos varios envíos seguidos. Espera un minuto e inténtalo otra vez.'], 429)));
        RateLimiter::for('radio', fn (Request $request) => Limit::perMinute(150)->by($request->ip().'|'.$request->input('oyente', $request->query('oyente'))));
        RateLimiter::for('games', fn (Request $request) => Limit::perMinute(180)->by($request->ip().'|'.$request->header('X-Game-Token'))
            ->response(fn () => response()->json(['error' => 'Demasiados intentos seguidos. Espera unos segundos.'], 429)));
    }
}
