<?php

use App\Domain\Inbox\SiteAlerts;
use App\Domain\Radio\Capture;
use App\Domain\Site\Sermons\ChannelLive;
use App\Domain\Site\Sermons\SermonSettings;
use App\Domain\Site\Sermons\SermonSync;
use App\Domain\Stream\Broadcasts;
use App\Domain\Stream\Recordings;
use App\Domain\Stream\SignalHooks;
use App\Domain\Stream\TeachingVideos;
use App\Domain\Stream\VideoUploads;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Called by the media server (see deploy/stream-setup.sh) when the OBS signal comes and goes.
Artisan::command('stream:started', function () {
    $this->line(SignalHooks::started() ?? '');
})->purpose('La señal de OBS llegó: pone la transmisión al aire e imprime a dónde reenviarla en YouTube');

Artisan::command('stream:stopped', function () {
    SignalHooks::stopped();
})->purpose('La señal de OBS se cortó');

Artisan::command('stream:segment {file}', function (string $file) {
    SignalHooks::segment($file);
})->purpose('El servidor de video cerró un tramo de la grabación');

Artisan::command('stream:watch', function () {
    Broadcasts::watch();
    TeachingVideos::sync();
})->purpose('Finaliza transmisiones sin señal y sigue los videos que YouTube está procesando');

Artisan::command('stream:purge', function () {
    $this->info(Recordings::purge().' grabaciones vencidas borradas, '.VideoUploads::purgeStale().' archivos temporales borrados.');
})->purpose('Borra las grabaciones con más de 3 días y los videos temporales');

Artisan::command('radio:capture-purge', function () {
    $this->info(Capture::purge().' grabaciones de la radio sin guardar fueron borradas.');
})->purpose('Borra las grabaciones de la consola que nadie guardó en dos días');

Artisan::command('sermons:sync {--force : Revisa ahora aunque no toque} {--pages=1 : Páginas del canal a leer (30 videos cada una)}', function () {
    if (! $this->option('force') && ! SermonSettings::due()) {
        return;
    }
    $run = SermonSync::make()->run($this->option('force') ? 'manual' : 'auto', (int) $this->option('pages'));
    if (isset($run['error'])) {
        $this->error($run['error']);

        return 1;
    }
    $this->info("{$run['found']} videos en el canal: {$run['added']} publicados, {$run['pending']} por revisar, {$run['updated']} actualizados ({$run['seconds']} s).");
})->purpose('Busca prédicas nuevas en el canal de YouTube cuando toca según el panel');

Artisan::command('sermons:live', function () {
    $live = ChannelLive::check();
    if ($live) {
        $this->info("En vivo en YouTube: {$live['title']}");
    }
})->purpose('Revisa si el canal de YouTube está transmitiendo y trae la grabación cuando termina');

Artisan::command('notifications:send', function () {
    $sent = SiteAlerts::run();
    if (array_sum($sent)) {
        $this->info("Notificaciones: {$sent['radio']} de la radio, {$sent['live']} en vivo, {$sent['videos']} de videos nuevos, {$sent['pending']} al panel.");
    }
})->purpose('Avisa a los celulares y computadoras: programa de la radio por empezar, transmisión en vivo y prédicas nuevas');

Schedule::command('sermons:live')->everyTwoMinutes()->withoutOverlapping(10)->runInBackground();
Schedule::command('notifications:send')->everyMinute()->withoutOverlapping(5);
Schedule::command('stream:watch')->everyMinute()->withoutOverlapping(10);
Schedule::command('sermons:sync')->everyFiveMinutes()->withoutOverlapping(15)->runInBackground();
Schedule::command('stream:purge')->hourly()->withoutOverlapping(30);
Schedule::command('radio:capture-purge')->daily()->withoutOverlapping(30);
