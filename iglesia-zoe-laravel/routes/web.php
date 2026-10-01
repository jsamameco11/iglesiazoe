<?php

use App\Http\Controllers\Auth\AccesoController;
use App\Http\Controllers\Web\SiteController;
use Illuminate\Support\Facades\Route;

Route::get('/', [SiteController::class, 'home'])->name('home');
Route::get('/marea', [SiteController::class, 'marea'])->name('marea');
Route::get('/conocenos', [SiteController::class, 'about'])->name('about');
Route::get('/ministerios', [SiteController::class, 'ministries'])->name('ministries');
Route::get('/ministerios/{slug}', [SiteController::class, 'ministry'])->name('ministry');
Route::get('/visita', [SiteController::class, 'visit'])->name('visit');
Route::post('/visita', [SiteController::class, 'storeVisit']);
Route::get('/bautismos', [SiteController::class, 'baptisms'])->name('baptisms');
Route::post('/bautismos', [SiteController::class, 'storeBaptism']);
Route::get('/predicas', [SiteController::class, 'sermons'])->name('sermons');
Route::get('/dar', [SiteController::class, 'give'])->name('give');
Route::get('/contacto', [SiteController::class, 'contact'])->name('contact');
Route::post('/contacto', [SiteController::class, 'storePrayer']);

Route::get('/ingresar', fn () => redirect('/acceso'));
Route::get('/acceso', [AccesoController::class, 'create'])->name('login');
Route::post('/acceso', [AccesoController::class, 'store']);
Route::post('/salir', [AccesoController::class, 'destroy'])->name('logout');
