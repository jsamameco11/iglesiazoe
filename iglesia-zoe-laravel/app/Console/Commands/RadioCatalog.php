<?php

namespace App\Console\Commands;

use App\Domain\Radio\Catalog\MusicCatalog;
use App\Models\RadioArtist;
use App\Models\RadioGenre;
use Illuminate\Console\Command;

/** Brings the genres and artists of the starting catalog that are missing into the library. */
class RadioCatalog extends Command
{
    protected $signature = 'radio:catalog';

    protected $description = 'Agrega a la radio los géneros musicales y artistas del catálogo inicial que falten (no toca lo que el administrador cambió)';

    public function handle(): int
    {
        $added = MusicCatalog::sync();
        $this->info("{$added['genres']} géneros y {$added['artists']} artistas agregados. Hay ".RadioGenre::query()->count().' géneros y '.RadioArtist::query()->count().' artistas.');

        return self::SUCCESS;
    }
}
