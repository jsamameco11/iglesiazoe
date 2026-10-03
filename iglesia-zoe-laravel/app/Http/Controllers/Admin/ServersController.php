<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\CellScope;
use App\Domain\Servers\Actions\CreateServerAccount;
use App\Domain\Servers\Actions\OpenOwnCell;
use App\Domain\Servers\Actions\OpenServer;
use App\Domain\Servers\Actions\UpdateNetworkLeader;
use App\Domain\Servers\ServerLevel;
use App\Domain\Servers\Support\NetworkLeaders;
use App\Domain\Servers\Support\ServerTree;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServersController extends Controller
{
    private const LEADER_RULES = [
        'name' => ['required', 'string', 'max:120'],
        'username' => ['required', 'string'],
    ];

    private const LEADER_MESSAGES = [
        'name.required' => 'Escribe el nombre del Servidor de Red.',
        'name.max' => 'El nombre es demasiado largo.',
        'username.required' => 'Escribe el usuario o DNI.',
        'password.required' => 'Escribe la clave.',
    ];

    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Servidores', ServerTree::for($request->user()));
    }

    public function storeNetworkServer(Request $request, CreateServerAccount $accounts): JsonResponse
    {
        $network = $this->find(Network::class, $request->input('network_id'));
        if (! $network) {
            return $this->fail('Elige la red.');
        }
        if (! CellScope::for($request->user())->managesNetwork($network->id)) {
            return $this->fail("La Red {$network->code} no está a tu cargo.", 403);
        }
        $data = $request->validate([
            ...self::LEADER_RULES,
            'password' => ['required', 'string'],
        ], self::LEADER_MESSAGES);
        $user = $accounts->forNetwork($network, $data, $request->user());

        return $this->saved("{$user->name} es Servidor de Red de la Red {$network->code} (usuario {$user->username}).");
    }

    public function updateNetworkServer(Request $request, UpdateNetworkLeader $update): JsonResponse
    {
        $leader = User::query()->find((int) $request->input('id'));
        if (! $leader || $leader->isSuperadmin() || ! NetworkLeaders::is($leader) || ! $leader->network_id) {
            return $this->fail('Ese Servidor de Red ya no existe. Recarga la página.', 404);
        }
        if (! CellScope::for($request->user())->managesNetwork($leader->network_id)) {
            return $this->fail('Ese Servidor de Red no está a tu cargo.', 403);
        }
        $data = $request->validate([
            ...self::LEADER_RULES,
            'password' => ['nullable', 'string'],
            'active' => ['required', 'boolean'],
        ], self::LEADER_MESSAGES);
        if ($leader->is($request->user()) && ! $data['active']) {
            return $this->fail('No puedes desactivar tu propia cuenta.');
        }
        $update->handle($leader, $data);

        return $this->saved("Datos de {$leader->name} guardados.");
    }

    public function storeServer(Request $request, OpenServer $open): JsonResponse
    {
        $network = $this->find(Network::class, $request->input('network_id'));
        if (! $network || ! CellScope::for($request->user())->canOpenServerIn($network->id)) {
            return $this->fail('No tienes permiso para abrir servidores en esta red. El superadministrador lo activa en Equipo y accesos.', 403);
        }
        [$cell, $account] = $open->handle($network, null, $this->serverData($request), $request->user());

        return $this->saved($this->created($cell, $account));
    }

    public function storeOwnCell(Request $request, OpenOwnCell $open): JsonResponse
    {
        $user = $request->user();
        $scope = CellScope::for($user);
        if (! $scope->canOpenOwnCell()) {
            $cell = $scope->ownCell();

            return $cell
                ? $this->fail("Ya tienes tu célula {$cell->code}.")
                : $this->fail('Solo el Servidor de Red con permiso para abrir su propia célula puede hacerlo.', 403);
        }
        $data = $request->validate([
            'kind' => ['required', Rule::in(OpenOwnCell::KINDS)],
            'meeting_day' => ['nullable', Rule::in(Cell::MEETING_DAYS)],
            'meeting_time' => ['nullable', 'date_format:H:i'],
        ], [
            'kind.required' => 'Elige cómo quieres tu célula.',
            'kind.in' => 'Elige cómo quieres tu célula.',
            'meeting_day.in' => 'Elige un día de la lista.',
            'meeting_time.date_format' => 'La hora no es válida.',
        ]);
        $schedule = ['meeting_day' => $data['meeting_day'] ?? null, 'meeting_time' => $data['meeting_time'] ?? null];
        $cell = $open->handle($user, $scope->network, $data['kind'], $this->find(Cell::class, $request->input('cell_id')), $schedule);

        return $this->saved("Tu célula {$cell->code} está lista. Ya puedes subir su informe desde «Subir informe».");
    }

    public function storeChild(Request $request, OpenServer $open): JsonResponse
    {
        $parent = $this->find(Cell::class, $request->input('parent_id'));
        if (! $parent || ! CellScope::for($request->user())->canAddChildTo($parent)) {
            return $this->fail('No puedes añadir servidores hijo a este servidor. Necesitas el permiso «Crear servidores hijo» y que el servidor esté a tu cargo.', 403);
        }
        [$cell, $account] = $open->handle($parent->network, $parent, $this->serverData($request), $request->user());

        return $this->saved($this->created($cell, $account));
    }

    public function storeAccount(Request $request, CreateServerAccount $accounts): JsonResponse
    {
        $cell = $this->find(Cell::class, $request->input('cell_id'));
        if (! $cell || ! CellScope::for($request->user())->oversees($cell)) {
            return $this->fail('Ese servidor no está a tu cargo.', 403);
        }
        if ($cell->isNetworkCell()) {
            return $this->fail("La célula {$cell->code} es la del Servidor de Red; su cuenta se crea como Servidor de Red.");
        }
        if ($cell->users()->exists()) {
            return $this->fail("{$cell->code} ya tiene cuenta.");
        }
        $user = $accounts->forCell($cell, $request->only('username', 'password'), $request->user());

        return $this->saved("Cuenta {$user->username} creada para {$cell->code}.");
    }

    private function serverData(Request $request): array
    {
        return $request->validate([
            'leader_name' => ['required', 'string', 'max:120'],
            'meeting_day' => ['nullable', Rule::in(Cell::MEETING_DAYS)],
            'meeting_time' => ['nullable', 'date_format:H:i'],
            'username' => ['nullable', 'string', 'required_with:password'],
            'password' => ['nullable', 'string'],
        ], [
            'leader_name.required' => 'Escribe el nombre del servidor.',
            'leader_name.max' => 'El nombre es demasiado largo.',
            'meeting_day.in' => 'Elige un día de la lista.',
            'meeting_time.date_format' => 'La hora no es válida.',
            'username.required_with' => 'Escribe el usuario o DNI de la cuenta.',
        ]);
    }

    private function created(Cell $cell, ?User $account): string
    {
        $label = ServerLevel::ofCell($cell)->label();

        return "$label {$cell->code} creado".($account ? " con la cuenta {$account->username}." : '.');
    }
}
