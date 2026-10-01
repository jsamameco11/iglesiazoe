<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique()->nullable();
            $table->string('dni')->unique()->nullable();
            $table->string('role')->default('cell_leader');
            $table->uuid('network_id')->nullable()->index();
        });

        Schema::create('site_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('ministries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('age_range');
            $table->text('summary');
            $table->text('body');
            $table->integer('sort_order')->default(0);
            $table->string('accent')->default('#e38b3a');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('sermons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('preacher')->nullable();
            $table->string('series')->nullable();
            $table->date('sermon_date')->nullable();
            $table->string('youtube_id')->nullable();
            $table->boolean('is_live')->default(false);
            $table->boolean('published')->default(true);
            $table->timestamps();
        });

        Schema::create('baptism_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('event_date')->nullable();
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('baptism_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->uuid('event_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('prayer_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('request');
            $table->timestamps();
        });

        Schema::create('visit_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->date('visit_date')->nullable();
            $table->string('service')->nullable();
            $table->integer('adults')->default(1);
            $table->integer('children')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('networks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('code', 1)->unique();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('cells', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('network_id');
            $table->uuid('parent_id')->nullable();
            $table->integer('number');
            $table->string('code')->unique();
            $table->string('leader_name')->nullable();
            $table->string('assistant_name')->nullable();
            $table->string('host_name')->nullable();
            $table->string('address')->nullable();
            $table->string('meeting_day')->nullable();
            $table->string('meeting_time')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('cell_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cell_id');
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_cells', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('cell_id');
            $table->primary(['user_id', 'cell_id']);
        });

        Schema::create('themes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('audience')->default('Iglesia');
            $table->date('theme_date');
            $table->string('file_path')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cell_id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->integer('year');
            $table->integer('week');
            $table->boolean('met');
            $table->text('reason')->nullable();
            $table->date('meeting_date')->nullable();
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->string('modality')->nullable();
            $table->uuid('theme_id')->nullable();
            $table->string('theme_title')->nullable();
            $table->integer('praise_minutes')->default(0);
            $table->boolean('had_prayer')->nullable();
            $table->text('prayer_notes')->nullable();
            $table->integer('teaching_minutes')->default(0);
            $table->integer('salvations')->default(0);
            $table->integer('spirit_baptisms')->default(0);
            $table->integer('reconciled')->default(0);
            $table->decimal('offering', 12, 2)->default(0);
            $table->integer('offering_minutes')->default(0);
            $table->integer('families')->default(0);
            $table->integer('guests')->default(0);
            $table->text('testimonies')->nullable();
            $table->timestamps();
            $table->unique(['cell_id', 'year', 'week']);
        });

        Schema::create('report_attendance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->uuid('member_id')->nullable();
            $table->string('member_name');
            $table->boolean('attended')->default(false);
            $table->decimal('tithe', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('report_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->string('file_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_photos');
        Schema::dropIfExists('report_attendance');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('themes');
        Schema::dropIfExists('user_cells');
        Schema::dropIfExists('cell_members');
        Schema::dropIfExists('cells');
        Schema::dropIfExists('networks');
        Schema::dropIfExists('visit_plans');
        Schema::dropIfExists('prayer_requests');
        Schema::dropIfExists('baptism_registrations');
        Schema::dropIfExists('baptism_events');
        Schema::dropIfExists('sermons');
        Schema::dropIfExists('ministries');
        Schema::dropIfExists('site_settings');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username', 'dni', 'role', 'network_id']);
        });
    }
};
