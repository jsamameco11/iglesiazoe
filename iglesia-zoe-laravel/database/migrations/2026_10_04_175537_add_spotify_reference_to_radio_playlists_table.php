<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Each list of the library can point to a Spotify playlist kept in the panel as its reference. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('radio_playlists', function (Blueprint $table) {
            $table->foreignUuid('radio_spotify_playlist_id')->nullable()->after('description')
                ->constrained('radio_spotify_playlists')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('radio_playlists', function (Blueprint $table) {
            $table->dropConstrainedForeignId('radio_spotify_playlist_id');
        });
    }
};
