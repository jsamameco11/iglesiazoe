<?php

namespace Tests\Feature;

use App\Domain\Access\Permissions;
use App\Domain\Shared\Enums\Role;
use App\Models\StudyAssessment;
use App\Models\StudyLevel;
use App\Models\StudyNotice;
use App\Models\StudyReading;
use App\Models\StudyStudent;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class StudiesTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.localhost';

    private const SITE = 'http://localhost';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media'));
    }

    public function test_the_route_starts_with_the_five_levels_and_both_ministries_get_studies_by_default(): void
    {
        $this->assertSame(
            ['Nueva Vida', 'Enraizados', 'Grandeza del Servicio', 'Discipulado', 'Visión Celular'],
            StudyLevel::ordered()->pluck('name')->all(),
        );

        $atmosfera = Permissions::forTypes(['atmosfera']);
        $visuales = Permissions::forTypes(['visuales']);
        foreach (['studies.grades', 'studies.board', 'events.manage'] as $permission) {
            $this->assertContains($permission, $atmosfera);
            $this->assertContains($permission, $visuales);
        }
        $this->assertContains('devotionals.manage', $visuales);
        $this->assertSame(['studies.grades', 'studies.board'], Permissions::forTypes(['estudios']));
    }

    public function test_an_atmosfera_admin_creates_a_student_who_signs_in_to_the_classroom(): void
    {
        $admin = $this->admin('atmosfera', ['atmosfera']);
        $level = $this->level('nueva-vida');

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/estudios/estudiantes', [
            'name' => 'María Quispe',
            'username' => '74581236',
            'study_level_id' => $level->id,
            'status' => 'cursando',
        ])->assertOk()->assertJsonPath('ok', true);

        $student = User::query()->where('username', '74581236')->sole();
        $this->assertSame(Role::Student, $student->role);
        $this->assertSame('74581236', $student->dni);
        $this->assertSame($level->id, $student->studyStudent->study_level_id);

        $this->actingAs($admin)->postJson(self::ADMIN.'/admin/estudios/estudiantes', ['name' => 'Otra', 'username' => '74581236', 'status' => 'cursando'])
            ->assertUnprocessable();

        auth()->logout();
        $this->post(self::SITE.'/estudios/acceso', ['username' => '74581236', 'password' => 'otra-clave'])->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->post(self::SITE.'/estudios/acceso', ['username' => '74581236', 'password' => '74581236'])->assertRedirect('/estudios/mi-ruta');
        $this->assertAuthenticatedAs($student);

        $this->get(self::SITE.'/estudios/mi-ruta')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Estudios/MiRuta')
                ->where('student.first_name', 'María')
                ->where('level.name', 'Nueva Vida')
                ->has('route', 5)
                ->where('route.0.state', 'current')
                ->where('route.1.state', 'next'));

        $this->get(self::SITE.'/admin')->assertRedirect();
        $this->get(self::SITE.'/estudios/acceso')->assertRedirect('/estudios/mi-ruta');
    }

    public function test_student_accounts_only_open_the_classroom(): void
    {
        $student = $this->student('45678912', $this->level('enraizados'));

        $this->post(self::ADMIN.'/acceso', ['username' => '45678912', 'password' => '45678912'])->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->post(self::SITE.'/acceso', ['username' => '45678912', 'password' => '45678912'])->assertRedirect('/estudios/mi-ruta');
        $this->assertAuthenticatedAs($student->user);
        $this->get(self::SITE.'/portal')->assertRedirect();

        auth()->logout();
        $this->get(self::SITE.'/estudios/mi-ruta')->assertRedirect('/estudios/acceso');

        $server = User::query()->create([
            'name' => 'Servidor', 'username' => 'servidor', 'email' => 'servidor@iglesiacristianazoe.pe', 'password' => 'secreto1',
            'role' => Role::CellLeader, 'admin_types' => [], 'permissions' => [], 'active' => true,
        ]);
        $this->post(self::SITE.'/estudios/acceso', ['username' => 'servidor', 'password' => 'secreto1'])->assertSessionHasErrors('username');
        $this->actingAs($server)->get(self::SITE.'/estudios/mi-ruta')->assertRedirect();
    }

    public function test_grades_notices_verses_and_readings_reach_the_classroom(): void
    {
        $teacher = $this->admin('maestra', ['estudios']);
        $level = $this->level('grandeza-del-servicio');
        $level->update(['starts_on' => now(StudyLevel::TIMEZONE)->subDays(15)->toDateString(), 'weeks' => 8]);
        $student = $this->student('12345678', $level);
        $other = $this->student('87654321', $this->level('discipulado'));

        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/notas/evaluacion', ['level_id' => $level->id, 'title' => 'Examen 1', 'week' => 2])->assertOk();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/notas/evaluacion', ['level_id' => $level->id, 'title' => 'Tarea 1'])->assertOk();
        [$exam, $homework] = StudyAssessment::query()->orderBy('sort_order')->get()->all();

        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/notas', ['level_id' => $level->id, 'scores' => [$student->id => [$exam->id => '21']]])
            ->assertUnprocessable();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/notas', ['level_id' => $level->id, 'scores' => [
            $student->id => [$exam->id => '18', $homework->id => '15,5'],
            $other->id => [$exam->id => '20'],
        ]])->assertOk();

        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/avisos', ['title' => 'Traer Biblia', 'body' => 'Este sábado traemos nuestra Biblia.', 'tone' => 'importante', 'study_level_id' => $level->id, 'active' => '1'])->assertOk();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/avisos', ['title' => 'Aún no', 'body' => 'Se publica mañana.', 'tone' => 'aviso', 'starts_on' => now(StudyLevel::TIMEZONE)->addDay()->toDateString(), 'active' => '1'])->assertOk();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/avisos', ['title' => 'Otro nivel', 'body' => 'Solo para Discipulado.', 'tone' => 'aviso', 'study_level_id' => $other->study_level_id, 'active' => '1'])->assertOk();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/animo', ['reference' => 'Josué 1:9', 'text' => 'Esfuérzate y sé valiente.', 'study_level_id' => $level->id, 'active' => '1'])->assertOk();

        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/lecturas', ['title' => 'Sin archivo', 'active' => '1'])->assertUnprocessable();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/lecturas', [
            'title' => 'El corazón del servidor',
            'week' => 3,
            'study_level_id' => $level->id,
            'active' => '1',
            'file' => UploadedFile::fake()->createWithContent('lectura.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
        ])->assertOk();
        $reading = StudyReading::query()->sole();
        $this->assertStringStartsWith('/media/estudios/', $reading->file_path);

        $verses = count(config('zoe.study_verses')) + 1;
        $this->actingAs($student->user)->get(self::SITE.'/estudios/mi-ruta')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('level.schedule.state', 'running')
                ->where('level.schedule.week', 3)
                ->where('level.schedule.class_time', '09:00')
                ->has('grades', 2)
                ->where('grades.0.title', 'Examen 1')
                ->where('grades.0.score', 18)
                ->where('grades.1.score', 15.5)
                ->where('summary.graded', 2)
                ->where('summary.average', 16.8)
                ->has('notices', 1)
                ->where('notices.0.title', 'Traer Biblia')
                ->has('verses', $verses)
                ->has('readings', 1)
                ->where('readings.0.title', 'El corazón del servidor'));

        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/lecturas/eliminar', ['id' => $reading->id])->assertOk();
        $this->assertSame(0, StudyReading::query()->count());
        $notice = StudyNotice::query()->where('title', 'Traer Biblia')->sole();
        $this->actingAs($teacher)->postJson(self::ADMIN.'/admin/estudios/avisos/eliminar', ['id' => $notice->id])->assertOk();
        $this->assertNull($notice->fresh());
    }

    public function test_each_studies_permission_opens_only_its_own_pages(): void
    {
        $board = $this->admin('avisos', [], ['studies.board']);
        $this->actingAs($board)->get(self::ADMIN.'/admin/estudios/avisos')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Estudios/Avisos'));
        $this->actingAs($board)->get(self::ADMIN.'/admin/estudios/notas')->assertRedirect('/admin');

        $grades = $this->admin('notas', [], ['studies.grades']);
        $this->actingAs($grades)->get(self::ADMIN.'/admin/estudios/notas')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('Admin/Estudios/Notas')->has('levels', 5));
        $this->actingAs($grades)->get(self::ADMIN.'/admin/estudios/lecturas')->assertRedirect('/admin');
        $this->actingAs($grades)->postJson(self::ADMIN.'/admin/estudios/animo', ['text' => 'Sin permiso para esto.'])->assertForbidden();

        $nobody = $this->admin('indicaciones', [], ['notices.manage']);
        $this->actingAs($nobody)->get(self::ADMIN.'/admin/estudios')->assertRedirect('/admin');
        $this->actingAs($nobody)->get(self::ADMIN.'/admin/eventos')->assertRedirect('/admin');
        $this->actingAs($nobody)->get(self::ADMIN.'/admin/devocionales')->assertRedirect('/admin');

        $events = $this->admin('eventos', [], ['events.manage']);
        $this->actingAs($events)->get(self::ADMIN.'/admin/eventos')->assertOk();
        $this->actingAs($events)->get(self::ADMIN.'/admin/devocionales')->assertRedirect('/admin');

        $devotionals = $this->admin('devocional', [], ['devotionals.manage']);
        $this->actingAs($devotionals)->get(self::ADMIN.'/admin/devocionales')->assertOk();
        $this->actingAs($devotionals)->get(self::ADMIN.'/admin/eventos')->assertRedirect('/admin');
    }

    public function test_the_superadmin_assigns_studies_when_creating_an_access_and_students_stay_out_of_the_team(): void
    {
        $super = User::query()->create([
            'name' => 'Super', 'username' => 'super', 'email' => 'super@iglesiacristianazoe.pe', 'password' => 'secreto1',
            'role' => Role::Superadmin, 'admin_types' => [], 'permissions' => [], 'active' => true,
        ]);
        $this->student('11223344', $this->level('vision-celular'));

        $this->actingAs($super)->postJson(self::ADMIN.'/admin/equipo', [
            'name' => 'Pastora Ana',
            'username' => 'ana',
            'password' => 'secreto123',
            'types' => ['estudios'],
        ])->assertOk();
        $this->assertSame(['studies.grades', 'studies.board'], Permissions::of(User::query()->where('username', 'ana')->sole()));

        $this->actingAs($super)->get(self::ADMIN.'/admin/equipo')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('accounts', 2)
                ->where('catalog.types', fn ($types) => collect($types)->firstWhere('key', 'estudios')['label'] === 'Maestro · Ruta del Servidor'));
    }

    public function test_the_schedule_follows_the_level_dates(): void
    {
        $level = new StudyLevel(['starts_on' => '2026-10-03', 'weeks' => 8, 'class_time' => '09:00']);
        $at = fn (string $moment) => $level->schedule(CarbonImmutable::parse($moment, StudyLevel::TIMEZONE));

        $before = $at('2026-09-30 10:00');
        $this->assertSame('upcoming', $before['state']);
        $this->assertSame('sábado', $before['day']);
        $this->assertSame('2026-11-21', $before['ends_on']);
        $this->assertStringStartsWith('2026-10-03T09:00:00', $before['next_class']);

        $third = $at('2026-10-17 10:00');
        $this->assertSame('running', $third['state']);
        $this->assertSame(3, $third['week']);
        $this->assertStringStartsWith('2026-10-24T09:00:00', $third['next_class']);

        $this->assertStringStartsWith('2026-10-17T09:00:00', $at('2026-10-17 08:00')['next_class']);
        $this->assertSame('finished', $at('2026-11-22 10:00')['state']);
        $this->assertSame('pending', (new StudyLevel(['weeks' => 8]))->schedule()['state']);
    }

    private function level(string $slug): StudyLevel
    {
        return StudyLevel::query()->where('slug', $slug)->sole();
    }

    private function student(string $dni, StudyLevel $level): StudyStudent
    {
        $user = User::query()->create([
            'name' => 'Estudiante '.$dni, 'username' => $dni, 'dni' => $dni, 'email' => $dni.'@estudiantes.iglesiacristianazoe.pe',
            'password' => $dni, 'role' => Role::Student, 'admin_types' => [], 'permissions' => [], 'active' => true,
        ]);

        return StudyStudent::query()->create(['user_id' => $user->id, 'study_level_id' => $level->id, 'status' => 'cursando']);
    }

    private function admin(string $username, array $types, ?array $permissions = null): User
    {
        return User::query()->create([
            'name' => ucfirst($username),
            'username' => $username,
            'email' => $username.'@iglesiacristianazoe.pe',
            'password' => 'secreto1',
            'role' => Role::Admin,
            'admin_types' => $types,
            'permissions' => $permissions ?? Permissions::forTypes($types),
            'active' => true,
        ]);
    }
}
