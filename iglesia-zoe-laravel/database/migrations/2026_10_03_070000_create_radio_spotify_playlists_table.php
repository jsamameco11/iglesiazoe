<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
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
    }

    public function down(): void
    {
        Schema::dropIfExists('radio_spotify_playlists');
    }
};
