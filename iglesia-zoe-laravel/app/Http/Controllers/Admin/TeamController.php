<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Actions\CreateAccount;
use App\Domain\Access\Permissions;
use App\Domain\Access\Support\Credentials;
use App\Domain\Inbox\Inbox;
use App\Domain\Servers\Support\NetworkLeaders;
use App\Domain\Shared\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Cell;
use App\Models\Network;
use App\Models\ServeArea;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $networks = Network::query()->orderBy('code')->get(['id', 'code', 'name']);
        $users = User::query()->with(['network', 'cells'])->where('role', '!=', Role::Student->value)->orderByRaw("case when role = 'superadmin' then 0 else 1 end")->orderBy('name')->get();

        return Inertia::render('Admin/Equipo', [
            'catalog' => Permissions::catalogPayload(),
            'networks' => $networks,
            'cells' => Cell::query()->where('active', true)->orderBy('code')->pluck('code'),
            'meId' => (string) $request->user()->id,
            'serveAreas' => ServeArea::query()->orderBy('sort_order')->get(['id', 'name', 'active'])->map(fn (ServeArea $area) => ['id' => $area->id, 'name' => $area->name, 'active' => $area->active]),
            'accounts' => $users->map(fn (User $user) => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'superadmin' => $user->isSuperadmin(),
                'types' => Permissions::typesOf($user),
                'permissions' => Permissions::of($user),
                'network_code' => $user->network?->code,
                'cells' => $user->cells->pluck('code')->sort()->values(),
                'serve_areas' => Inbox::serveAreasOf($user) ?? [],
                'area' => $user->area,
                'active' => $user->active !== false,
                'label' => Permissions::label($user),
                'created_at' => optional($user->created_at)->toDateString(),
            ]),
        ]);
    }

    public function store(Request $request, CreateAccount $create): JsonResponse
    {
        $user = $create->handle([
            'name' => $request->input('name'),
            'username' => $request->input('username'),
            'password' => $request->input('password'),
            'types' => (array) $request->input('types', []),
            'permissions' => (array) $request->input('permissions', []),
            'network_id' => $this->networkId($request),
        ], $request->user());
        $user->update([
            'serve_areas' => $this->serveAreas($request, $user->permissions ?? []),
            'area' => $this->area($request, $user->admin_types ?? []),
        ]);
        $this->syncCells($user, (string) $request->input('cells'));

        return $this->saved("Cuenta {$user->username} creada.");
    }

    public function update(Request $request): JsonResponse
    {
        $user = User::query()->findOrFail((int) $request->input('id'));
        if ($user->isSuperadmin()) {
            $user->update(['name' => trim((string) $request->input('name')) ?: $user->name]);

            return $this->saved('Datos guardados.');
        }
        $types = Permissions::cleanTypes((array) $request->input('types', []));
        $permissions = Permissions::resolve($types, (array) $request->input('permissions', []));
        $networkId = $this->networkId($request);
        $active = $request->boolean('active');
        if ($active && $networkId && in_array('red', $types, true)) {
            NetworkLeaders::ensureRoom($networkId, $user);
        }
        $user->update([
            'name' => trim((string) $request->input('name')) ?: $user->name,
            'admin_types' => $types,
            'permissions' => $permissions,
            'serve_areas' => $this->serveAreas($request, $permissions),
            'area' => $this->area($request, $types),
            'network_id' => $networkId,
            'active' => $active,
        ]);
        $this->syncCells($user, (string) $request->input('cells'));

        return $this->saved('Accesos actualizados.');
    }

    public function password(Request $request): JsonResponse
    {
        $password = (string) $request->input('password');
        if (! Credentials::validPassword($password)) {
            return $this->fail('La clave debe tener al menos '.Credentials::MIN_PASSWORD.' caracteres.');
        }
        $user = User::query()->findOrFail((int) $request->input('id'));
        $user->password = $password;
        $user->save();

        return response()->json(['ok' => true, 'message' => "Clave de {$user->username} actualizada."]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = User::query()->findOrFail((int) $request->input('id'));
        if ($user->id === $request->user()->id) {
            return $this->fail('No puedes eliminar tu propia cuenta.');
        }
        if ($user->isSuperadmin()) {
            return $this->fail('Las cuentas SUPERADMI no se eliminan desde el panel.');
        }
        $user->cells()->detach();
        $user->delete();

        return $this->saved('Cuenta eliminada.');
    }

    /** Only kept with the «Quiero servir» function; an empty list means every área. */
    private function serveAreas(Request $request, array $permissions): ?array
    {
        $chosen = array_filter((array) $request->input('serve_areas', []), 'is_string');
        if (! in_array('inbox.serve', $permissions, true) || ! $chosen) {
            return null;
        }
        $areas = ServeArea::query()->whereIn('id', $chosen)->pluck('id')->map(fn ($id) => (string) $id)->values()->all();

        return $areas ?: null;
    }

    /** The area a Director de Área leads; other types keep none. */
    private function area(Request $request, array $types): ?string
    {
        $area = mb_substr(trim((string) $request->input('area')), 0, 80);

        return in_array('director', $types, true) && $area !== '' ? $area : null;
    }

    private function networkId(Request $request): ?string
    {
        $code = strtoupper(trim((string) $request->input('network_code')));

        return $code === '' ? null : Network::query()->where('code', $code)->value('id');
    }

    private function syncCells(User $user, string $codes): void
    {
        $list = collect(preg_split('/[\s,;]+/', strtoupper($codes)))->filter()->unique();
        $user->cells()->sync($list->isEmpty() ? [] : Cell::query()->whereIn('code', $list)->pluck('id')->all());
    }
}
