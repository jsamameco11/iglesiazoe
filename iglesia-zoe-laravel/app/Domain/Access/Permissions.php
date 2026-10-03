<?php

namespace App\Domain\Access;

use App\Domain\Shared\Enums\Role;
use App\Models\User;

class Permissions
{
    public const CATALOG = [
        'reports.submit' => ['group' => 'Células', 'title' => 'Subir informes', 'text' => 'Registra el informe semanal de su propia célula con asistencia, ofrenda, diezmos y fotos.'],
        'reports.delegate' => ['group' => 'Células', 'title' => 'Subir informes de sus servidores', 'text' => 'Sube o corrige el informe semanal de los servidores y servidores hijo de su red cuando ellos no pueden. Apagado por defecto: cada servidor sube el suyo.'],
        'reports.weekly' => ['group' => 'Células', 'title' => 'Reporte semanal', 'text' => 'Ve el seguimiento de la semana de su red.'],
        'reports.all' => ['group' => 'Células', 'title' => 'Reportes de todos los servidores', 'text' => 'Ve los informes de todas las células y filtra por semana, mes o año.'],
        'offerings.weekly' => ['group' => 'Células', 'title' => 'Ofrendas por semana', 'text' => 'Ve la ofrenda y los diezmos de cada célula semana por semana, sin el tablero de ingresos.'],
        'cells.own' => ['group' => 'Células', 'title' => 'Abrir su propia célula', 'text' => 'El Servidor de Red que también lidera una célula la abre él mismo y sube su informe. Si no lidera una, no la abre.'],
        'servers.network' => ['group' => 'Células', 'title' => 'Servidores de Red', 'text' => 'Asigna y edita a los Servidores de Red de cada red: nombre, usuario, clave y si su cuenta está activa. Cada red tiene uno, o dos como máximo. Apagado por defecto: solo el superadministrador lo activa.'],
        'servers.create' => ['group' => 'Células', 'title' => 'Crear servidores', 'text' => 'Abre servidores en su red (células como 01A) y les crea su cuenta.'],
        'servers.children' => ['group' => 'Células', 'title' => 'Crear servidores hijo', 'text' => 'Añade células hija debajo de un servidor (como 0101A) y les crea su cuenta. El servidor lo usa para sus propios servidores hijo.'],
        'cells.manage' => ['group' => 'Células', 'title' => 'Células e integrantes', 'text' => 'Edita datos de cada célula y su lista de integrantes.'],
        'themes.manage' => ['group' => 'Células', 'title' => 'Temas de célula', 'text' => 'Publica el tema semanal (PDF, Word, PowerPoint o imagen), le pone fecha y público, y lo oculta cuando ya no se usa.'],
        'design.manage' => ['group' => 'Página web', 'title' => 'Diseño de la página', 'text' => 'Paleta de colores, tipografías, fondos de pantalla y de franja (color, degradado, foto, GIF o video), tamaños, grosor y espaciado del texto, y formas, página por página y sección por sección.'],
        'media.manage' => ['group' => 'Página web', 'title' => 'Imágenes y videos', 'text' => 'Cambia fotos y videos de la web y la cantidad de imágenes de la galería.'],
        'content.manage' => ['group' => 'Página web', 'title' => 'Textos y secciones', 'text' => 'Edita textos, ministerios, prédicas, fechas de bautismo y temas.'],
        'generosity.manage' => ['group' => 'Página web', 'title' => 'Datos de generosidad', 'text' => 'Edita cuentas y medios de pago visibles en la web.'],
        'notices.manage' => ['group' => 'Página web', 'title' => 'Indicaciones de la semana', 'text' => 'Publica el aviso emergente que ven los servidores al entrar a /acceso: título, vigencia y todos los puntos de la semana.'],
        'events.manage' => ['group' => 'Página web', 'title' => 'Eventos', 'text' => 'Publica, edita y oculta los eventos de la iglesia con fecha, hora, lugar e imagen.'],
        'devotionals.manage' => ['group' => 'Página web', 'title' => 'Devocionales', 'text' => 'Escribe y programa los devocionales que la iglesia lee en /devocionales.'],
        'radio.console' => ['group' => 'Radio', 'title' => 'Consola en vivo', 'text' => 'Sale al aire con el micrófono, maneja el mezclador y la música de fondo, arma y usa la botonera de efectos y los reproductores simultáneos.'],
        'radio.schedule' => ['group' => 'Radio', 'title' => 'Programación', 'text' => 'Arma la línea de tiempo de cada día con la pista principal y las capas encima, elige la música continua y copia la parrilla a otros días.'],
        'radio.library' => ['group' => 'Radio', 'title' => 'Biblioteca de audio', 'text' => 'Sube, edita y elimina canciones, anuncios, efectos y programas grabados. Subir un audio no lo pone al aire.'],
        'radio.episodes' => ['group' => 'Radio', 'title' => 'Episodios', 'text' => 'Publica programas grabados como episodios en la página de la radio, con carátula, título y una descripción corta, para que la gente los escuche cuando quiera.'],
        'radio.settings' => ['group' => 'Radio', 'title' => 'Ajustes de la radio', 'text' => 'Nombre y lema de la emisora, radio al aire o fuera del aire, niveles de la mezcla, empalme entre canciones y transmisión externa.'],
        'studies.students' => ['group' => 'Estudios · Ruta del Servidor', 'title' => 'Estudiantes y niveles', 'text' => 'Crea, edita y desactiva las cuentas de los estudiantes, cambia sus claves, los ubica en su nivel y define fechas y horario de cada nivel.'],
        'studies.grades' => ['group' => 'Estudios · Ruta del Servidor', 'title' => 'Notas', 'text' => 'Crea las evaluaciones de cada nivel y registra las notas de los estudiantes.'],
        'studies.board' => ['group' => 'Estudios · Ruta del Servidor', 'title' => 'Avisos, versículos y lecturas', 'text' => 'Publica los avisos que aparecen en el aula, los versículos y textos de ánimo y las lecturas en PDF.'],
        'expenses.manage' => ['group' => 'Atmósfera', 'title' => 'Gastos y compras', 'text' => 'Registra compras con foto de la boleta o factura, detalle y monto.'],
        'inbox.visits' => ['group' => 'Formularios de la web', 'title' => 'Visitas planificadas', 'text' => 'Ve a cada persona que planifica su visita, con la red que le corresponde, y recibe una notificación al instante.'],
        'inbox.baptisms' => ['group' => 'Formularios de la web', 'title' => 'Inscripciones de bautismo', 'text' => 'Ve a cada persona que se inscribe para bautizarse, con la red que le corresponde, y recibe una notificación al instante.'],
        'inbox.prayers' => ['group' => 'Formularios de la web', 'title' => 'Peticiones de oración', 'text' => 'Ve cada petición de oración, con la red que le corresponde, y recibe una notificación al instante.'],
        'inbox.serve' => ['group' => 'Formularios de la web', 'title' => 'Quiero servir', 'text' => 'Ve a cada persona que se inscribe para servir en un área (todas o solo las que elijas), le da seguimiento y recibe una notificación al instante.'],
    ];

    public const INBOX = ['inbox.visits', 'inbox.baptisms', 'inbox.prayers', 'inbox.serve'];

    public const STUDIES = ['studies.students', 'studies.grades', 'studies.board'];

    public const RADIO = ['radio.console', 'radio.schedule', 'radio.library', 'radio.episodes', 'radio.settings'];

    public const TYPES = [
        'red' => [
            'label' => 'Servidor de Red',
            'text' => 'Abre su propia célula si lidera una y sube su informe, ve reportes de todos los servidores, ve ofrendas y diezmos por semana, crea servidores y servidores hijo y recibe los formularios de la web.',
            'permissions' => ['reports.submit', 'reports.weekly', 'reports.all', 'offerings.weekly', 'cells.own', 'servers.create', 'servers.children', 'cells.manage', ...self::INBOX],
        ],
        'visuales' => [
            'label' => 'Visuales · Multimedia',
            'text' => 'Todo lo de la página web: imágenes, videos, textos, formas, colores, tipografías, eventos, devocionales, la radio en vivo, datos de generosidad, las indicaciones de la semana, los formularios de la web y el aula de la Ruta del Servidor.',
            'permissions' => ['design.manage', 'media.manage', 'content.manage', 'generosity.manage', 'notices.manage', 'events.manage', 'devotionals.manage', ...self::RADIO, ...self::STUDIES, ...self::INBOX],
        ],
        'celula' => [
            'label' => 'Servidor de Célula',
            'text' => 'Sube sus informes y ve el reporte de la semana.',
            'permissions' => ['reports.submit', 'reports.weekly'],
        ],
        'atmosfera' => [
            'label' => 'Servidor Atmósfera',
            'text' => 'Registra los gastos y compras de la iglesia, publica los eventos, lleva las notas y el aula de la Ruta del Servidor y recibe los formularios de la web.',
            'permissions' => ['expenses.manage', 'events.manage', ...self::STUDIES, ...self::INBOX],
        ],
        'estudios' => [
            'label' => 'Maestro · Ruta del Servidor',
            'text' => 'Solo el aula de la Ruta del Servidor: estudiantes, niveles, notas, avisos, versículos y lecturas en PDF.',
            'permissions' => self::STUDIES,
            'exclusive' => true,
        ],
        'voluntarios' => [
            'label' => 'Coordinador de servidores',
            'text' => 'Solo la pestaña «Quiero servir»: recibe a quienes se inscriben para servir, de todas las áreas o solo de las que elijas, y les da seguimiento.',
            'permissions' => ['inbox.serve'],
            'exclusive' => true,
        ],
        'temas' => [
            'label' => 'Temas de célula',
            'text' => 'Solo publica los temas de célula. No ve informes, finanzas ni la página web.',
            'permissions' => ['themes.manage'],
            'exclusive' => true,
        ],
    ];

    public const DEFAULTS = ['servers.create', 'servers.children'];

    /** Any of these opens the Servidores page. */
    public const SERVER_TREE = ['servers.network', 'servers.create', 'servers.children', 'cells.own'];

    /** Account of a servidor: files its reports and adds its own servidores hijo. */
    public const SERVER_ACCOUNT = ['reports.submit', 'reports.weekly', 'servers.children'];

    /** Account of a servidor hijo: files its reports only. */
    public const CHILD_SERVER_ACCOUNT = ['reports.submit', 'reports.weekly'];

    /** Account types that sign in from the church site; every other type uses the admin site. */
    public const SERVER_TYPES = ['red', 'celula'];

    private const SERVER_PERMISSIONS = ['reports.submit', 'reports.delegate', 'reports.weekly', 'reports.all', 'offerings.weekly', 'cells.own', 'servers.create', 'servers.children', 'cells.manage'];

    public static function keys(): array
    {
        return array_keys(self::CATALOG);
    }

    public static function forTypes(array $types, bool $withDefaults = true): array
    {
        $types = self::cleanTypes($types);
        if (count($types) === 1 && (self::TYPES[$types[0]]['exclusive'] ?? false)) {
            return self::clean(self::TYPES[$types[0]]['permissions']);
        }
        $permissions = $withDefaults ? self::DEFAULTS : [];
        foreach ($types as $type) {
            $permissions = [...$permissions, ...(self::TYPES[$type]['permissions'] ?? [])];
        }

        return self::clean($permissions);
    }

    /** Permissions to store for an account; an exclusive type always keeps only its own. */
    public static function resolve(array $types, ?array $permissions): array
    {
        $types = self::cleanTypes($types);
        if ($permissions === null || (count($types) === 1 && (self::TYPES[$types[0]]['exclusive'] ?? false))) {
            return self::forTypes($types);
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

    /** Account types stored on a user, keeping only the ones that still exist. */
    public static function typesOf(?User $user): array
    {
        return self::cleanTypes(is_array($user?->admin_types) ? $user->admin_types : []);
    }

    public static function of(?User $user): array
    {
        if (! $user) {
            return [];
        }
        if (self::isSuperadmin($user)) {
            return self::keys();
        }
        if (self::isStudent($user)) {
            return [];
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

        return self::roleOf($user) === Role::Superadmin;
    }

    /** Students of La Ruta del Servidor sign in from the church site and only see their classroom. */
    public static function isStudent(?User $user): bool
    {
        return $user !== null && self::roleOf($user) === Role::Student;
    }

    /** Servers (célula, hijo, red) sign in from the church site. */
    public static function isServer(?User $user): bool
    {
        if (! $user || self::isSuperadmin($user) || self::isStudent($user)) {
            return false;
        }
        if (in_array(self::roleOf($user), [Role::RedLeader, Role::CellLeader], true)) {
            return true;
        }
        $types = self::typesOf($user);

        return $types
            ? (bool) array_intersect($types, self::SERVER_TYPES)
            : (bool) array_intersect(self::of($user), self::SERVER_PERMISSIONS);
    }

    /** Administrators and the superadmin sign in from the admin site. */
    public static function isAdministrator(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if (self::isSuperadmin($user)) {
            return true;
        }
        if (in_array(self::roleOf($user), [Role::RedLeader, Role::CellLeader, Role::Student], true)) {
            return false;
        }
        $types = self::typesOf($user);

        return $types
            ? (bool) array_diff($types, self::SERVER_TYPES)
            : (bool) array_diff(self::of($user), self::SERVER_PERMISSIONS);
    }

    private static function roleOf(User $user): ?Role
    {
        return $user->role instanceof Role ? $user->role : Role::tryFrom((string) $user->role);
    }

    public static function label(?User $user): string
    {
        if (self::isSuperadmin($user)) {
            return 'SUPERADMI';
        }
        if (self::isStudent($user)) {
            return 'ESTUDIANTE';
        }
        $types = self::typesOf($user);
        if (! $types) {
            return 'ADMINISTRADOR';
        }

        return implode(' · ', array_map(fn ($type) => mb_strtoupper(self::TYPES[$type]['label']), $types));
    }

    public static function catalogPayload(): array
    {
        return [
            'permissions' => collect(self::CATALOG)->map(fn ($item, $key) => ['key' => $key, ...$item])->values()->all(),
            'types' => collect(self::TYPES)->map(fn ($item, $key) => ['key' => $key, ...$item, 'server' => in_array($key, self::SERVER_TYPES, true)])->values()->all(),
            'defaults' => self::DEFAULTS,
        ];
    }
}
