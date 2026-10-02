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
Route::post('/visita', [SiteController::class, 'storeVisit'])->middleware('throttle:web-forms');
Route::post('/visita/aviso', [SiteController::class, 'storeQuickVisit'])->middleware('throttle:web-forms');
Route::get('/bautismos', [SiteController::class, 'baptisms'])->name('baptisms');
Route::post('/bautismos', [SiteController::class, 'storeBaptism'])->middleware('throttle:web-forms');
Route::get('/predicas', [SiteController::class, 'sermons'])->name('sermons');
Route::get('/recursos', [SiteController::class, 'teachings'])->name('teachings');
Route::get('/galeria', [SiteController::class, 'galleries'])->name('galleries');
Route::get('/galeria/{slug}', [SiteController::class, 'gallery'])->where('slug', '[a-z0-9-]+')->name('gallery');
Route::get('/devocionales', [SiteController::class, 'devotionals'])->name('devotionals');
Route::get('/devocionales/{slug}', [SiteController::class, 'devotional'])->where('slug', '[a-z0-9-]+')->name('devotional');
Route::get('/eventos', [SiteController::class, 'events'])->name('events');
Route::get('/involucrate', [SiteController::class, 'serve'])->name('serve');
Route::post('/involucrate', [SiteController::class, 'storeServe'])->middleware('throttle:web-forms');
Route::get('/involucrate/{slug}', [SiteController::class, 'serveArea'])->where('slug', '[a-z0-9-]+')->name('serve-area');
Route::get('/ruta-del-servidor', [SiteController::class, 'serverRoute'])->name('server-route');
Route::get('/dar', [SiteController::class, 'give'])->name('give');
Route::get('/contacto', [SiteController::class, 'contact'])->name('contact');
Route::post('/contacto', [SiteController::class, 'storePrayer'])->middleware('throttle:web-forms');

Route::get('/ingresar', fn () => redirect('/acceso'));
Route::get('/acceso', [AccesoController::class, 'create'])->name('login');
Route::post('/acceso', [AccesoController::class, 'store']);
Route::post('/salir', [AccesoController::class, 'destroy'])->name('logout');
