<?php

use App\Domain\Access\Permissions;
use App\Domain\Inbox\Inbox;
use App\Http\Controllers\Admin\BaptismsController;
use App\Http\Controllers\Admin\CellsController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DesignController;
use App\Http\Controllers\Admin\DevotionalsController;
use App\Http\Controllers\Admin\ExpensesController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\GalleriesController;
use App\Http\Controllers\Admin\InboxController;
use App\Http\Controllers\Admin\LingobibleController;
use App\Http\Controllers\Admin\MinistriesController;
use App\Http\Controllers\Admin\NoticeController;
use App\Http\Controllers\Admin\OcultoController;
use App\Http\Controllers\Admin\PastEventsController;
use App\Http\Controllers\Admin\RadioCatalogController;
use App\Http\Controllers\Admin\RadioConsoleController;
use App\Http\Controllers\Admin\RadioEpisodesController;
use App\Http\Controllers\Admin\RadioLibraryController;
use App\Http\Controllers\Admin\RadioPlaylistsController;
use App\Http\Controllers\Admin\RadioScheduleController;
use App\Http\Controllers\Admin\RadioSettingsController;
use App\Http\Controllers\Admin\RadioUploadController;
use App\Http\Controllers\Admin\RebetController;
use App\Http\Controllers\Admin\ReportsController;
use App\Http\Controllers\Admin\SectionsController;
use App\Http\Controllers\Admin\SermonsController;
use App\Http\Controllers\Admin\ServersController;
use App\Http\Controllers\Admin\SiteContentController;
use App\Http\Controllers\Admin\SiteMediaController;
use App\Http\Controllers\Admin\SitePagesController;
use App\Http\Controllers\Admin\StudiesController;
use App\Http\Controllers\Admin\TeamController;
use App\Http\Controllers\Admin\ThemesController;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

$can = fn (string ...$permissions) => EnsurePermission::class.':'.implode(',', $permissions);

Route::middleware(['auth', EnsureRole::class.':staff'])->prefix('admin')->group(function () use ($can) {
    Route::get('/', [DashboardController::class, 'dashboard'])->name('admin.home');

    Route::middleware($can('content.manage'))->group(function () {
        Route::get('/contenido', [SiteContentController::class, 'contenido']);
        Route::get('/textos', [SiteContentController::class, 'textos']);
        Route::post('/textos', [SiteContentController::class, 'saveTexts']);
        Route::get('/paginas', [SitePagesController::class, 'index']);
        Route::post('/paginas', [SitePagesController::class, 'save']);
        Route::get('/ministerios', [MinistriesController::class, 'ministerios']);
        Route::post('/ministerios', [MinistriesController::class, 'saveMinistry']);
        Route::post('/ministerios/orden', [MinistriesController::class, 'moveMinistry']);
        Route::post('/ministerios/eliminar', [MinistriesController::class, 'deleteMinistry']);
        Route::get('/predicas', [SermonsController::class, 'predicas']);
        Route::post('/predicas', [SermonsController::class, 'saveSermon']);
        Route::post('/predicas/eliminar', [SermonsController::class, 'deleteSermon']);
        Route::get('/bautismos', [BaptismsController::class, 'bautismos']);
        Route::post('/bautismos', [BaptismsController::class, 'saveBaptism']);
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
        Route::post('/eventos/anteriores', [PastEventsController::class, 'save']);
        Route::post('/eventos/anteriores/eliminar', [PastEventsController::class, 'destroy']);
    });

    Route::middleware($can('devotionals.manage', 'content.manage'))->group(function () {
        Route::get('/devocionales', [DevotionalsController::class, 'index']);
        Route::post('/devocionales', [DevotionalsController::class, 'save']);
        Route::post('/devocionales/eliminar', [DevotionalsController::class, 'destroy']);
    });

    Route::prefix('radio')->group(function () use ($can) {
        Route::middleware($can('radio.console'))->group(function () {
            Route::get('/', [RadioConsoleController::class, 'index']);
            Route::post('/vivo', [RadioConsoleController::class, 'live']);
            Route::post('/capa', [RadioConsoleController::class, 'layer']);
            Route::post('/botonera', [RadioConsoleController::class, 'pads']);
            Route::post('/lanzar', [RadioConsoleController::class, 'launch']);
            Route::post('/musica-continua', [RadioConsoleController::class, 'music']);
            Route::post('/reprogramar', [RadioConsoleController::class, 'reschedule']);
            Route::get('/senal', [RadioConsoleController::class, 'signal']);
            Route::post('/senal/oferta', [RadioConsoleController::class, 'offer']);
        });
        Route::middleware($can('radio.schedule'))->prefix('programacion')->group(function () {
            Route::get('/', [RadioScheduleController::class, 'index']);
            Route::post('/', [RadioScheduleController::class, 'store']);
            Route::post('/editar', [RadioScheduleController::class, 'update']);
            Route::post('/quitar', [RadioScheduleController::class, 'destroy']);
            Route::post('/vaciar', [RadioScheduleController::class, 'clear']);
            Route::post('/copiar', [RadioScheduleController::class, 'copy']);
            Route::post('/rotacion', [RadioScheduleController::class, 'rotation']);
            Route::post('/piloto', [RadioScheduleController::class, 'autopilot']);
        });
        Route::middleware($can('radio.library'))->group(function () {
            Route::get('/biblioteca', [RadioLibraryController::class, 'index']);
            Route::post('/biblioteca', [RadioLibraryController::class, 'save']);
            Route::post('/biblioteca/rotacion', [RadioLibraryController::class, 'rotation']);
            Route::post('/biblioteca/eliminar', [RadioLibraryController::class, 'destroy']);
            Route::post('/biblioteca/identificar', [RadioLibraryController::class, 'identify'])->middleware('throttle:90,1');
            Route::get('/catalogo', [RadioCatalogController::class, 'index']);
            Route::post('/catalogo/genero', [RadioCatalogController::class, 'saveGenre']);
            Route::post('/catalogo/genero/eliminar', [RadioCatalogController::class, 'destroyGenre']);
            Route::post('/catalogo/artista', [RadioCatalogController::class, 'saveArtist']);
            Route::post('/catalogo/artista/eliminar', [RadioCatalogController::class, 'destroyArtist']);
            Route::get('/listas', [RadioPlaylistsController::class, 'index']);
            Route::post('/listas', [RadioPlaylistsController::class, 'save']);
            Route::post('/listas/orden', [RadioPlaylistsController::class, 'order']);
            Route::post('/listas/eliminar', [RadioPlaylistsController::class, 'destroy']);
        });
        Route::middleware($can('radio.episodes'))->group(function () {
            Route::get('/episodios', [RadioEpisodesController::class, 'index']);
            Route::post('/episodios', [RadioEpisodesController::class, 'save']);
            Route::post('/episodios/eliminar', [RadioEpisodesController::class, 'destroy']);
        });
        Route::middleware($can('radio.library', 'radio.episodes'))->group(function () {
            Route::post('/subida', [RadioUploadController::class, 'begin'])->middleware('throttle:60,1');
            Route::post('/subida/cancelar', [RadioUploadController::class, 'cancel']);
        });
        Route::middleware($can('radio.settings'))->group(function () {
            Route::get('/ajustes', [RadioSettingsController::class, 'index']);
            Route::post('/ajustes', [RadioSettingsController::class, 'save']);
        });
    });

    Route::middleware($can('games.manage'))->prefix('juegos')->group(function () {
        Route::get('/', [RebetController::class, 'index']);
        Route::post('/rebet/tema', [RebetController::class, 'saveTheme']);
        Route::post('/rebet/tema/orden', [RebetController::class, 'moveTheme']);
        Route::post('/rebet/tema/eliminar', [RebetController::class, 'deleteTheme']);
        Route::post('/rebet/pregunta', [RebetController::class, 'saveQuestion']);
        Route::post('/rebet/pregunta/eliminar', [RebetController::class, 'deleteQuestion']);
        Route::get('/lingobible', [LingobibleController::class, 'index']);
        Route::post('/lingobible/ruta', [LingobibleController::class, 'savePath']);
        Route::post('/lingobible/unidad', [LingobibleController::class, 'saveUnit']);
        Route::post('/lingobible/leccion', [LingobibleController::class, 'saveLesson']);
        Route::post('/lingobible/ejercicio', [LingobibleController::class, 'saveExercise']);
        Route::post('/lingobible/orden', [LingobibleController::class, 'reorder']);
        Route::post('/lingobible/eliminar', [LingobibleController::class, 'destroy']);
        Route::get('/cristiano-oculto', [OcultoController::class, 'index']);
        Route::post('/cristiano-oculto/tema', [OcultoController::class, 'saveTheme']);
        Route::post('/cristiano-oculto/tema/orden', [OcultoController::class, 'moveTheme']);
        Route::post('/cristiano-oculto/tema/eliminar', [OcultoController::class, 'deleteTheme']);
        Route::post('/cristiano-oculto/palabra', [OcultoController::class, 'saveWord']);
        Route::post('/cristiano-oculto/palabra/eliminar', [OcultoController::class, 'deleteWord']);
    });

    Route::middleware($can('studies.students'))->prefix('estudios')->group(function () {
        Route::get('/', [StudiesController::class, 'levels']);
        Route::post('/niveles', [StudiesController::class, 'saveLevel']);
        Route::get('/estudiantes', [StudiesController::class, 'students']);
        Route::post('/estudiantes', [StudiesController::class, 'saveStudent']);
        Route::post('/estudiantes/eliminar', [StudiesController::class, 'deleteStudent']);
    });

    Route::middleware($can('studies.grades'))->prefix('estudios')->group(function () {
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
        Route::get('/temas', [ThemesController::class, 'temas']);
        Route::post('/temas', [ThemesController::class, 'uploadTheme']);
        Route::post('/temas/ocultar', [ThemesController::class, 'hideTheme']);
    });
    Route::post('/contenido', [SiteContentController::class, 'saveSettings'])->middleware($can('content.manage', 'generosity.manage'));
    Route::get('/generosidad', [SiteContentController::class, 'generosidad'])->middleware($can('generosity.manage'));

    Route::middleware($can('media.manage'))->group(function () {
        Route::get('/medios', [SiteMediaController::class, 'medios']);
        Route::post('/medios', [SiteMediaController::class, 'saveMedia']);
    });

    Route::middleware($can('notices.manage'))->group(function () {
        Route::get('/indicaciones', [NoticeController::class, 'index']);
        Route::post('/indicaciones', [NoticeController::class, 'save']);
    });

    Route::middleware($can('design.manage'))->group(function () {
        Route::get('/diseno', [DesignController::class, 'index']);
        Route::post('/diseno', [DesignController::class, 'save']);
        Route::post('/diseno/restaurar', [DesignController::class, 'reset']);
        Route::post('/diseno/fondo', [DesignController::class, 'upload']);
    });

    Route::middleware($can(...Permissions::SERVER_TREE))->group(function () use ($can) {
        Route::get('/servidores', [ServersController::class, 'index']);
        Route::post('/servidores', [ServersController::class, 'storeServer'])->middleware($can('servers.create'));
        Route::post('/servidores/hijo', [ServersController::class, 'storeChild'])->middleware($can('servers.children'));
        Route::post('/servidores/mi-celula', [ServersController::class, 'storeOwnCell'])->middleware($can('cells.own'));
        Route::post('/servidores/cuenta', [ServersController::class, 'storeAccount'])->middleware($can('servers.create', 'servers.children'));
        Route::post('/servidores/red', [ServersController::class, 'storeNetworkServer'])->middleware($can('servers.network'));
        Route::post('/servidores/red/actualizar', [ServersController::class, 'updateNetworkServer'])->middleware($can('servers.network'));
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

    Route::get('/finanzas', [FinanceController::class, 'index'])->middleware(EnsureRole::class.':superadmin');

    Route::middleware(EnsureRole::class.':administrator')->group(function () {
        Route::get('/equipo', [TeamController::class, 'index']);
        Route::post('/equipo', [TeamController::class, 'store']);
        Route::post('/equipo/actualizar', [TeamController::class, 'update']);
        Route::post('/equipo/clave', [TeamController::class, 'password']);
        Route::post('/equipo/eliminar', [TeamController::class, 'destroy']);
    });

    Route::redirect('/usuarios', '/admin/equipo');
    Route::redirect('/accesos', '/admin/equipo');
});
