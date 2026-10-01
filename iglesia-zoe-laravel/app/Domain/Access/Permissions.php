<?php

namespace App\Domain\Access;

use App\Domain\Shared\Enums\Role;
use App\Models\User;

class Permissions
{
    public const CATALOG = [
        'reports.submit' => ['group' => 'Células', 'title' => 'Subir informes', 'text' => 'Registra el informe semanal de sus células con asistencia, ofrenda, diezmos y fotos.'],
        'reports.weekly' => ['group' => 'Células', 'title' => 'Reporte semanal', 'text' => 'Ve el seguimiento de la semana de su red.'],
        'reports.all' => ['group' => 'Células', 'title' => 'Reportes de todos los servidores', 'text' => 'Ve los informes de todas las células y filtra por semana, mes o año.'],
        'offerings.weekly' => ['group' => 'Células', 'title' => 'Ofrendas por semana', 'text' => 'Ve la ofrenda de cada célula semana por semana, sin el tablero de ingresos.'],
        'servers.create' => ['group' => 'Células', 'title' => 'Crear servidores y servidores hijo', 'text' => 'Abre nuevas células o células hijas y crea la cuenta de su servidor.'],
        'cells.manage' => ['group' => 'Células', 'title' => 'Células e integrantes', 'text' => 'Edita datos de cada célula y su lista de integrantes.'],
        'design.manage' => ['group' => 'Página web', 'title' => 'Diseño de la página', 'text' => 'Paleta de colores, tipografías, colores y tamaños de texto, y formas, página por página.'],
        'media.manage' => ['group' => 'Página web', 'title' => 'Imágenes y videos', 'text' => 'Cambia fotos y videos de la web y la cantidad de imágenes de la galería.'],
        'content.manage' => ['group' => 'Página web', 'title' => 'Textos y secciones', 'text' => 'Edita textos, ministerios, prédicas, bautismos, temas y la bandeja.'],
        'generosity.manage' => ['group' => 'Página web', 'title' => 'Datos de generosidad', 'text' => 'Edita cuentas y medios de pago visibles en la web.'],
        'notices.manage' => ['group' => 'Página web', 'title' => 'Indicaciones de la semana', 'text' => 'Publica el aviso emergente que ven los servidores al entrar a /acceso: título, vigencia y todos los puntos de la semana.'],
        'expenses.manage' => ['group' => 'Atmósfera', 'title' => 'Gastos y compras', 'text' => 'Registra compras con foto de la boleta, detalle y monto.'],
    ];

    public const TYPES = [
        'red' => [
            'label' => 'Servidor de Red',
            'text' => 'Sube informes, ve reportes de todos los servidores, ve ofrendas por semana y crea servidores.',
            'permissions' => ['reports.submit', 'reports.weekly', 'reports.all', 'offerings.weekly', 'servers.create', 'cells.manage'],
        ],
        'visuales' => [
            'label' => 'Visuales · Multimedia',
            'text' => 'Todo lo estético de la página: imágenes, videos, textos, formas, colores, tipografías y las indicaciones de la semana.',
            'permissions' => ['design.manage', 'media.manage', 'content.manage', 'notices.manage'],
        ],
        'celula' => [
            'label' => 'Servidor de Célula',
            'text' => 'Sube sus informes y ve el reporte de la semana.',
            'permissions' => ['reports.submit', 'reports.weekly'],
        ],
        'atmosfera' => [
            'label' => 'Servidor Atmósfera',
            'text' => 'Registra los gastos y compras de la iglesia con su boleta.',
            'permissions' => ['expenses.manage'],
        ],
    ];

    public const DEFAULTS = ['servers.create', 'design.manage'];

    public const SERVER_ACCOUNT = ['reports.submit', 'reports.weekly', 'servers.create'];

    public static function keys(): array
    {
        return array_keys(self::CATALOG);
    }

    public static function forTypes(array $types, bool $withDefaults = true): array
    {
        $permissions = $withDefaults ? self::DEFAULTS : [];
        foreach ($types as $type) {
            $permissions = [...$permissions, ...(self::TYPES[$type]['permissions'] ?? [])];
        }

        return self::clean($permissions);
    }

    public static function clean(array $permissions): array
    {
        return array_values(array_intersect(self::keys(), array_unique($permissions)));
    }

    public static function cleanTypes(array $types): array
    {
        return array_values(array_intersect(array_keys(self::TYPES), array_unique($types)));
    }

    public static function of(?User $user): array
    {
        if (! $user) {
            return [];
        }
        if (self::isSuperadmin($user)) {
            return self::keys();
        }

        return self::clean(is_array($user->permissions) ? $user->permissions : []);
    }

    public static function has(?User $user, string $permission): bool
    {
        return self::isSuperadmin($user) || in_array($permission, self::of($user), true);
    }

    public static function any(?User $user, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (self::has($user, $permission)) {
                return true;
            }
        }

        return false;
    }

    public static function isSuperadmin(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        $role = $user->role instanceof Role ? $user->role : Role::tryFrom((string) $user->role);

        return $role === Role::Superadmin;
    }

    public static function label(?User $user): string
    {
        if (self::isSuperadmin($user)) {
            return 'SUPERADMI';
        }
        $types = self::cleanTypes(is_array($user?->admin_types) ? $user->admin_types : []);
        if (! $types) {
            return 'ADMINISTRADOR';
        }

        return implode(' · ', array_map(fn ($type) => mb_strtoupper(self::TYPES[$type]['label']), $types));
    }

    public static function catalogPayload(): array
    {
        return [
            'permissions' => collect(self::CATALOG)->map(fn ($item, $key) => ['key' => $key, ...$item])->values()->all(),
            'types' => collect(self::TYPES)->map(fn ($item, $key) => ['key' => $key, ...$item])->values()->all(),
            'defaults' => self::DEFAULTS,
        ];
    }
}
