<?php

use App\Http\Controllers\Auth\AccesoController;
use App\Http\Controllers\Web\FormsController;
use App\Http\Controllers\Web\RadioController;
use App\Http\Controllers\Web\SiteController;
use App\Http\Controllers\Web\StudiesController;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

Route::get('/', [SiteController::class, 'home'])->name('home');
Route::get('/marea', [SiteController::class, 'marea'])->name('marea');
Route::get('/conocenos', [SiteController::class, 'about'])->name('about');
Route::get('/ministerios', [SiteController::class, 'ministries'])->name('ministries');
Route::get('/ministerios/{slug}', [SiteController::class, 'ministry'])->name('ministry');
Route::get('/visita', [SiteController::class, 'visit'])->name('visit');
Route::post('/visita', [FormsController::class, 'storeVisit'])->middleware('throttle:web-forms');
Route::get('/bautismos', [SiteController::class, 'baptisms'])->name('baptisms');
Route::post('/bautismos', [FormsController::class, 'storeBaptism'])->middleware('throttle:web-forms');
Route::get('/predicas', [SiteController::class, 'sermons'])->name('sermons');
Route::get('/recursos', [SiteController::class, 'teachings'])->name('teachings');
Route::get('/galeria', [SiteController::class, 'galleries'])->name('galleries');
Route::get('/galeria/{slug}', [SiteController::class, 'gallery'])->where('slug', '[a-z0-9-]+')->name('gallery');
Route::get('/devocionales', [SiteController::class, 'devotionals'])->name('devotionals');
Route::get('/devocionales/{slug}', [SiteController::class, 'devotional'])->where('slug', '[a-z0-9-]+')->name('devotional');
Route::get('/eventos', [SiteController::class, 'events'])->name('events');
Route::get('/involucrate', [SiteController::class, 'serve'])->name('serve');
Route::post('/involucrate', [FormsController::class, 'storeServe'])->middleware('throttle:web-forms');
Route::get('/involucrate/{slug}', [SiteController::class, 'serveArea'])->where('slug', '[a-z0-9-]+')->name('serve-area');
Route::get('/ruta-del-servidor', [StudiesController::class, 'route'])->name('server-route');
Route::redirect('/estudios', '/ruta-del-servidor');
Route::get('/estudios/acceso', [StudiesController::class, 'login'])->name('studies.login');
Route::post('/estudios/acceso', [StudiesController::class, 'authenticate']);
Route::middleware(EnsureRole::class.':student')->group(function () {
    Route::get('/estudios/mi-ruta', [StudiesController::class, 'classroom'])->name('studies.classroom');
    Route::post('/estudios/clave', [StudiesController::class, 'password']);
});
Route::get('/radio', [RadioController::class, 'page'])->name('radio');
Route::middleware('throttle:radio')->prefix('radio')->group(function () {
    Route::get('/estado', [RadioController::class, 'state']);
    Route::post('/voz', [RadioController::class, 'voice']);
    Route::post('/voz/respuesta', [RadioController::class, 'answer']);
    Route::post('/salir', [RadioController::class, 'leave']);
});
Route::get('/dar', [SiteController::class, 'give'])->name('give');
Route::get('/contacto', [SiteController::class, 'contact'])->name('contact');
Route::post('/contacto', [FormsController::class, 'storePrayer'])->middleware('throttle:web-forms');

Route::get('/ingresar', fn () => redirect('/acceso'));
Route::get('/acceso', [AccesoController::class, 'create'])->name('login');
Route::post('/acceso', [AccesoController::class, 'store']);
Route::post('/salir', [AccesoController::class, 'destroy'])->name('logout');
