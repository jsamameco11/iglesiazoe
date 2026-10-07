<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Servers sign in on the church site, administrators and the superadmin on the panel site, each with its own option. */
class SignInDoorsTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    public function test_servers_sign_in_on_the_church_site_and_reach_their_panel(): void
    {
        foreach (['celula' => Role::CellLeader, 'red' => Role::Admin] as $type => $role) {
            $this->account($type, $role, [$type]);

            $this->signIn(self::ADMIN, $type)->assertSessionHasErrors('username');
            $this->assertGuest();

            $this->signIn(self::SITE, $type)->assertRedirect('/admin');
            $this->assertAuthenticated();
            $this->get(self::SITE.'/admin')->assertOk();
            $this->signOut();
        }
    }

    public function test_administrators_sign_in_on_the_panel_with_the_administrator_option(): void
    {
        $this->account('visuales', Role::Admin, ['visuales']);

        $this->signIn(self::SITE, 'visuales')->assertSessionHasErrors('username');
        $this->signIn(self::ADMIN, 'visuales', 'superadmin')->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->signIn(self::ADMIN, 'visuales')->assertRedirect('/admin');
        $this->get(self::ADMIN.'/admin/diseno')->assertOk();
    }

    public function test_the_superadmin_signs_in_only_with_its_own_option(): void
    {
        $this->account('super', Role::Superadmin, []);

        $this->signIn(self::SITE, 'super', 'superadmin')->assertSessionHasErrors('username');
        $this->signIn(self::ADMIN, 'super')->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->signIn(self::ADMIN, 'super', 'superadmin')->assertRedirect('/admin');
        $this->get(self::ADMIN.'/admin/equipo')->assertOk();
    }

    public function test_a_wrong_password_is_rejected_and_only_local_destinations_are_followed(): void
    {
        $this->account('celula', Role::CellLeader, ['celula']);

        $this->post(self::SITE.'/acceso', ['username' => 'celula', 'password' => 'otra'])->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->post(self::SITE.'/acceso', ['username' => 'celula', 'password' => 'secreto1', 'next' => '//malicioso.example'])->assertRedirect('/admin');
        $this->signOut();
        $this->post(self::SITE.'/acceso', ['username' => 'celula', 'password' => 'secreto1', 'next' => '/portal/informe'])->assertRedirect('/portal/informe');
    }

    private function signIn(string $host, string $username, ?string $audience = null)
    {
        return $this->post($host.'/acceso', array_filter(['username' => $username, 'password' => 'secreto1', 'audience' => $audience]));
    }

    private function signOut(): void
    {
        auth()->logout();
        auth()->forgetGuards();
        $this->flushSession();
    }

    private function account(string $username, Role $role, array $types): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => $role,
            'admin_types' => $types,
            'permissions' => Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
