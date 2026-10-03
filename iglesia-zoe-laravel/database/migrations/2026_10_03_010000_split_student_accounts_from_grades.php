<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const GRADES = 'studies.grades';

    private const STUDENTS = 'studies.students';

    /** Whoever kept grades also managed the student accounts and levels, so they keep doing both. */
    public function up(): void
    {
        $this->each(fn (array $permissions) => in_array(self::GRADES, $permissions, true) && ! in_array(self::STUDENTS, $permissions, true)
            ? [...$permissions, self::STUDENTS]
            : null);
    }

    public function down(): void
    {
        $this->each(function (array $permissions) {
            if (! in_array(self::STUDENTS, $permissions, true)) {
                return null;
            }
            $next = array_values(array_diff($permissions, [self::STUDENTS]));

            return in_array(self::GRADES, $next, true) ? $next : [...$next, self::GRADES];
        });
    }

    /** Applies $change to every account's permissions; a null result leaves the account untouched. */
    private function each(callable $change): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $decoded = is_string($user->permissions) ? json_decode($user->permissions, true) : $user->permissions;
            $next = $change(is_array($decoded) ? array_values($decoded) : []);
            if ($next !== null) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values(array_unique($next)))]);
            }
        }
    }
};
