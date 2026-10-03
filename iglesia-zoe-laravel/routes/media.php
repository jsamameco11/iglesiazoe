<?php

use App\Http\Controllers\Web\MediaController;
use App\Http\Controllers\Web\SiteVersionController;
use Illuminate\Support\Facades\Route;

// Loaded without the web middleware: no session or cookies, so browsers can cache the redirects
// and open tabs can ask for the site version without touching the session.
Route::get('/media/{path}', [MediaController::class, 'show'])->where('path', '.+');
Route::get('/images/{path}', [MediaController::class, 'images'])->where('path', '.+');
Route::get('/videos/{path}', [MediaController::class, 'videos'])->where('path', '.+');
Route::get('/site-version', SiteVersionController::class);
