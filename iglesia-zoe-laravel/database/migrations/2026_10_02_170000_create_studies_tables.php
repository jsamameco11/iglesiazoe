<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\ServeArea;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /** New functions handed to the account types that already existed. */
    private const GRANTS = [
        'atmosfera' => ['studies.grades', 'studies.board', 'events.manage'],
        'visuales' => ['studies.grades', 'studies.board', 'events.manage', 'devotionals.manage'],
    ];

    private const OLD_ROUTE_TEXT = 'El camino de formación de Zoe: paso a paso, desde tu encuentro con Jesús hasta servir y acompañar a otros en un grupo celular.';

    public function up(): void
    {
        Schema::create('study_levels', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 80)->unique();
            $table->string('name', 80);
            $table->string('summary', 400)->nullable();
            $table->unsignedTinyInteger('weeks')->default(8);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('class_time', 5)->default('09:00');
            $table->string('place', 120)->nullable();
            $table->string('teacher', 120)->nullable();
            $table->decimal('pass_score', 4, 1)->default(11);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('study_students', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignUuid('study_level_id')->nullable()->constrained('study_levels')->nullOnDelete();
            $table->string('status', 20)->default('cursando');
            $table->string('phone', 30)->nullable();
            $table->string('network', 60)->nullable();
            $table->timestamps();
        });

        Schema::create('study_assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('study_level_id')->constrained('study_levels')->cascadeOnDelete();
            $table->string('title', 80);
            $table->unsignedTinyInteger('week')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('study_grades', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('study_assessment_id')->constrained('study_assessments')->cascadeOnDelete();
            $table->foreignUuid('study_student_id')->constrained('study_students')->cascadeOnDelete();
            $table->decimal('score', 4, 1);
            $table->timestamps();
            $table->unique(['study_assessment_id', 'study_student_id']);
        });

        Schema::create('study_verses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('study_level_id')->nullable()->constrained('study_levels')->cascadeOnDelete();
            $table->string('reference', 80)->nullable();
            $table->string('text', 600);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('study_notices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('study_level_id')->nullable()->constrained('study_levels')->cascadeOnDelete();
            $table->string('title', 120);
            $table->text('body');
            $table->string('tone', 20)->default('aviso');
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('study_readings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('study_level_id')->nullable()->constrained('study_levels')->cascadeOnDelete();
            $table->string('title', 140);
            $table->string('summary', 300)->nullable();
            $table->unsignedTinyInteger('week')->nullable();
            $table->string('file_path');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        $now = now();
        foreach (config('zoe.study_levels') as $index => $level) {
            DB::table('study_levels')->insert([
                ...$level,
                'id' => (string) Str::uuid(),
                'sort_order' => $index + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        foreach (config('zoe.study_verses') as [$reference, $text]) {
            DB::table('study_verses')->insert(['id' => (string) Str::uuid(), 'reference' => $reference, 'text' => $text, 'active' => true, 'created_at' => $now, 'updated_at' => $now]);
        }

        $this->grant();
        $this->refreshRouteArea();
        $this->renameRoutePage();
    }

    public function down(): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $permissions = $this->decode($user->permissions);
            $kept = array_values(array_diff($permissions, ['studies.grades', 'studies.board', 'events.manage', 'devotionals.manage']));
            if ($kept !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($kept)]);
            }
        }
        DB::table('users')->where('role', 'student')->delete();

        Schema::dropIfExists('study_readings');
        Schema::dropIfExists('study_notices');
        Schema::dropIfExists('study_verses');
        Schema::dropIfExists('study_grades');
        Schema::dropIfExists('study_assessments');
        Schema::dropIfExists('study_students');
        Schema::dropIfExists('study_levels');
    }

    private function grant(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'admin_types', 'permissions']) as $user) {
            $types = $this->decode($user->admin_types);
            $permissions = $this->decode($user->permissions);
            $extra = [];
            foreach (self::GRANTS as $type => $grants) {
                if (in_array($type, $types, true)) {
                    $extra = [...$extra, ...$grants];
                }
            }
            $next = array_values(array_unique([...$permissions, ...$extra]));
            if ($next !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
            }
        }
    }

    /** The «La Ruta del Servidor» card of Involúcrate lists the new levels unless an admin already edited it. */
    private function refreshRouteArea(): void
    {
        $area = ServeArea::query()->where('slug', 'ruta-del-servidor')->first();
        if (! $area || ! $area->created_at || ! $area->updated_at || ! $area->created_at->equalTo($area->updated_at)) {
            return;
        }
        $defaults = collect(config('zoe.serve_areas'))->firstWhere('slug', 'ruta-del-servidor');
        $area->forceFill([
            'name' => $defaults['name'],
            'summary' => $defaults['summary'],
            'body' => $defaults['body'],
            'teams' => $defaults['teams'],
        ]);
        $area->updated_at = $area->created_at;
        $area->timestamps = false;
        $area->save();
        LoadPublicSite::flush();
    }

    /** Saved copies of the old page heading move to the new name; custom headings stay. */
    private function renameRoutePage(): void
    {
        $setting = SiteSetting::query()->where('key', 'site')->first();
        $site = is_array($setting?->value) ? $setting->value : null;
        if (! $site) {
            return;
        }
        $next = $site;
        if (in_array(mb_strtolower(trim((string) ($site['routeTitle'] ?? ''))), ['ruta del servidor', 'la ruta del servidor'], true)) {
            $next['routeTitle'] = config('zoe.settings.routeTitle');
        }
        if (trim((string) ($site['routeText'] ?? '')) === self::OLD_ROUTE_TEXT) {
            $next['routeText'] = config('zoe.settings.routeText');
        }
        if ($next !== $site) {
            $setting->update(['value' => $next]);
            LoadPublicSite::flush();
        }
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
