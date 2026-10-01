<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Actions\CreateAccount;
use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ServersController extends Controller
{
    public function index(Request $request): Response
    {
        $allowed = CellScope::for($request->user())->manageNetworkIds();
        $networks = Network::query()->orderBy('code')
            ->when($allowed !== null, fn ($query) => $query->whereIn('id', $allowed))
            ->get(['id', 'code', 'name']);
        $cells = Cell::query()->whereIn('network_id', $networks->pluck('id'))->orderBy('code')->get();
        $accounts = DB::table('user_cells')
            ->join('users', 'users.id', '=', 'user_cells.user_id')
            ->whereIn('user_cells.cell_id', $cells->pluck('id')->all() ?: [CellScope::NONE])
            ->get(['user_cells.cell_id', 'users.username', 'users.name'])
            ->groupBy('cell_id');

        return Inertia::render('Admin/Servidores', [
            'networks' => $networks,
            'cells' => $cells->map(fn (Cell $cell) => [
                'id' => $cell->id,
                'network_id' => $cell->network_id,
                'parent_id' => $cell->parent_id,
                'code' => $cell->code,
                'number' => $cell->number,
                'leader_name' => $cell->leader_name,
                'meeting_day' => $cell->meeting_day,
                'meeting_time' => $cell->meeting_time,
                'active' => $cell->active,
                'accounts' => collect($accounts->get($cell->id, []))->map(fn ($row) => ['username' => $row->username, 'name' => $row->name])->values(),
            ]),
        ]);
    }

    public function storeRoot(Request $request, CreateAccount $create): JsonResponse
    {
        $network = Network::query()->find($this->uuid($request->input('network_id')));
        if (! $network || ! $this->canUseNetwork($request->user(), $network->id)) {
            return response()->json(['error' => 'No puedes abrir células en esa red.'], 403);
        }

        return DB::transaction(function () use ($request, $create, $network) {
            $number = (int) Cell::query()->where('network_id', $network->id)->whereNull('parent_id')->max('number') + 1;
            $cell = Cell::query()->create([
                'network_id' => $network->id,
                'number' => $number,
                'code' => CellCodes::root($network->code, $number),
                'leader_name' => trim((string) $request->input('leader_name')) ?: null,
                'meeting_day' => $request->input('meeting_day') ?: null,
                'meeting_time' => $request->input('meeting_time') ?: null,
                'active' => true,
            ]);
            $username = $this->attachAccount($request, $create, $cell);

            return response()->json(['ok' => true, 'reload' => true, 'message' => "Servidor {$cell->code} creado".($username ? " con la cuenta $username." : '.')]);
        });
    }

    public function storeChild(Request $request, CreateAccount $create): JsonResponse
    {
        $parent = Cell::query()->find($this->uuid($request->input('parent_id')));
        if (! $parent || ! $this->canUseNetwork($request->user(), $parent->network_id)) {
            return response()->json(['error' => 'No puedes crear hijos de esa célula.'], 403);
        }

        return DB::transaction(function () use ($request, $create, $parent) {
            $number = (int) Cell::query()->where('parent_id', $parent->id)->max('number') + 1;
            $cell = Cell::query()->create([
                'network_id' => $parent->network_id,
                'parent_id' => $parent->id,
                'number' => $number,
                'code' => CellCodes::daughter($parent->code, $number),
                'leader_name' => trim((string) $request->input('leader_name')) ?: null,
                'meeting_day' => $request->input('meeting_day') ?: null,
                'meeting_time' => $request->input('meeting_time') ?: null,
                'active' => true,
            ]);
            $username = $this->attachAccount($request, $create, $cell);

            return response()->json(['ok' => true, 'reload' => true, 'message' => "Servidor hijo {$cell->code} creado".($username ? " con la cuenta $username." : '.')]);
        });
    }

    private function attachAccount(Request $request, CreateAccount $create, Cell $cell): ?string
    {
        if (! $request->filled('username')) {
            return null;
        }
        $user = $create->handle([
            'name' => $request->input('leader_name') ?: $request->input('username'),
            'username' => $request->input('username'),
            'password' => $request->input('password'),
            'types' => ['celula'],
            'permissions' => Permissions::SERVER_ACCOUNT,
            'network_id' => $cell->network_id,
        ], $request->user());
        $user->cells()->syncWithoutDetaching([$cell->id]);

        return $user->username;
    }

    private function canUseNetwork(User $user, string $networkId): bool
    {
        $allowed = CellScope::for($user)->manageNetworkIds();

        return $allowed === null || in_array($networkId, $allowed, true);
    }

    private function uuid(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^[0-9a-f-]{36}$/i', $value) ? $value : null;
    }
}
