<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_streams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 100);
            $table->text('description')->nullable();
            $table->string('preacher', 120)->nullable();
            $table->string('kind', 20)->default('predica');
            $table->boolean('show_summary')->default(true);
            $table->boolean('to_youtube')->default(true);
            $table->json('options')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('status', 20)->default('ready')->index();
            $table->boolean('quick')->default(false);
            $table->string('youtube_id', 32)->nullable();
            $table->string('youtube_mode', 10)->nullable();
            $table->text('youtube_error')->nullable();
            $table->json('segments')->nullable();
            $table->timestamp('signal_at')->nullable();
            $table->timestamp('signal_lost_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->string('end_reason', 20)->nullable();
            $table->uuid('teaching_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('live_recordings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('live_stream_id')->index();
            $table->unsignedSmallInteger('part')->default(1);
            $table->string('path')->nullable();
            $table->string('name');
            $table->unsignedBigInteger('size')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('status', 20)->default('processing');
            $table->text('error')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::table('teachings', function (Blueprint $table) {
            $table->text('summary')->nullable()->change();
            $table->string('preacher', 120)->nullable();
            $table->boolean('show_summary')->default(true);
            $table->string('source', 20)->default('manual');
            $table->string('youtube_privacy', 20)->nullable();
            $table->string('youtube_status', 20)->nullable();
            $table->unsignedTinyInteger('youtube_progress')->default(0);
            $table->text('youtube_error')->nullable();
            $table->json('youtube_options')->nullable();
            $table->string('upload_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->uuid('live_stream_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('teachings', function (Blueprint $table) {
            $table->dropColumn(['preacher', 'show_summary', 'source', 'youtube_privacy', 'youtube_status', 'youtube_progress', 'youtube_error', 'youtube_options', 'upload_path', 'cover_path', 'duration_seconds', 'live_stream_id']);
        });
        Schema::dropIfExists('live_recordings');
        Schema::dropIfExists('live_streams');
    }
};
