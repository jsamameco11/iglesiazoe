<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('baptism_registrations', function (Blueprint $table) {
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('phone_code', 6)->nullable();
            $table->string('sex', 20)->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('country_code', 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('baptism_registrations', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name', 'phone_code', 'sex', 'age', 'country_code']);
        });
    }
};
