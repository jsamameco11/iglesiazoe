<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LIBRARY = 'radio.library';

    private const EPISODES = 'radio.episodes';

    /** Episodes: recorded programs of the library published on /radio. Whoever manages the library also manages them. */
    public function up(): void
    {
        Schema::create('radio_episodes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('radio_track_id')->constrained('radio_tracks')->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('program', 120)->nullable();
            $table->string('description', 400)->nullable();
            $table->string('cover_path')->nullable();
            $table->date('aired_on');
            $table->boolean('published')->default(true);
            $table->timestamps();
            $table->index(['published', 'aired_on']);
        });

        $this->each(fn (array $permissions) => in_array(self::LIBRARY, $permissions, true) ? [...$permissions, self::EPISODES] : $permissions);
    }

    public function down(): void
    {
        $this->each(fn (array $permissions) => array_diff($permissions, [self::EPISODES]));

        Schema::dropIfExists('radio_episodes');
    }

    /** Applies $change to every account's permissions and saves only the accounts that changed. */
    private function each(callable $change): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $decoded = is_string($user->permissions) ? json_decode($user->permissions, true) : $user->permissions;
            $permissions = is_array($decoded) ? array_values($decoded) : [];
            $next = array_values(array_unique($change($permissions)));
            if ($next !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
            }
        }
    }
};
