<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A song only repeats in the continuous music when someone puts it there. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->boolean('rotation')->default(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->boolean('rotation')->default(true)->change();
        });
    }
};
