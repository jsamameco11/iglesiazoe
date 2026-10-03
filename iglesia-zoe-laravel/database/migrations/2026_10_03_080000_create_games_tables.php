<?php

use App\Domain\Games\GameLibrary;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rebet_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 80)->unique();
            $table->string('name', 80);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('rebet_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('rebet_category_id')->constrained('rebet_categories')->cascadeOnDelete();
            $table->string('difficulty', 10)->default('medium');
            $table->text('question');
            $table->json('options');
            $table->unsignedTinyInteger('correct')->default(0);
            $table->text('explanation')->nullable();
            $table->string('reference', 120)->nullable();
            $table->unsignedSmallInteger('time_limit')->default(20);
            $table->unsignedInteger('base_points')->default(1000);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['rebet_category_id', 'difficulty']);
        });

        Schema::create('lingo_paths', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 100)->unique();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        Schema::create('lingo_units', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('lingo_path_id')->constrained('lingo_paths')->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('lingo_lessons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('lingo_unit_id')->constrained('lingo_units')->cascadeOnDelete();
            $table->string('title', 120);
            $table->unsignedSmallInteger('xp')->default(20);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        Schema::create('lingo_exercises', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('lingo_lesson_id')->constrained('lingo_lessons')->cascadeOnDelete();
            $table->string('kind', 12)->default('choice');
            $table->text('prompt');
            $table->string('passage_reference', 120)->nullable();
            $table->text('passage_text')->nullable();
            $table->json('options')->nullable();
            $table->unsignedTinyInteger('answer')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('oculto_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 80)->unique();
            $table->string('name', 80);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('oculto_words', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('oculto_category_id')->constrained('oculto_categories')->cascadeOnDelete();
            $table->string('word', 80);
            $table->text('description')->nullable();
            $table->string('reference', 120)->nullable();
            $table->json('clues')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['oculto_category_id', 'active']);
        });

        Schema::create('game_rooms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('game', 12);
            $table->string('code', 12)->unique();
            $table->string('status', 12)->default('lobby');
            $table->json('settings');
            $table->json('players');
            $table->json('state')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('active_at')->nullable()->index();
            $table->timestamps();
        });

        GameLibrary::import();
        Cache::forget('zoe.site.pages');
    }

    public function down(): void
    {
        Schema::dropIfExists('game_rooms');
        Schema::dropIfExists('oculto_words');
        Schema::dropIfExists('oculto_categories');
        Schema::dropIfExists('lingo_exercises');
        Schema::dropIfExists('lingo_lessons');
        Schema::dropIfExists('lingo_units');
        Schema::dropIfExists('lingo_paths');
        Schema::dropIfExists('rebet_questions');
        Schema::dropIfExists('rebet_categories');
    }
};
