<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audio edited in the editor keeps its original file and the recipe it was made with,
 * so the edit can be reopened, adjusted or undone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->string('original_path')->nullable()->after('file_path');
            $table->float('original_duration')->nullable()->after('original_path');
            $table->json('edit')->nullable()->after('original_duration');
            $table->string('edit_status', 20)->nullable()->after('edit');
            $table->string('edit_error', 300)->nullable()->after('edit_status');
            $table->timestamp('edited_at')->nullable()->after('edit_error');
        });
    }

    public function down(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->dropColumn(['original_path', 'original_duration', 'edit', 'edit_status', 'edit_error', 'edited_at']);
        });
    }
};
