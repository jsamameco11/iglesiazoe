<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\DesignController;
use App\Http\Controllers\Admin\ExpensesController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\NoticeController;
use App\Http\Controllers\Admin\ReportsController;
use App\Http\Controllers\Admin\ServersController;
use App\Http\Controllers\Admin\TeamController;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

$can = fn (string ...$permissions) => EnsurePermission::class.':'.implode(',', $permissions);

Route::middleware(['auth', EnsureRole::class.':staff'])->prefix('admin')->group(function () use ($can) {
    Route::get('/', [AdminController::class, 'dashboard'])->name('admin.home');

    Route::middleware($can('content.manage'))->group(function () {
        Route::get('/contenido', [AdminController::class, 'contenido']);
        Route::get('/ministerios', [AdminController::class, 'ministerios']);
        Route::post('/ministerios', [AdminController::class, 'saveMinistry']);
        Route::get('/predicas', [AdminController::class, 'predicas']);
        Route::post('/predicas', [AdminController::class, 'saveSermon']);
        Route::post('/predicas/eliminar', [AdminController::class, 'deleteSermon']);
        Route::get('/bautismos', [AdminController::class, 'bautismos']);
        Route::post('/bautismos', [AdminController::class, 'saveBaptism']);
        Route::get('/temas', [AdminController::class, 'temas']);
        Route::post('/temas', [AdminController::class, 'uploadTheme']);
        Route::post('/temas/ocultar', [AdminController::class, 'hideTheme']);
        Route::get('/bandeja', [AdminController::class, 'bandeja']);
    });
    Route::post('/contenido', [AdminController::class, 'saveSettings'])->middleware($can('content.manage', 'generosity.manage'));
    Route::get('/generosidad', [AdminController::class, 'generosidad'])->middleware($can('generosity.manage'));

    Route::middleware($can('media.manage'))->group(function () {
        Route::get('/medios', [AdminController::class, 'medios']);
        Route::post('/medios', [AdminController::class, 'saveMedia']);
        Route::post('/medios/galeria', [AdminController::class, 'addGallery']);
    });

    Route::middleware($can('notices.manage'))->group(function () {
        Route::get('/indicaciones', [NoticeController::class, 'index']);
        Route::post('/indicaciones', [NoticeController::class, 'save']);
    });

    Route::middleware($can('design.manage'))->group(function () {
        Route::get('/diseno', [DesignController::class, 'index']);
        Route::post('/diseno', [DesignController::class, 'save']);
        Route::post('/diseno/restaurar', [DesignController::class, 'reset']);
    });

    Route::middleware($can('cells.manage'))->group(function () {
        Route::get('/celulas', [AdminController::class, 'celulas']);
        Route::post('/celulas', [AdminController::class, 'saveCell']);
        Route::post('/celulas/raiz', [AdminController::class, 'createRootCell']);
        Route::post('/celulas/completar', [AdminController::class, 'ensureSix']);
        Route::post('/celulas/hija', [AdminController::class, 'createDaughter']);
        Route::post('/celulas/integrante', [AdminController::class, 'addMember']);
        Route::post('/celulas/integrante/quitar', [AdminController::class, 'removeMember']);
    });

    Route::middleware($can('servers.create'))->group(function () {
        Route::get('/servidores', [ServersController::class, 'index']);
        Route::post('/servidores', [ServersController::class, 'storeRoot']);
        Route::post('/servidores/hijo', [ServersController::class, 'storeChild']);
    });

    Route::get('/informes', [ReportsController::class, 'index'])->middleware($can('reports.all'));
    Route::get('/ofrendas', [FinanceController::class, 'offerings'])->middleware($can('offerings.weekly'));

    Route::middleware($can('expenses.manage'))->group(function () {
        Route::get('/gastos', [ExpensesController::class, 'index']);
        Route::post('/gastos', [ExpensesController::class, 'store']);
        Route::post('/gastos/eliminar', [ExpensesController::class, 'destroy']);
        Route::get('/gastos/boleta/{id}', [ExpensesController::class, 'receipt'])->whereUuid('id');
    });

    Route::middleware(EnsureRole::class.':superadmin')->group(function () {
        Route::get('/finanzas', [FinanceController::class, 'index']);
        Route::get('/equipo', [TeamController::class, 'index']);
        Route::post('/equipo', [TeamController::class, 'store']);
        Route::post('/equipo/actualizar', [TeamController::class, 'update']);
        Route::post('/equipo/clave', [TeamController::class, 'password']);
        Route::post('/equipo/eliminar', [TeamController::class, 'destroy']);
    });

    Route::redirect('/usuarios', '/admin/equipo');
    Route::redirect('/accesos', '/admin/equipo');
});
