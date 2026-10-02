<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INBOX = ['inbox.visits', 'inbox.baptisms', 'inbox.prayers'];

    private const INBOX_TYPES = ['red', 'visuales', 'atmosfera'];

    public function up(): void
    {
        Schema::table('prayer_requests', function (Blueprint $table) {
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('marital_status', 30)->nullable();
        });

        Schema::table('baptism_registrations', function (Blueprint $table) {
            $table->string('marital_status', 30)->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->json('inbox_seen')->nullable();
            $table->boolean('push_muted')->default(false);
        });

        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('endpoint');
            $table->char('endpoint_hash', 64)->unique();
            $table->string('public_key');
            $table->string('auth_token');
            $table->string('content_encoding', 20)->default('aes128gcm');
            $table->string('user_agent')->nullable();
            $table->timestamps();
        });

        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'admin_types', 'permissions']) as $user) {
            if (! array_intersect($this->decode($user->admin_types), self::INBOX_TYPES)) {
                continue;
            }
            $permissions = $this->decode($user->permissions);
            $next = array_values(array_unique([...$permissions, ...self::INBOX]));
            if ($next !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'permissions']) as $user) {
            $next = array_values(array_diff($this->decode($user->permissions), self::INBOX));
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
        }

        Schema::dropIfExists('push_subscriptions');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['inbox_seen', 'push_muted']);
        });
        Schema::table('baptism_registrations', function (Blueprint $table) {
            $table->dropColumn('marital_status');
        });
        Schema::table('prayer_requests', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'last_name', 'age', 'marital_status']);
        });
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
