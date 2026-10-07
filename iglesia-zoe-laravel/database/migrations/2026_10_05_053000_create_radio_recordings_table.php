<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** A live console transmission while it is being recorded and until it is saved or discarded. */
    public function up(): void
    {
        Schema::create('radio_recordings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('session', 40);
            $table->string('status', 16)->default('recording');
            $table->string('path')->nullable();
            $table->string('extension', 8)->default('webm');
            $table->string('mime', 80)->default('audio/webm');
            $table->unsignedBigInteger('bytes')->default(0);
            $table->unsignedInteger('parts')->default(0);
            $table->decimal('duration', 8, 2)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->foreignUuid('radio_track_id')->nullable()->constrained('radio_tracks')->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index('session');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('radio_recordings');
    }
};
