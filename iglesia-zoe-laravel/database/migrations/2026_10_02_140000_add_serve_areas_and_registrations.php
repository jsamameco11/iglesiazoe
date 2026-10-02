<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\ServeArea;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('serve_areas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 80)->unique();
            $table->string('name', 80);
            $table->string('tagline', 120)->nullable();
            $table->string('summary', 300)->nullable();
            $table->text('body')->nullable();
            $table->json('teams')->nullable();
            $table->string('image_path')->nullable();
            $table->string('cta_label', 40)->nullable();
            $table->string('cta_url')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'sort_order']);
        });

        Schema::create('serve_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('serve_area_id')->nullable()->index();
            $table->string('area_name', 80);
            $table->string('team', 80)->nullable();
            $table->string('first_name', 60);
            $table->string('last_name', 80);
            $table->string('full_name', 160);
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('marital_status', 30)->nullable();
            $table->string('phone', 40);
            $table->string('email', 160)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        foreach (config('zoe.serve_areas') as $index => $area) {
            ServeArea::query()->create([...$area, 'sort_order' => $index + 1, 'active' => true]);
        }

        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'permissions']) as $user) {
            $permissions = $this->decode($user->permissions);
            if (in_array('inbox.visits', $permissions, true) && ! in_array('inbox.serve', $permissions, true)) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode([...$permissions, 'inbox.serve'])]);
            }
        }

        $site = SiteSetting::query()->find('site');
        if ($site && is_array($site->value) && array_key_exists('serveAreas', $site->value)) {
            $value = $site->value;
            unset($value['serveAreas']);
            $site->value = $value;
            $site->updated_at = now();
            $site->save();
        }
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'permissions']) as $user) {
            $next = array_values(array_diff($this->decode($user->permissions), ['inbox.serve']));
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
        }

        Schema::dropIfExists('serve_registrations');
        Schema::dropIfExists('serve_areas');
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
