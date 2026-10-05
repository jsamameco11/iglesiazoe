<?php

namespace App\Console\Commands;

use App\Domain\Media\Support\HotMedia;
use App\Domain\Media\Support\MediaLibrary;
use Illuminate\Console\Command;

/** Keeps the web server's copy of the home page media in step with Wasabi; deploys run it after every release. */
class MediaHot extends Command
{
    protected $signature = 'media:hot';

    protected $description = 'Copia al servidor web las fotos y videos de la página de inicio y borra las copias que ya no se usan';

    public function handle(): int
    {
        if (! MediaLibrary::cloud()) {
            $this->info('Los archivos están en el disco local: el servidor ya los sirve directamente.');

            return self::SUCCESS;
        }

        $result = HotMedia::sync();
        $this->info("Copiados: {$result['copied']} · Borrados: {$result['removed']}");
        foreach ($result['failed'] as $key) {
            $this->warn("No se pudo copiar: {$key} (sigue sirviéndose desde Wasabi)");
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
