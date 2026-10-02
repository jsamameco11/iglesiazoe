<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_galleries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 140)->unique();
            $table->string('title', 160);
            $table->string('kind', 20)->default('dominical');
            $table->date('service_date');
            $table->string('summary', 400)->nullable();
            $table->json('photos')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'service_date']);
        });

        Schema::create('devotionals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 140)->unique();
            $table->string('title', 160);
            $table->string('verse_ref', 80)->nullable();
            $table->string('verse_text', 600)->nullable();
            $table->text('body');
            $table->string('author', 100)->nullable();
            $table->date('publish_on');
            $table->string('image_path')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'publish_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devotionals');
        Schema::dropIfExists('service_galleries');
    }
};
