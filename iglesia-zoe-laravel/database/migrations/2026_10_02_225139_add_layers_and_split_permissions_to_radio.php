<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY = 'radio.manage';

    private const SPLIT = ['radio.console', 'radio.schedule', 'radio.library', 'radio.settings'];

    public function up(): void
    {
        Schema::table('radio_slots', function (Blueprint $table) {
            $table->unsignedTinyInteger('layer')->default(0)->after('kind');
            $table->boolean('duck')->default(false)->after('bed');
            $table->unsignedTinyInteger('volume')->default(100)->after('duck');
            $table->index(['layer', 'starts_at']);
        });

        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->boolean('duck')->default(false)->after('rotation');
        });
        DB::table('radio_tracks')->whereIn('kind', ['anuncio', 'programa'])->update(['duck' => true]);

        $this->swap([self::LEGACY], self::SPLIT);
    }

    public function down(): void
    {
        $this->swap(self::SPLIT, [self::LEGACY]);

        Schema::table('radio_tracks', function (Blueprint $table) {
            $table->dropColumn('duck');
        });

        Schema::table('radio_slots', function (Blueprint $table) {
            $table->dropIndex(['layer', 'starts_at']);
            $table->dropColumn(['layer', 'duck', 'volume']);
        });
    }

    /** Accounts holding any of $from get $to instead. */
    private function swap(array $from, array $to): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $decoded = is_string($user->permissions) ? json_decode($user->permissions, true) : $user->permissions;
            $permissions = is_array($decoded) ? array_values($decoded) : [];
            if (! array_intersect($permissions, $from)) {
                continue;
            }
            $next = array_values(array_unique([...array_diff($permissions, $from), ...$to]));
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
        }
    }
};
