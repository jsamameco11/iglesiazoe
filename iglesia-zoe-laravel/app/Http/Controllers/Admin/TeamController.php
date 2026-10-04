<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Actions\CreateAccount;
use App\Domain\Access\Delegation;
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

/** Equipo y accesos: the superadmin manages every account; any other administrator, only the team he created. */
class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $me = $request->user();
        $superadmin = Permissions::isSuperadmin($me);
        $managed = Delegation::managedIds($me);
        $users = User::query()->with(['network', 'cells'])
            ->where('role', '!=', Role::Student->value)
            ->when($managed !== null, fn ($query) => $query->whereIn('id', $managed))
            ->orderByRaw("case when role = 'superadmin' then 0 else 1 end")->orderBy('name')->get();
        $creators = User::query()->whereIn('id', $users->pluck('created_by')->filter()->unique())->pluck('name', 'id');
        $ownAreas = Inbox::serveAreasOf($me);

        return Inertia::render('Admin/Equipo', [
            'catalog' => Permissions::catalogPayload(),
            'scope' => [
                'superadmin' => $superadmin,
                'grantable' => Delegation::grantable($me),
                'types' => Delegation::assignableTypes($me),
                'mine' => Permissions::of($me),
            ],
            'networks' => $superadmin ? Network::query()->orderBy('code')->get(['id', 'code', 'name']) : [],
            'cells' => $superadmin ? Cell::query()->where('active', true)->orderBy('code')->pluck('code') : [],
            'meId' => (string) $me->id,
            'serveAreas' => ServeArea::query()->orderBy('sort_order')
                ->when($ownAreas !== null, fn ($query) => $query->whereIn('id', $ownAreas))
                ->get(['id', 'name', 'active'])
                ->map(fn (ServeArea $area) => ['id' => $area->id, 'name' => $area->name, 'active' => $area->active]),
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
                'creator' => $user->created_by ? ($creators[$user->created_by] ?? null) : null,
                'created_at' => optional($user->created_at)->toDateString(),
            ]),
        ]);
    }

    public function store(Request $request, CreateAccount $create): JsonResponse
    {
        $me = $request->user();
        $superadmin = Permissions::isSuperadmin($me);
        $types = Delegation::types($me, (array) $request->input('types', []));
        $permissions = Delegation::permissions($me, $types, (array) $request->input('permissions', []));
        $user = $create->handle([
            'name' => $request->input('name'),
            'username' => $request->input('username'),
            'password' => $request->input('password'),
            'types' => $types,
            'permissions' => $permissions,
            'network_id' => $superadmin ? $this->networkId($request) : null,
        ], $me);
        $user->update([
            'serve_areas' => $this->serveAreas($request, $me, $user->permissions ?? []),
            'area' => $this->area($request, $types),
        ]);
        if ($superadmin) {
            $this->syncCells($user, (string) $request->input('cells'));
        }

        return $this->saved("Cuenta {$user->username} creada.");
    }

    public function update(Request $request): JsonResponse
    {
        $me = $request->user();
        $user = $this->managedAccount($request);
        if (! $user) {
            return $this->fail('Esa cuenta no está en tu equipo.', 404);
        }
        if ($user->isSuperadmin()) {
            $user->update(['name' => trim((string) $request->input('name')) ?: $user->name]);

            return $this->saved('Datos guardados.');
        }
        $superadmin = Permissions::isSuperadmin($me);
        $types = Delegation::types($me, (array) $request->input('types', []), Permissions::typesOf($user));
        $before = Permissions::of($user);
        $permissions = Delegation::permissions($me, $types, (array) $request->input('permissions', []), $before);
        $networkId = $superadmin ? $this->networkId($request) : $user->network_id;
        $active = $request->boolean('active');
        if ($superadmin && $active && $networkId && in_array('red', $types, true)) {
            NetworkLeaders::ensureRoom($networkId, $user);
        }
        $user->update([
            'name' => trim((string) $request->input('name')) ?: $user->name,
            'admin_types' => $types,
            'permissions' => $permissions,
            'serve_areas' => $this->serveAreas($request, $me, $permissions),
            'area' => $this->area($request, $types),
            'network_id' => $networkId,
            'active' => $active,
        ]);
        if ($superadmin) {
            $this->syncCells($user, (string) $request->input('cells'));
        }
        Delegation::cascade($user, array_diff($before, $permissions));

        return $this->saved('Accesos actualizados.');
    }

    public function password(Request $request): JsonResponse
    {
        $password = (string) $request->input('password');
        if (! Credentials::validPassword($password)) {
            return $this->fail('La clave debe tener al menos '.Credentials::MIN_PASSWORD.' caracteres.');
        }
        $user = $this->managedAccount($request);
        if (! $user) {
            return $this->fail('Esa cuenta no está en tu equipo.', 404);
        }
        $user->password = $password;
        $user->save();

        return response()->json(['ok' => true, 'message' => "Clave de {$user->username} actualizada."]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $me = $request->user();
        if ((string) $request->input('id') === (string) $me->id) {
            return $this->fail('No puedes eliminar tu propia cuenta.');
        }
        $user = $this->managedAccount($request);
        if (! $user) {
            return $this->fail('Esa cuenta no está en tu equipo.', 404);
        }
        if ($user->isSuperadmin()) {
            return $this->fail('Las cuentas SUPERADMI no se eliminan desde el panel.');
        }
        User::query()->where('created_by', $user->id)->update(['created_by' => $me->id]);
        $user->cells()->detach();
        $user->delete();

        return $this->saved('Cuenta eliminada.');
    }

    /** The account asked for, only when it belongs to the team of whoever asks; the superadmin may also edit himself. */
    private function managedAccount(Request $request): ?User
    {
        $me = $request->user();
        $user = User::query()->where('role', '!=', Role::Student->value)->find((int) $request->input('id'));
        if (! $user) {
            return null;
        }
        if (Permissions::isSuperadmin($me)) {
            return $user;
        }

        return Delegation::manages($me, $user) ? $user : null;
    }

    /** Only kept with the «Quiero servir» function; an empty list means every área the creator receives. */
    private function serveAreas(Request $request, User $me, array $permissions): ?array
    {
        if (! in_array('inbox.serve', $permissions, true)) {
            return null;
        }
        $chosen = array_filter((array) $request->input('serve_areas', []), 'is_string');
        $areas = $chosen ? ServeArea::query()->whereIn('id', $chosen)->pluck('id')->map(fn ($id) => (string) $id)->values()->all() : [];

        return Delegation::serveAreas($me, $areas);
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
