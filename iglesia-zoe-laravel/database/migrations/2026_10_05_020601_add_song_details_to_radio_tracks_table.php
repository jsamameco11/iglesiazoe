<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Songs of the library keep their co-authors, album, genre, year and cover art, read from the file when it is uploaded. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->json('featured')->nullable()->after('artist');
            $table->string('album', 160)->nullable()->after('featured');
            $table->string('genre', 60)->nullable()->after('album');
            $table->unsignedSmallInteger('year')->nullable()->after('genre');
            $table->string('cover_path')->nullable()->after('file_path');
        });
    }

    public function down(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->dropColumn(['featured', 'album', 'genre', 'year', 'cover_path']);
        });
    }
};
