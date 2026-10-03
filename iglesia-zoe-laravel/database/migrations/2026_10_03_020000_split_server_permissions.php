<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CREATE = 'servers.create';

    private const CHILDREN = 'servers.children';

    private const OWN = 'cells.own';

    /**
     * «Crear servidores y servidores hijo» becomes two functions. Whoever had
     * it keeps both; a servidor's account only ever added servidores hijo, so it
     * keeps just that. Every Servidor de Red can open his own cell. Filing other
     * servidores' reports («reports.delegate») starts off for everyone.
     */
    public function up(): void
    {
        $this->each(function (array $permissions, array $types) {
            $next = $permissions;
            if (in_array(self::CREATE, $next, true)) {
                $next[] = self::CHILDREN;
                if (in_array('celula', $types, true) && ! in_array('red', $types, true)) {
                    $next = array_diff($next, [self::CREATE]);
                }
            }
            if (in_array('red', $types, true)) {
                $next[] = self::OWN;
            }

            return $next;
        });
    }

    public function down(): void
    {
        $this->each(function (array $permissions) {
            $next = array_diff($permissions, [self::OWN, 'reports.delegate']);
            if (in_array(self::CHILDREN, $next, true)) {
                $next = [...array_diff($next, [self::CHILDREN]), self::CREATE];
            }

            return $next;
        });
    }

    /** Applies $change to every account's permissions and saves only the accounts that changed. */
    private function each(callable $change): void
    {
        foreach (DB::table('users')->get(['id', 'permissions', 'admin_types']) as $user) {
            $permissions = $this->decode($user->permissions);
            $next = array_values(array_unique($change($permissions, $this->decode($user->admin_types))));
            if ($next !== $permissions) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($next)]);
            }
        }
    }

    private function decode(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }
};
