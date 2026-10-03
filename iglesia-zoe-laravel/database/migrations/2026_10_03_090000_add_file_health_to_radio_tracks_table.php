<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->timestamp('file_checked_at')->nullable();
            $table->string('file_problem', 20)->nullable();
            $table->timestamp('file_problem_at')->nullable();
            $table->index(['active', 'file_problem']);
        });
    }

    public function down(): void
    {
        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->dropIndex(['active', 'file_problem']);
            $table->dropColumn(['file_checked_at', 'file_problem', 'file_problem_at']);
        });
    }
};
