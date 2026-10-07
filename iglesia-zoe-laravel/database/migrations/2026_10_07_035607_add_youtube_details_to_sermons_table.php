<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What YouTube says about each sermon video, so the site can show it the way YouTube does,
     * and whether it came from the channel watcher and still waits for an admin to approve it.
     */
    public function up(): void
    {
        Schema::table('sermons', function (Blueprint $table) {
            $table->text('description')->nullable();
            $table->unsignedInteger('duration')->nullable();
            $table->unsignedBigInteger('views')->nullable();
            $table->timestamp('aired_at')->nullable();
            $table->string('thumbnail')->nullable();
            $table->string('channel')->nullable();
            $table->string('youtube_title')->nullable();
            $table->boolean('title_locked')->default(false);
            $table->string('source', 16)->default('manual');
            $table->boolean('pending')->default(false);
            $table->timestamp('synced_at')->nullable();
            $table->index('youtube_id');
            $table->index(['published', 'sermon_date']);
        });
    }

    public function down(): void
    {
        Schema::table('sermons', function (Blueprint $table) {
            $table->dropIndex(['youtube_id']);
            $table->dropIndex(['published', 'sermon_date']);
            $table->dropColumn(['description', 'duration', 'views', 'aired_at', 'thumbnail', 'channel', 'youtube_title', 'title_locked', 'source', 'pending', 'synced_at']);
        });
    }
};
