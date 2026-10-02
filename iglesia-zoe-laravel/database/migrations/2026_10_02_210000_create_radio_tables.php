<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const GRANTS = ['visuales' => ['radio.manage']];

    public function up(): void
    {
        Schema::create('radio_tracks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('kind', 12)->default('musica');
            $table->string('title', 160);
            $table->string('artist', 120)->nullable();
            $table->string('file_path');
            $table->decimal('duration', 8, 2);
            $table->boolean('rotation')->default(true);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['kind', 'active']);
        });

        Schema::create('radio_slots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->dateTime('starts_at');
            $table->decimal('duration', 8, 2);
            $table->string('kind', 12);
            $table->foreignUuid('radio_track_id')->nullable()->constrained('radio_tracks')->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('note', 240)->nullable();
            $table->boolean('bed')->default(false);
            $table->timestamps();
            $table->index('starts_at');
        });

        Schema::create('radio_listeners', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('session', 40)->nullable();
            $table->string('state', 12)->default('idle');
            $table->text('offer')->nullable();
            $table->text('answer')->nullable();
            $table->dateTime('last_seen');
            $table->dateTime('state_at')->nullable();
            $table->index('last_seen');
            $table->index(['session', 'state']);
        });

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

    public function down(): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $permissions = $this->decode($user->permissions);
            $kept = array_values(array_diff($permissions, ['radio.manage']));
            if ($kept !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($kept)]);
            }
        }

        Schema::dropIfExists('radio_listeners');
        Schema::dropIfExists('radio_slots');
        Schema::dropIfExists('radio_tracks');
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
