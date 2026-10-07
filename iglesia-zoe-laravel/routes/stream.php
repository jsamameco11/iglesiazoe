<?php

use App\Http\Controllers\Web\LiveController;
use Illuminate\Support\Facades\Route;

// Loaded without the web middleware: the media server asks with no session or CSRF token,
// and every open tab polls the live state without touching the session.
Route::post('/transmision/servidor/autorizar', [LiveController::class, 'publisher'])->middleware('throttle:60,1');
Route::get('/en-vivo/estado', [LiveController::class, 'state']);
