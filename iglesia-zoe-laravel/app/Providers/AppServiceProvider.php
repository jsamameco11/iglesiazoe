<?php

namespace App\Providers;

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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('web-forms', fn (Request $request) => Limit::perMinute(6)->by($request->ip())
            ->response(fn () => response()->json(['error' => 'Recibimos varios envíos seguidos. Espera un minuto e inténtalo otra vez.'], 429)));
    }
}
