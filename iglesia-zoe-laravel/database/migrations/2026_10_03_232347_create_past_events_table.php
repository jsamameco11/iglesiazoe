<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('past_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 160);
            $table->date('held_on');
            $table->string('image_path')->nullable();
            $table->string('url', 500);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'held_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('past_events');
    }
};
