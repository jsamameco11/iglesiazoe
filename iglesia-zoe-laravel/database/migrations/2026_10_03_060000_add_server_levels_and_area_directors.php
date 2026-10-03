<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Four tiers of servers: Servidor de Red (H), Servidor Base (01H), Servidor
 * hijo (0101H) and Servidor subhijo (020101H). Cell servers no longer open
 * servers; only Servidores de Red and the administrators given the function
 * do. Adds the area a Director de Área leads.
 */
return new class extends Migration
{
    private const CREATE = ['servers.create', 'servers.children'];

    public function up(): void
    {
        Schema::table('cells', function (Blueprint $table) {
            $table->string('level', 12)->default('servidor')->after('parent_id')->index();
        });
        Schema::table('users', function (Blueprint $table) {
            $table->string('area', 80)->nullable()->after('network_id');
        });

        $cells = DB::table('cells')->get(['id', 'parent_id', 'number'])->keyBy('id');
        foreach ($cells as $cell) {
            $depth = 0;
            for ($parent = $cell->parent_id; $parent && $cells->has($parent) && $depth < 3; $parent = $cells[$parent]->parent_id) {
                $depth++;
            }
            $level = match (true) {
                $depth === 0 => (int) $cell->number === 0 ? 'red' : 'servidor',
                $depth === 1 => 'hijo',
                default => 'subhijo',
            };
            DB::table('cells')->where('id', $cell->id)->update(['level' => $level]);
        }

        DB::table('users')->get(['id', 'role', 'admin_types', 'permissions'])->each(function ($user) {
            $types = json_decode((string) $user->admin_types, true) ?: [];
            $cellServer = $user->role === 'cell_leader' || ($types && ! array_diff($types, ['celula']));
            $permissions = json_decode((string) $user->permissions, true);
            if (! $cellServer || ! is_array($permissions) || ! array_intersect($permissions, self::CREATE)) {
                return;
            }
            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values(array_diff($permissions, self::CREATE)))]);
        });
    }

    public function down(): void
    {
        Schema::table('cells', function (Blueprint $table) {
            $table->dropIndex(['level']);
            $table->dropColumn('level');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('area');
        });
    }
};
