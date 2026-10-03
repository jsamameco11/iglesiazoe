<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\CellMember;
use App\Models\Network;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Details and members of the cells already opened from the Servidores page. */
class CellsController extends Controller
{
    public function index(Request $request): Response
    {
        $scope = CellScope::for($request->user());
        $ids = $scope->treeCellIds();
        $cells = Cell::query()->orderBy('number')
            ->when($ids !== null, fn ($query) => $query->whereIn('id', $ids ?: [CellScope::NONE]))
            ->get();

        return Inertia::render('Admin/Celulas', [
            'networks' => Network::query()->orderBy('code')->whereIn('id', $cells->pluck('network_id')->unique())->get(['id', 'code', 'name']),
            'cells' => $cells,
            'members' => CellMember::query()->where('active', true)
                ->whereIn('cell_id', $cells->pluck('id')->all() ?: [CellScope::NONE])
                ->orderBy('full_name')->get(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $cell = $this->reachable($request, $request->input('id'));
        if (! $cell) {
            return $this->outside();
        }
        $cell->update([
            'leader_name' => $request->input('leader_name'),
            'assistant_name' => $request->input('assistant_name'),
            'host_name' => $request->input('host_name'),
            'address' => $request->input('address'),
            'meeting_day' => $request->input('meeting_day'),
            'meeting_time' => $request->input('meeting_time'),
            'active' => $request->boolean('active'),
        ]);

        return $this->saved();
    }

    public function addMember(Request $request): JsonResponse
    {
        $cell = $this->reachable($request, $request->input('cell_id'));
        if (! $cell) {
            return $this->outside();
        }
        $name = trim((string) $request->input('full_name'));
        if ($name === '') {
            return $this->fail('Escribe el nombre del integrante.');
        }
        CellMember::query()->create([
            'cell_id' => $cell->id,
            'full_name' => $name,
            'phone' => $request->input('phone'),
            'active' => true,
        ]);

        return $this->saved();
    }

    public function removeMember(Request $request): JsonResponse
    {
        $id = (string) $request->input('id');
        $member = $this->find(CellMember::class, $id);
        if (! $member || ! $this->reachable($request, $member->cell_id)) {
            return $this->outside();
        }
        $member->update(['active' => false]);

        return $this->saved();
    }

    private function reachable(Request $request, mixed $id): ?Cell
    {
        $cell = $this->find(Cell::class, $id);

        return $cell && CellScope::for($request->user())->reaches($cell) ? $cell : null;
    }

    private function outside(): JsonResponse
    {
        return $this->fail('Esa célula no está a tu cargo.', 403);
    }
}
