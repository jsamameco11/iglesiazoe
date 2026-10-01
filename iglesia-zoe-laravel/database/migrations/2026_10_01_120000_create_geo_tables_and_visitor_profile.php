<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geo_countries', function (Blueprint $table) {
            $table->string('code', 2)->primary();
            $table->string('name');
            $table->string('dial', 6);
            $table->string('flag', 16)->default('');
            $table->string('region_label');
            $table->string('city_label')->nullable();
            $table->string('district_label')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('geo_regions', function (Blueprint $table) {
            $table->id();
            $table->string('country_code', 2);
            $table->string('name');
            $table->index(['country_code', 'name']);
        });

        Schema::create('geo_cities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('region_id')->constrained('geo_regions')->cascadeOnDelete();
            $table->string('name');
            $table->index(['region_id', 'name']);
        });

        Schema::create('geo_districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('city_id')->constrained('geo_cities')->cascadeOnDelete();
            $table->string('name');
            $table->index(['city_id', 'name']);
        });

        Schema::table('visit_plans', function (Blueprint $table) {
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('phone_code', 6)->nullable();
            $table->string('sex', 20)->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('marital_status', 30)->nullable();
            $table->string('country_code', 2)->nullable();
            $table->string('region')->nullable();
            $table->string('city')->nullable();
            $table->string('district')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('visit_plans', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name', 'phone_code', 'sex', 'age', 'marital_status', 'country_code', 'region', 'city', 'district']);
        });
        Schema::dropIfExists('geo_districts');
        Schema::dropIfExists('geo_cities');
        Schema::dropIfExists('geo_regions');
        Schema::dropIfExists('geo_countries');
    }
};
