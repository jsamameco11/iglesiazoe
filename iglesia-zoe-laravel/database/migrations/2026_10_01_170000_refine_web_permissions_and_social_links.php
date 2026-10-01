<?php

use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'admin_types', 'permissions']) as $user) {
            $types = $this->decode($user->admin_types);
            $permissions = $this->decode($user->permissions);
            $next = $permissions;

            if (in_array('visuales', $types, true)) {
                $next[] = 'generosity.manage';
            } elseif ($types !== []) {
                $next = array_diff($next, ['design.manage']);
            }

            $next = array_values(array_unique($next));
            if ($next !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
            }
        }

        $site = SiteSetting::query()->find('site');
        if ($site && is_array($site->value) && trim((string) ($site->value['youtube'] ?? '')) === '') {
            $site->value = [...$site->value, 'youtube' => config('zoe.settings.youtube')];
            $site->updated_at = now();
            $site->save();
        }
    }

    public function down(): void
    {
        foreach (DB::table('users')->where('role', '!=', 'superadmin')->get(['id', 'admin_types', 'permissions']) as $user) {
            $types = $this->decode($user->admin_types);
            $permissions = $this->decode($user->permissions);
            $next = in_array('visuales', $types, true)
                ? array_diff($permissions, ['generosity.manage'])
                : [...$permissions, 'design.manage'];
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values(array_unique($next)))]);
        }
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
