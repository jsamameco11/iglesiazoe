<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const PERMISSION = 'notices.manage';

    public function up(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'admin_types', 'permissions']) as $user) {
            $types = $this->decode($user->admin_types);
            $permissions = $this->decode($user->permissions);
            $eligible = in_array('visuales', $types, true)
                || in_array('content.manage', $permissions, true)
                || in_array('media.manage', $permissions, true);

            if ($eligible && ! in_array(self::PERMISSION, $permissions, true)) {
                DB::table('users')->where('id', $user->id)->update([
                    'permissions' => json_encode([...$permissions, self::PERMISSION]),
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('users')->get(['id', 'permissions']) as $user) {
            $permissions = $this->decode($user->permissions);
            if (in_array(self::PERMISSION, $permissions, true)) {
                DB::table('users')->where('id', $user->id)->update([
                    'permissions' => json_encode(array_values(array_diff($permissions, [self::PERMISSION]))),
                ]);
            }
        }
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
