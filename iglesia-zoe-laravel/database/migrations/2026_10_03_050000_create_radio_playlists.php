<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('radio_playlists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 80);
            $table->string('description', 240)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('radio_playlist_track', function (Blueprint $table) {
            $table->foreignUuid('radio_playlist_id')->constrained('radio_playlists')->cascadeOnDelete();
            $table->foreignUuid('radio_track_id')->constrained('radio_tracks')->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->primary(['radio_playlist_id', 'radio_track_id']);
        });

        Schema::table('radio_slots', function (Blueprint $table) {
            $table->foreignUuid('radio_playlist_id')->nullable()->after('radio_track_id')->constrained('radio_playlists')->nullOnDelete();
            $table->boolean('shuffle')->default(true)->after('bed');
        });
    }

    public function down(): void
    {
        Schema::table('radio_slots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('radio_playlist_id');
            $table->dropColumn('shuffle');
        });
        Schema::dropIfExists('radio_playlist_track');
        Schema::dropIfExists('radio_playlists');
    }
};
