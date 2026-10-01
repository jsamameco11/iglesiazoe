<?php

use App\Http\Controllers\Web\MediaController;
use Illuminate\Support\Facades\Route;

// Loaded without the web middleware: no session or cookies, so browsers can cache the redirects.
Route::get('/media/{path}', [MediaController::class, 'show'])->where('path', '.+');
Route::get('/images/{path}', [MediaController::class, 'images'])->where('path', '.+');
Route::get('/videos/{path}', [MediaController::class, 'videos'])->where('path', '.+');
