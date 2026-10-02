<?php

use App\Domain\Access\Permissions;
use App\Domain\Inbox\Inbox;
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\CellsController;
use App\Http\Controllers\Admin\DesignController;
use App\Http\Controllers\Admin\DevotionalsController;
use App\Http\Controllers\Admin\ExpensesController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\GalleriesController;
use App\Http\Controllers\Admin\InboxController;
use App\Http\Controllers\Admin\NoticeController;
use App\Http\Controllers\Admin\RadioController;
use App\Http\Controllers\Admin\ReportsController;
use App\Http\Controllers\Admin\SectionsController;
use App\Http\Controllers\Admin\ServersController;
use App\Http\Controllers\Admin\StudiesController;
use App\Http\Controllers\Admin\TeamController;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

$can = fn (string ...$permissions) => EnsurePermission::class.':'.implode(',', $permissions);

Route::middleware(['auth', EnsureRole::class.':staff'])->prefix('admin')->group(function () use ($can) {
    Route::get('/', [AdminController::class, 'dashboard'])->name('admin.home');

    Route::middleware($can('content.manage'))->group(function () {
        Route::get('/contenido', [AdminController::class, 'contenido']);
        Route::get('/textos', [AdminController::class, 'textos']);
        Route::post('/textos', [AdminController::class, 'saveTexts']);
        Route::get('/ministerios', [AdminController::class, 'ministerios']);
        Route::post('/ministerios', [AdminController::class, 'saveMinistry']);
        Route::post('/ministerios/orden', [AdminController::class, 'moveMinistry']);
        Route::post('/ministerios/eliminar', [AdminController::class, 'deleteMinistry']);
        Route::get('/predicas', [AdminController::class, 'predicas']);
        Route::post('/predicas', [AdminController::class, 'saveSermon']);
        Route::post('/predicas/eliminar', [AdminController::class, 'deleteSermon']);
        Route::get('/bautismos', [AdminController::class, 'bautismos']);
        Route::post('/bautismos', [AdminController::class, 'saveBaptism']);
        Route::get('/recursos', [SectionsController::class, 'recursos']);
        Route::post('/recursos', [SectionsController::class, 'saveTeaching']);
        Route::post('/recursos/eliminar', [SectionsController::class, 'deleteTeaching']);
        Route::get('/galeria', [GalleriesController::class, 'index']);
        Route::post('/galeria', [GalleriesController::class, 'save']);
        Route::post('/galeria/foto', [GalleriesController::class, 'upload']);
        Route::post('/galeria/foto/quitar', [GalleriesController::class, 'removePhoto']);
        Route::post('/galeria/portada', [GalleriesController::class, 'cover']);
        Route::post('/galeria/eliminar', [GalleriesController::class, 'destroy']);
        Route::get('/secciones', [SectionsController::class, 'secciones']);
        Route::get('/involucrate', [SectionsController::class, 'areas']);
        Route::post('/involucrate', [SectionsController::class, 'saveArea']);
        Route::post('/involucrate/orden', [SectionsController::class, 'moveArea']);
        Route::post('/involucrate/eliminar', [SectionsController::class, 'deleteArea']);
    });

    Route::middleware($can('events.manage', 'content.manage'))->group(function () {
        Route::get('/eventos', [SectionsController::class, 'eventos']);
        Route::post('/eventos', [SectionsController::class, 'saveEvent']);
        Route::post('/eventos/eliminar', [SectionsController::class, 'deleteEvent']);
    });

    Route::middleware($can('devotionals.manage', 'content.manage'))->group(function () {
        Route::get('/devocionales', [DevotionalsController::class, 'index']);
        Route::post('/devocionales', [DevotionalsController::class, 'save']);
        Route::post('/devocionales/eliminar', [DevotionalsController::class, 'destroy']);
    });

    Route::middleware($can('radio.manage'))->prefix('radio')->group(function () {
        Route::get('/', [RadioController::class, 'console']);
        Route::get('/programacion', [RadioController::class, 'schedule']);
        Route::post('/programacion', [RadioController::class, 'addBlocks']);
        Route::post('/programacion/editar', [RadioController::class, 'updateBlock']);
        Route::post('/programacion/quitar', [RadioController::class, 'deleteBlock']);
        Route::post('/programacion/vaciar', [RadioController::class, 'clearDay']);
        Route::post('/programacion/copiar', [RadioController::class, 'copyDay']);
        Route::get('/biblioteca', [RadioController::class, 'library']);
        Route::post('/biblioteca', [RadioController::class, 'saveTrack']);
        Route::post('/biblioteca/eliminar', [RadioController::class, 'deleteTrack']);
        Route::get('/ajustes', [RadioController::class, 'settings']);
        Route::post('/ajustes', [RadioController::class, 'saveSettings']);
        Route::post('/vivo', [RadioController::class, 'live']);
        Route::post('/efecto', [RadioController::class, 'fire']);
        Route::get('/senal', [RadioController::class, 'signal']);
        Route::post('/senal/oferta', [RadioController::class, 'offer']);
    });

    Route::middleware($can('studies.grades'))->prefix('estudios')->group(function () {
        Route::get('/', [StudiesController::class, 'levels']);
        Route::post('/niveles', [StudiesController::class, 'saveLevel']);
        Route::get('/estudiantes', [StudiesController::class, 'students']);
        Route::post('/estudiantes', [StudiesController::class, 'saveStudent']);
        Route::post('/estudiantes/eliminar', [StudiesController::class, 'deleteStudent']);
        Route::get('/notas', [StudiesController::class, 'grades']);
        Route::post('/notas', [StudiesController::class, 'saveGrades']);
        Route::post('/notas/evaluacion', [StudiesController::class, 'saveAssessment']);
        Route::post('/notas/evaluacion/eliminar', [StudiesController::class, 'deleteAssessment']);
    });

    Route::middleware($can('studies.board'))->prefix('estudios')->group(function () {
        Route::get('/avisos', [StudiesController::class, 'notices']);
        Route::post('/avisos', [StudiesController::class, 'saveNotice']);
        Route::post('/avisos/eliminar', [StudiesController::class, 'deleteNotice']);
        Route::get('/animo', [StudiesController::class, 'verses']);
        Route::post('/animo', [StudiesController::class, 'saveVerse']);
        Route::post('/animo/eliminar', [StudiesController::class, 'deleteVerse']);
        Route::get('/lecturas', [StudiesController::class, 'readings']);
        Route::post('/lecturas', [StudiesController::class, 'saveReading']);
        Route::post('/lecturas/eliminar', [StudiesController::class, 'deleteReading']);
    });

    Route::middleware($can(...Permissions::INBOX))->group(function () {
        Route::get('/formularios', [InboxController::class, 'home']);
        Route::get('/formularios/novedades', [InboxController::class, 'pulse']);
        Route::get('/formularios/{kind}', [InboxController::class, 'show'])->whereIn('kind', array_keys(Inbox::KINDS));
        Route::post('/notificaciones/suscribir', [InboxController::class, 'subscribe']);
    });
    Route::post('/formularios/servidores/estado', [InboxController::class, 'serveStatus'])->middleware($can('inbox.serve'));
    Route::post('/notificaciones/silenciar', [InboxController::class, 'mute'])->middleware(EnsureRole::class.':superadmin');
    Route::redirect('/bandeja', '/admin/formularios');

    Route::middleware($can('themes.manage', 'content.manage'))->group(function () {
        Route::get('/temas', [AdminController::class, 'temas']);
        Route::post('/temas', [AdminController::class, 'uploadTheme']);
        Route::post('/temas/ocultar', [AdminController::class, 'hideTheme']);
    });
    Route::post('/contenido', [AdminController::class, 'saveSettings'])->middleware($can('content.manage', 'generosity.manage'));
    Route::get('/generosidad', [AdminController::class, 'generosidad'])->middleware($can('generosity.manage'));

    Route::middleware($can('media.manage'))->group(function () {
        Route::get('/medios', [AdminController::class, 'medios']);
        Route::post('/medios', [AdminController::class, 'saveMedia']);
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

    Route::middleware($can('servers.create'))->group(function () {
        Route::get('/servidores', [ServersController::class, 'index']);
        Route::post('/servidores', [ServersController::class, 'storeServer']);
        Route::post('/servidores/hijo', [ServersController::class, 'storeChild']);
        Route::post('/servidores/cuenta', [ServersController::class, 'storeAccount']);
        Route::post('/servidores/red', [ServersController::class, 'storeNetworkServer'])->middleware(EnsureRole::class.':superadmin');
    });

    Route::middleware($can('cells.manage'))->group(function () {
        Route::get('/celulas', [CellsController::class, 'index']);
        Route::post('/celulas', [CellsController::class, 'update']);
        Route::post('/celulas/integrante', [CellsController::class, 'addMember']);
        Route::post('/celulas/integrante/quitar', [CellsController::class, 'removeMember']);
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
