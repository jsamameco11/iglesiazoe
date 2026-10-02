<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Every link of the panel menu (resources/js/Components/admin/admin-nav.tsx) opens for the accounts that see it and stays closed for the rest. */
class AccessMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    private const MENU = [
        '/admin' => null,
        '/admin/formularios/visitas' => ['inbox.visits'],
        '/admin/formularios/bautismos' => ['inbox.baptisms'],
        '/admin/formularios/oraciones' => ['inbox.prayers'],
        '/admin/formularios/servidores' => ['inbox.serve'],
        '/portal/informe' => ['reports.submit'],
        '/portal/seguimiento' => ['reports.weekly', 'reports.all'],
        '/admin/informes' => ['reports.all'],
        '/admin/ofrendas' => ['offerings.weekly'],
        '/portal/historial' => ['reports.submit', 'reports.all'],
        '/admin/servidores' => ['servers.create'],
        '/admin/celulas' => ['cells.manage'],
        '/portal/temas' => ['reports.submit', 'themes.manage'],
        '/admin/temas' => ['themes.manage', 'content.manage'],
        '/admin/indicaciones' => ['notices.manage'],
        '/admin/diseno' => ['design.manage'],
        '/admin/medios' => ['media.manage'],
        '/admin/contenido' => ['content.manage'],
        '/admin/textos' => ['content.manage'],
        '/admin/ministerios' => ['content.manage'],
        '/admin/predicas' => ['content.manage'],
        '/admin/involucrate' => ['content.manage'],
        '/admin/eventos' => ['events.manage', 'content.manage'],
        '/admin/galeria' => ['content.manage'],
        '/admin/devocionales' => ['devotionals.manage', 'content.manage'],
        '/admin/recursos' => ['content.manage'],
        '/admin/secciones' => ['content.manage'],
        '/admin/bautismos' => ['content.manage'],
        '/admin/generosidad' => ['generosity.manage'],
        '/admin/estudios' => ['studies.grades'],
        '/admin/estudios/estudiantes' => ['studies.grades'],
        '/admin/estudios/notas' => ['studies.grades'],
        '/admin/estudios/avisos' => ['studies.board'],
        '/admin/estudios/animo' => ['studies.board'],
        '/admin/estudios/lecturas' => ['studies.board'],
        '/admin/gastos' => ['expenses.manage'],
        '/admin/finanzas' => 'superadmin',
        '/admin/equipo' => 'superadmin',
    ];

    public static function accounts(): array
    {
        return [
            'Servidor de Red' => ['red', self::SITE],
            'Servidor de Célula' => ['celula', self::SITE],
            'Servidor Atmósfera' => ['atmosfera', self::ADMIN],
            'Visuales' => ['visuales', self::ADMIN],
            'Maestro de la Ruta' => ['estudios', self::ADMIN],
            'Coordinador de servidores' => ['voluntarios', self::ADMIN],
            'Temas de célula' => ['temas', self::ADMIN],
            'SUPERADMI' => ['superadmin', self::ADMIN],
        ];
    }

    #[DataProvider('accounts')]
    public function test_each_account_opens_exactly_the_menu_links_it_sees(string $type, string $host): void
    {
        $user = $type === 'superadmin'
            ? $this->user('super', Role::Superadmin, [], [])
            : $this->user($type.'.cuenta', $type === 'celula' ? Role::CellLeader : Role::Admin, [$type], Permissions::forTypes([$type]));

        $opened = [];
        foreach (self::MENU as $href => $needs) {
            $sees = match (true) {
                $needs === null => true,
                $needs === 'superadmin' => $type === 'superadmin',
                default => Permissions::any($user, $needs),
            };
            $status = $this->actingAs($user)->get($host.$href)->status();

            $this->assertSame($sees ? 200 : 302, $status, "{$type} → {$href}");
            if ($sees) {
                $opened[] = $href;
            }
        }

        $this->assertContains('/admin', $opened);
    }

    public function test_the_admin_host_sends_every_public_page_to_the_church_site(): void
    {
        foreach (['/recursos', '/galeria', '/devocionales', '/eventos', '/involucrate', '/visita', '/contacto'] as $page) {
            $this->get(self::ADMIN.$page)->assertRedirect();
        }
    }

    private function user(string $username, Role $role, array $types, array $permissions): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => $role,
            'admin_types' => $types,
            'permissions' => $permissions,
            'active' => true,
        ]);
    }
}
