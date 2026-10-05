<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The radio no longer keeps Spotify playlists: the lists of the library are the only music. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('radio_playlists', 'radio_spotify_playlist_id')) {
            Schema::table('radio_playlists', function (Blueprint $table) {
                $table->dropConstrainedForeignId('radio_spotify_playlist_id');
            });
        }
        Schema::dropIfExists('radio_spotify_playlists');
    }

    public function down(): void
    {
        Schema::create('radio_spotify_playlists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('spotify_id', 40)->unique();
            $table->string('name', 80);
            $table->string('description', 240)->nullable();
            $table->string('cover_url', 500)->nullable();
            $table->boolean('published')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
        Schema::table('radio_playlists', function (Blueprint $table) {
            $table->foreignUuid('radio_spotify_playlist_id')->nullable()->after('description')
                ->constrained('radio_spotify_playlists')->nullOnDelete();
        });
    }
};
