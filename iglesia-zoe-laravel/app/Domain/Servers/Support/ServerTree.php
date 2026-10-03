<?php

namespace App\Domain\Servers\Support;

use App\Domain\Access\CellScope;
use App\Domain\Access\Permissions;
use App\Domain\Cells\Support\CellCodes;
use App\Domain\Servers\Actions\OpenServer;
use App\Domain\Servers\ServerLevel;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Builds, network by network, the Servidor de Red → servidores → servidores hijo tree a user can see. */
final class ServerTree
{
    private Collection $byParent;

    private Collection $accounts;

    private function __construct(private readonly CellScope $scope) {}

    public static function for(User $user): array
    {
        return (new self(CellScope::for($user)))->build();
    }

    private function build(): array
    {
        $cellIds = $this->scope->treeCellIds();
        $cells = Cell::query()
            ->when($cellIds !== null, fn ($query) => $query->whereIn('id', $cellIds ?: [CellScope::NONE]))
            ->orderBy('number')
            ->get();
        $managed = $this->scope->manageNetworkIds();
        $networks = Network::query()->orderBy('code')
            ->when($managed !== null, fn ($query) => $query->whereIn('id', array_unique([...$managed, ...$cells->pluck('network_id')])))
            ->get(['id', 'code', 'name']);

        $visible = $cells->pluck('id')->flip();
        $this->byParent = $cells->groupBy(fn (Cell $cell) => $cell->parent_id && $visible->has($cell->parent_id) ? $cell->parent_id : 'top:'.$cell->network_id);
        $this->accounts = DB::table('user_cells')
            ->join('users', 'users.id', '=', 'user_cells.user_id')
            ->whereIn('user_cells.cell_id', $cells->pluck('id')->all() ?: [CellScope::NONE])
            ->orderBy('users.username')
            ->get(['user_cells.cell_id', 'users.username', 'users.name', 'users.active'])
            ->groupBy('cell_id');
        $leaders = $this->networkLeaders($networks->pluck('id')->all());

        return [
            'networks' => $networks->map(fn (Network $network) => $this->network($network, $leaders->get($network->id, collect())))->values(),
            'canAssignLeaders' => Permissions::isSuperadmin($this->scope->user),
            'leadsNetwork' => $this->scope->leadsNetwork(),
            'ownCell' => $this->ownCell(),
        ];
    }

    /** «Mi célula» card of a Servidor de Red: the cell he leads, or the form to open it. */
    private function ownCell(): ?array
    {
        $user = $this->scope->user;
        $network = $this->scope->network;
        if (Permissions::isSuperadmin($user) || ! $this->scope->leadsNetwork() || ! $network) {
            return null;
        }
        $cell = $this->scope->ownCell();
        $canOpen = $this->scope->canOpenOwnCell();
        if (! $cell && ! $canOpen) {
            return null;
        }

        return [
            'network_code' => $network->code,
            'can_open' => $canOpen,
            'next_code' => $canOpen ? CellCodes::root($network->code, OpenServer::nextNumber($network, null)) : null,
            'cell' => $cell ? [
                'code' => $cell->code,
                'leader_name' => $cell->leader_name,
                'meeting_day' => $cell->meeting_day,
                'meeting_time' => $cell->meeting_time ? substr($cell->meeting_time, 0, 5) : null,
            ] : null,
        ];
    }

    private function network(Network $network, Collection $leaders): array
    {
        $servers = $this->children('top:'.$network->id);
        $canOpen = $this->scope->canOpenServerIn($network->id);

        return [
            'id' => $network->id,
            'code' => $network->code,
            'name' => $network->name,
            'leaders' => $leaders->values(),
            'can_open' => $canOpen,
            'next_code' => $canOpen ? CellCodes::root($network->code, OpenServer::nextNumber($network, null)) : null,
            'servers' => $servers,
            'totals' => [
                'servers' => $servers->where('level', ServerLevel::Servidor->value)->count(),
                'children' => $servers->sum(fn (array $node) => $node['totals']['children']) + $servers->where('level', ServerLevel::Hijo->value)->count(),
            ],
        ];
    }

    private function children(string $key): Collection
    {
        return $this->byParent->get($key, collect())->map(fn (Cell $cell) => $this->node($cell))->values();
    }

    private function node(Cell $cell): array
    {
        $children = $this->children($cell->id);
        $accounts = collect($this->accounts->get($cell->id, []))
            ->map(fn ($row) => ['username' => $row->username, 'name' => $row->name, 'active' => (bool) $row->active])
            ->values();
        $canAddChild = $this->scope->canAddChildTo($cell);

        return [
            'id' => $cell->id,
            'code' => $cell->code,
            'level' => ServerLevel::ofCell($cell)->value,
            'leader_name' => $cell->leader_name,
            'meeting_day' => $cell->meeting_day,
            'meeting_time' => $cell->meeting_time ? substr($cell->meeting_time, 0, 5) : null,
            'active' => $cell->active,
            'own' => in_array($cell->id, $this->scope->own, true),
            'accounts' => $accounts,
            'can_add_child' => $canAddChild,
            'can_give_account' => $accounts->isEmpty() && $this->scope->oversees($cell),
            'next_child_code' => $canAddChild ? CellCodes::daughter($cell->code, $children->max(fn (array $child) => $child['number']) + 1) : null,
            'number' => $cell->number,
            'children' => $children,
            'totals' => ['children' => $children->count()],
        ];
    }

    private function networkLeaders(array $networkIds): Collection
    {
        return User::query()
            ->whereIn('network_id', $networkIds ?: [CellScope::NONE])
            ->orderBy('name')
            ->get(['id', 'name', 'username', 'network_id', 'admin_types', 'active'])
            ->filter(fn (User $user) => in_array('red', Permissions::cleanTypes($user->admin_types ?? []), true))
            ->map(fn (User $user) => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'network_id' => $user->network_id,
                'active' => $user->active !== false,
            ])
            ->groupBy('network_id');
    }
}
