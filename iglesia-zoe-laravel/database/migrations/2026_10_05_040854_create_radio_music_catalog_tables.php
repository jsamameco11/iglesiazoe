<?php

use App\Domain\Radio\Catalog\MusicCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The music catalog of the radio: genres (musical styles) and artists, linked to each song,
 * plus what the internet said when the song was identified. The free-text genre becomes links.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('radio_genres', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 60);
            $table->string('slug', 80)->unique();
            $table->string('family', 20)->index();
            $table->json('aliases')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('custom')->default(false);
            $table->timestamps();
        });

        Schema::create('radio_artists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->json('aliases')->nullable();
            $table->string('kind', 12)->nullable();
            $table->char('country', 2)->nullable();
            $table->boolean('convert')->default(false);
            $table->string('source', 12)->default('manual');
            $table->string('musicbrainz_id', 36)->nullable();
            $table->timestamps();
        });

        Schema::create('radio_genre_track', function (Blueprint $table) {
            $table->foreignUuid('radio_genre_id')->constrained('radio_genres')->cascadeOnDelete();
            $table->foreignUuid('radio_track_id')->constrained('radio_tracks')->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['radio_genre_id', 'radio_track_id']);
        });

        Schema::create('radio_artist_genre', function (Blueprint $table) {
            $table->foreignUuid('radio_artist_id')->constrained('radio_artists')->cascadeOnDelete();
            $table->foreignUuid('radio_genre_id')->constrained('radio_genres')->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['radio_artist_id', 'radio_genre_id']);
        });

        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->json('identity')->nullable()->after('cover_path');
            $table->timestamp('identified_at')->nullable()->after('identity');
        });

        MusicCatalog::sync();

        $typed = DB::table('radio_tracks')->whereNotNull('genre')->where('genre', '<>', '')->pluck('genre', 'id');
        foreach ($typed as $trackId => $name) {
            $genre = MusicCatalog::genreFor((string) $name);
            DB::table('radio_genre_track')->insertOrIgnore(['radio_genre_id' => $genre->id, 'radio_track_id' => $trackId, 'position' => 0]);
        }

        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->dropColumn('genre');
        });
    }

    public function down(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->string('genre', 60)->nullable()->after('album');
            $table->dropColumn(['identity', 'identified_at']);
        });
        Schema::dropIfExists('radio_artist_genre');
        Schema::dropIfExists('radio_genre_track');
        Schema::dropIfExists('radio_artists');
        Schema::dropIfExists('radio_genres');
    }
};
