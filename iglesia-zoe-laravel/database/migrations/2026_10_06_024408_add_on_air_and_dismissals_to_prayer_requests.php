<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prayer_requests', function (Blueprint $table) {
            $table->boolean('on_air')->default(false);
        });

        Schema::create('prayer_request_dismissals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('prayer_request_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'prayer_request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prayer_request_dismissals');
        Schema::table('prayer_requests', function (Blueprint $table) {
            $table->dropColumn('on_air');
        });
    }
};
