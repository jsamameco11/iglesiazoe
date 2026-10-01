<?php

use App\Http\Controllers\Portal\PortalController;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', EnsureRole::class.':leader'])->prefix('portal')->group(function () {
    Route::get('/', fn () => redirect('/portal/informe'));
    Route::middleware(EnsurePermission::class.':reports.submit')->group(function () {
        Route::get('/informe', [PortalController::class, 'informe']);
        Route::get('/informe/cargar', [PortalController::class, 'loadInforme']);
        Route::post('/informe', [PortalController::class, 'saveInforme']);
        Route::post('/informe/integrante', [PortalController::class, 'addParticipant']);
    });
    Route::get('/historial', [PortalController::class, 'historial'])->middleware(EnsurePermission::class.':reports.submit,reports.all');
    Route::get('/seguimiento', [PortalController::class, 'seguimiento'])->middleware(EnsurePermission::class.':reports.weekly,reports.all');
    Route::get('/temas', [PortalController::class, 'themes'])->middleware(EnsurePermission::class.':reports.submit,content.manage,themes.manage');
});
