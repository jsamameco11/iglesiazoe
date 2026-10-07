<?php

use App\Http\Controllers\Auth\AccesoController;
use App\Http\Controllers\Web\FormsController;
use App\Http\Controllers\Web\GameRoomsController;
use App\Http\Controllers\Web\GamesController;
use App\Http\Controllers\Web\NotificationsController;
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
Route::get('/devocionales/{slug}/imagen', [SiteController::class, 'devotionalImage'])->where('slug', '[a-z0-9-]+')->name('devotional.image');
Route::get('/eventos', [SiteController::class, 'events'])->name('events');
Route::get('/involucrate', [SiteController::class, 'serve'])->name('serve');
Route::post('/involucrate', [FormsController::class, 'storeServe'])->middleware('throttle:web-forms');
Route::get('/involucrate/{slug}', [SiteController::class, 'serveArea'])->where('slug', '[a-z0-9-]+')->name('serve-area');
Route::get('/ruta-del-servidor', [StudiesController::class, 'route'])->name('server-route');
Route::redirect('/estudios', '/ruta-del-servidor');
Route::redirect('/en-vivo', '/predicas#en-vivo');
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
    Route::post('/fallo', [RadioController::class, 'failed']);
});
Route::prefix('juegos')->group(function () {
    Route::get('/', [GamesController::class, 'index'])->name('games');
    Route::get('/rebet', [GamesController::class, 'rebet'])->name('games.rebet');
    Route::get('/lingobible', [GamesController::class, 'lingobible'])->name('games.lingobible');
    Route::get('/lingobible/{slug}', [GamesController::class, 'lingoPath'])->where('slug', '[a-z0-9-]+')->name('games.lingobible.path');
    Route::get('/lingobible/{slug}/{lesson}', [GamesController::class, 'lingoLesson'])->where(['slug' => '[a-z0-9-]+', 'lesson' => '[0-9a-f-]{36}'])->name('games.lingobible.lesson');
    Route::get('/el-cristiano-oculto', [GamesController::class, 'oculto'])->name('games.oculto');
    Route::get('/sala/{code}', [GamesController::class, 'room'])->where('code', '[A-Za-z0-9]{3,12}')->name('games.room');

    Route::middleware('throttle:games')->group(function () {
        Route::get('/rebet/preguntas', [GamesController::class, 'rebetQuestions']);
        Route::post('/rebet/responder', [GamesController::class, 'rebetAnswer']);
        Route::post('/lingobible/responder', [GamesController::class, 'lingoAnswer']);
        Route::get('/el-cristiano-oculto/palabra', [GamesController::class, 'ocultoWord']);
        Route::post('/salas', [GameRoomsController::class, 'create']);
        Route::post('/salas/{code}/entrar', [GameRoomsController::class, 'join'])->where('code', '[A-Za-z0-9]{3,12}');
        Route::get('/salas/{code}', [GameRoomsController::class, 'state'])->where('code', '[A-Za-z0-9]{3,12}');
        Route::post('/salas/{code}', [GameRoomsController::class, 'act'])->where('code', '[A-Za-z0-9]{3,12}');
    });
});
Route::get('/dar', [SiteController::class, 'give'])->name('give');
Route::get('/contacto', [SiteController::class, 'contact'])->name('contact');
Route::post('/contacto', [FormsController::class, 'storePrayer'])->middleware('throttle:web-forms');
Route::middleware('throttle:30,1')->prefix('notificaciones')->group(function () {
    Route::get('/clave', [NotificationsController::class, 'key']);
    Route::post('/', [NotificationsController::class, 'subscribe']);
    Route::post('/quitar', [NotificationsController::class, 'unsubscribe']);
});

Route::get('/ingresar', fn () => redirect('/acceso'));
Route::get('/acceso', [AccesoController::class, 'create'])->name('login');
Route::post('/acceso', [AccesoController::class, 'store']);
Route::post('/salir', [AccesoController::class, 'destroy'])->name('logout');
