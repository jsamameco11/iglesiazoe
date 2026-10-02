<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('serve_registrations', function (Blueprint $table) {
            $table->string('status', 20)->default('pendiente')->index();
            $table->timestamp('status_at')->nullable();
            $table->string('status_by', 120)->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->json('serve_areas')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('serve_areas');
        });

        Schema::table('serve_registrations', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'status_at', 'status_by']);
        });
    }
};
