<?php

use App\Domain\Access\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('admin_types')->nullable();
            $table->json('permissions')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->date('spent_on');
            $table->string('category')->default('Otros');
            $table->text('detail');
            $table->decimal('amount', 12, 2);
            $table->string('receipt_path')->nullable();
            $table->timestamps();
            $table->index('spent_on');
        });

        $legacy = DB::table('site_settings')->where('key', 'admin_capabilities')->value('value');
        $legacy = is_string($legacy) ? (json_decode($legacy, true) ?: []) : [];
        $fromLegacy = array_keys(array_filter([
            'cells.manage' => ($legacy['manageCells'] ?? true) || ($legacy['manageMembers'] ?? false),
            'media.manage' => $legacy['manageMedia'] ?? true,
            'content.manage' => $legacy['manageContent'] ?? true,
            'generosity.manage' => $legacy['manageGenerosity'] ?? true,
            'reports.all' => $legacy['viewCellActivity'] ?? true,
            'offerings.weekly' => $legacy['viewOfferings'] ?? false,
        ]));

        foreach (DB::table('users')->get(['id', 'role']) as $user) {
            [$role, $types, $permissions] = match ($user->role) {
                'superadmin' => ['superadmin', [], []],
                'red_leader' => ['admin', ['red'], Permissions::forTypes(['red'])],
                'cell_leader' => ['admin', ['celula'], Permissions::clean(Permissions::SERVER_ACCOUNT)],
                default => ['admin', ['visuales'], Permissions::clean([...Permissions::forTypes(['visuales']), ...$fromLegacy])],
            };
            DB::table('users')->where('id', $user->id)->update([
                'role' => $role,
                'admin_types' => json_encode($types),
                'permissions' => json_encode($permissions),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['admin_types', 'permissions', 'active', 'created_by']);
        });
    }
};
