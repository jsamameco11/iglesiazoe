<?php

use App\Domain\Radio\Catalog\MusicCatalog;
use Illuminate\Database\Migrations\Migration;

/** Loads the complete list of music genres: the ones missing are added, the admin's own are kept. */
return new class extends Migration
{
    public function up(): void
    {
        MusicCatalog::sync();
    }

    public function down(): void
    {
        //
    }
};
