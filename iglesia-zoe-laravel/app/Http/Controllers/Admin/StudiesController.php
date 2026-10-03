<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Support\Credentials;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Enums\Role;
use App\Domain\Shared\Support\Slug;
use App\Domain\Studies\Classroom;
use App\Http\Controllers\Controller;
use App\Models\StudyAssessment;
use App\Models\StudyGrade;
use App\Models\StudyLevel;
use App\Models\StudyNotice;
use App\Models\StudyReading;
use App\Models\StudyStudent;
use App\Models\StudyVerse;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StudiesController extends Controller
{
    private const MESSAGES = [
        'required' => 'Completa el campo :attribute.',
        'date' => 'Elige una fecha válida en :attribute.',
        'after_or_equal' => 'La fecha de :attribute no puede ser anterior a la de inicio.',
        'integer' => 'Escribe un número en :attribute.',
        'numeric' => 'Escribe un número en :attribute.',
        'in' => 'Elige una opción válida en :attribute.',
        'regex' => 'Revisa el formato de :attribute.',
        'min' => 'Revisa el campo :attribute.',
        'max' => 'El campo :attribute es demasiado largo o grande.',
    ];

    public function levels(): Response
    {
        $counts = StudyStudent::query()->where('status', 'cursando')->selectRaw('study_level_id, count(*) as total')->groupBy('study_level_id')->pluck('total', 'study_level_id');

        return Inertia::render('Admin/Estudios/Niveles', [
            'levels' => StudyLevel::ordered()->get()->map(fn (StudyLevel $level) => [
                ...$level->card(),
                'weeks' => $level->weeks,
                'starts_on' => $level->starts_on?->toDateString(),
                'ends_on' => $level->ends_on?->toDateString(),
                'class_time' => $level->class_time,
                'students' => (int) ($counts[$level->id] ?? 0),
            ]),
        ]);
    }

    public function saveLevel(Request $request): JsonResponse
    {
        $level = $this->find(StudyLevel::class, $request->input('id'));
        if ($request->filled('id') && ! $level) {
            return $this->fail('Ese nivel ya no existe. Recarga la página.', 404);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3|max:80',
            'summary' => 'nullable|string|max:400',
            'weeks' => 'required|integer|min:1|max:52',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
            'class_time' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'place' => 'nullable|string|max:120',
            'teacher' => 'nullable|string|max:120',
            'pass_score' => 'required|numeric|min:0|max:'.Classroom::MAX_SCORE,
            'sort_order' => 'nullable|integer|min:0|max:999',
        ], self::MESSAGES, [
            'name' => 'nombre', 'summary' => 'descripción', 'weeks' => 'semanas', 'starts_on' => 'inicio', 'ends_on' => 'clausura',
            'class_time' => 'hora', 'place' => 'lugar', 'teacher' => 'maestro', 'pass_score' => 'nota aprobatoria', 'sort_order' => 'orden',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $this->clean($validator->validated());
        $data['active'] = $request->boolean('active');
        $data['sort_order'] = (int) ($data['sort_order'] ?? ($level?->sort_order ?? (StudyLevel::query()->max('sort_order') + 1)));
        if (! $level) {
            $data['slug'] = Slug::unique(StudyLevel::class, $data['name'], 'nivel', 70);
        }
        $level ? $level->update($data) : StudyLevel::query()->create($data);

        return $this->saved($level ? 'Nivel actualizado.' : 'Nivel creado.');
    }

    public function students(): Response
    {
        $students = StudyStudent::query()->with(['user', 'level'])->get()->filter(fn (StudyStudent $student) => $student->user);

        return Inertia::render('Admin/Estudios/Estudiantes', [
            'levels' => StudyLevel::ordered()->get(['id', 'name', 'active']),
            'statuses' => StudyStudent::STATUSES,
            'students' => $students->sortBy(fn (StudyStudent $student) => mb_strtolower($student->user->name))->values()->map(fn (StudyStudent $student) => [
                'id' => $student->id,
                'name' => $student->user->name,
                'username' => $student->user->username,
                'phone' => $student->phone,
                'network' => $student->network,
                'level_id' => $student->study_level_id,
                'level' => $student->level?->name,
                'status' => $student->status,
                'active' => $student->user->active !== false,
                'average' => Classroom::levelAverages($student)[$student->study_level_id] ?? null,
            ]),
        ]);
    }

    public function saveStudent(Request $request): JsonResponse
    {
        $student = $this->find(StudyStudent::class, $request->input('id'));
        if ($request->filled('id') && ! $student) {
            return $this->fail('Ese estudiante ya no existe. Recarga la página.', 404);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:3|max:120',
            'username' => ['required', 'regex:'.Credentials::USERNAME],
            'password' => 'nullable|string|min:'.Credentials::MIN_PASSWORD.'|max:120',
            'phone' => 'nullable|string|max:30',
            'network' => 'nullable|string|max:60',
            'study_level_id' => 'nullable|uuid|exists:study_levels,id',
            'status' => ['required', Rule::in(array_keys(StudyStudent::STATUSES))],
        ], [
            ...self::MESSAGES,
            'username.regex' => 'El DNI o usuario debe tener de 3 a 40 letras o números, sin espacios.',
            'password.min' => 'La clave debe tener al menos 6 caracteres.',
        ], ['name' => 'nombre', 'username' => 'DNI o usuario', 'phone' => 'celular', 'network' => 'red', 'study_level_id' => 'nivel', 'status' => 'estado']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $this->clean($validator->validated());
        $username = $data['username'];
        $email = Credentials::studentEmail($username);
        if (Credentials::taken($username, $email, $student?->user_id)) {
            return $this->fail('Ese DNI o usuario ya tiene una cuenta. Usa otro, por ejemplo agregando una letra al final.');
        }

        $password = $data['password'] ?? null;
        if (! $student && ! $password && ! Credentials::validPassword($username)) {
            return $this->fail('El usuario «'.$username.'» es muy corto para usarlo como clave. Escribe una clave de al menos 6 caracteres.');
        }
        DB::transaction(function () use ($request, $student, $data, $username, $email, $password) {
            $account = [
                'name' => $data['name'],
                'username' => $username,
                'dni' => ctype_digit($username) ? $username : null,
                'email' => $email,
                'active' => $student ? $request->boolean('active') : true,
            ];
            if ($student) {
                $student->user->fill($account);
                if ($password) {
                    $student->user->password = $password;
                }
                $student->user->save();
            } else {
                $user = User::query()->create([
                    ...$account,
                    'password' => $password ?: $username,
                    'role' => Role::Student,
                    'admin_types' => [],
                    'permissions' => [],
                    'created_by' => $request->user()->id,
                ]);
                $student = new StudyStudent(['user_id' => $user->id]);
            }
            $student->fill([
                'study_level_id' => $data['study_level_id'] ?? null,
                'status' => $data['status'],
                'phone' => $data['phone'] ?? null,
                'network' => $data['network'] ?? null,
            ])->save();
        });

        $message = $request->filled('id')
            ? 'Datos del estudiante guardados.'
            : 'Estudiante creado. Ingresa en /estudios/acceso con «'.$username.'» y la clave '.($password ? 'que escribiste.' : 'igual a su DNI o usuario.');

        return $this->saved($message);
    }

    public function deleteStudent(Request $request): JsonResponse
    {
        $student = $this->find(StudyStudent::class, $request->input('id'));
        if ($student) {
            $user = $student->user;
            $student->delete();
            if ($user && $user->role === Role::Student) {
                $user->delete();
            }
        }

        return $this->saved('Estudiante eliminado con sus notas.');
    }

    public function grades(Request $request): Response
    {
        $levels = StudyLevel::ordered()->get();
        $level = $levels->firstWhere('id', $request->query('nivel')) ?? $levels->firstWhere('active', true) ?? $levels->first();
        $assessments = $level ? $level->assessments()->get() : collect();
        $students = $level
            ? StudyStudent::query()->with('user')->where('study_level_id', $level->id)->get()->filter(fn (StudyStudent $student) => $student->user)->sortBy(fn (StudyStudent $student) => mb_strtolower($student->user->name))->values()
            : collect();
        $scores = StudyGrade::query()->whereIn('study_assessment_id', $assessments->pluck('id'))->whereIn('study_student_id', $students->pluck('id'))->get();

        return Inertia::render('Admin/Estudios/Notas', [
            'levels' => $levels->map(fn (StudyLevel $item) => ['id' => $item->id, 'name' => $item->name, 'active' => $item->active]),
            'level' => $level ? [...$level->card(), 'weeks' => $level->weeks] : null,
            'assessments' => $assessments->map(fn (StudyAssessment $assessment) => ['id' => $assessment->id, 'title' => $assessment->title, 'week' => $assessment->week]),
            'students' => $students->map(fn (StudyStudent $student) => [
                'id' => $student->id,
                'name' => $student->user->name,
                'username' => $student->user->username,
                'status' => $student->status,
                'scores' => $scores->where('study_student_id', $student->id)->mapWithKeys(fn (StudyGrade $grade) => [$grade->study_assessment_id => $grade->score])->all(),
            ]),
            'maxScore' => Classroom::MAX_SCORE,
        ]);
    }

    public function saveGrades(Request $request): JsonResponse
    {
        $level = $this->find(StudyLevel::class, $request->input('level_id'));
        if (! $level) {
            return $this->fail('Elige un nivel.');
        }
        $assessmentIds = $level->assessments()->pluck('id')->all();
        $studentIds = StudyStudent::query()->where('study_level_id', $level->id)->pluck('id')->all();
        $rows = (array) $request->input('scores', []);
        $writes = [];
        foreach ($rows as $studentId => $cells) {
            if (! in_array($studentId, $studentIds, true) || ! is_array($cells)) {
                continue;
            }
            foreach ($cells as $assessmentId => $value) {
                if (! in_array($assessmentId, $assessmentIds, true)) {
                    continue;
                }
                $value = str_replace(',', '.', trim((string) $value));
                if ($value !== '' && (! is_numeric($value) || (float) $value < 0 || (float) $value > Classroom::MAX_SCORE)) {
                    return $this->fail('Las notas van de 0 a '.Classroom::MAX_SCORE.'. Revisa el valor «'.$value.'».');
                }
                $writes[] = [$studentId, $assessmentId, $value === '' ? null : round((float) $value, 1)];
            }
        }

        DB::transaction(function () use ($writes) {
            foreach ($writes as [$studentId, $assessmentId, $score]) {
                $match = ['study_student_id' => $studentId, 'study_assessment_id' => $assessmentId];
                $score === null
                    ? StudyGrade::query()->where($match)->delete()
                    : StudyGrade::query()->updateOrCreate($match, ['score' => $score]);
            }
        });

        return $this->saved('Notas guardadas. Los estudiantes ya las ven en su aula.');
    }

    public function saveAssessment(Request $request): JsonResponse
    {
        $assessment = $this->find(StudyAssessment::class, $request->input('id'));
        $level = $assessment?->level ?? $this->find(StudyLevel::class, $request->input('level_id'));
        if (! $level) {
            return $this->fail('Elige un nivel.');
        }
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:2|max:80',
            'week' => 'nullable|integer|min:1|max:52',
        ], self::MESSAGES, ['title' => 'nombre de la evaluación', 'week' => 'semana']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $this->clean($validator->validated());
        if ($assessment) {
            $assessment->update($data);
        } else {
            StudyAssessment::query()->create([...$data, 'study_level_id' => $level->id, 'sort_order' => (int) $level->assessments()->max('sort_order') + 1]);
        }

        return $this->saved($assessment ? 'Evaluación actualizada.' : 'Evaluación agregada.');
    }

    public function deleteAssessment(Request $request): JsonResponse
    {
        $this->find(StudyAssessment::class, $request->input('id'))?->delete();

        return $this->saved('Evaluación eliminada con sus notas.');
    }

    public function notices(): Response
    {
        return Inertia::render('Admin/Estudios/Avisos', [
            'levels' => $this->levelOptions(),
            'tones' => StudyNotice::TONES,
            'notices' => StudyNotice::query()->orderByDesc('created_at')->get()->map->card(),
            'today' => now(StudyLevel::TIMEZONE)->toDateString(),
        ]);
    }

    public function saveNotice(Request $request): JsonResponse
    {
        $notice = $this->find(StudyNotice::class, $request->input('id'));
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:120',
            'body' => 'required|string|min:3|max:2000',
            'tone' => ['required', Rule::in(array_keys(StudyNotice::TONES))],
            'study_level_id' => 'nullable|uuid|exists:study_levels,id',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
        ], self::MESSAGES, ['title' => 'título', 'body' => 'mensaje', 'tone' => 'tipo', 'study_level_id' => 'nivel', 'starts_on' => 'desde', 'ends_on' => 'hasta']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = [...$this->clean($validator->validated()), 'active' => $request->boolean('active')];
        $data['body'] = str_replace("\r\n", "\n", $data['body']);
        $notice ? $notice->update($data) : StudyNotice::query()->create($data);

        return $this->saved($notice ? 'Aviso actualizado.' : 'Aviso publicado. Aparecerá en el aula de los estudiantes.');
    }

    public function deleteNotice(Request $request): JsonResponse
    {
        $this->find(StudyNotice::class, $request->input('id'))?->delete();

        return $this->saved('Aviso eliminado.');
    }

    public function verses(): Response
    {
        return Inertia::render('Admin/Estudios/Animo', [
            'levels' => $this->levelOptions(),
            'verses' => StudyVerse::query()->orderByDesc('created_at')->get()->map->card(),
        ]);
    }

    public function saveVerse(Request $request): JsonResponse
    {
        $verse = $this->find(StudyVerse::class, $request->input('id'));
        $validator = Validator::make($request->all(), [
            'reference' => 'nullable|string|max:80',
            'text' => 'required|string|min:5|max:600',
            'study_level_id' => 'nullable|uuid|exists:study_levels,id',
        ], self::MESSAGES, ['reference' => 'cita', 'text' => 'texto', 'study_level_id' => 'nivel']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = [...$this->clean($validator->validated()), 'active' => $request->boolean('active')];
        $verse ? $verse->update($data) : StudyVerse::query()->create($data);

        return $this->saved($verse ? 'Guardado.' : 'Agregado. Ya aparece en el aula.');
    }

    public function deleteVerse(Request $request): JsonResponse
    {
        $this->find(StudyVerse::class, $request->input('id'))?->delete();

        return $this->saved('Eliminado.');
    }

    public function readings(): Response
    {
        return Inertia::render('Admin/Estudios/Lecturas', [
            'levels' => $this->levelOptions(),
            'readings' => StudyReading::query()->orderByRaw('week is null')->orderBy('week')->orderByDesc('created_at')->get()->map->card(),
        ]);
    }

    public function saveReading(Request $request): JsonResponse
    {
        $reading = $this->find(StudyReading::class, $request->input('id'));
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:140',
            'summary' => 'nullable|string|max:300',
            'week' => 'nullable|integer|min:1|max:52',
            'study_level_id' => 'nullable|uuid|exists:study_levels,id',
        ], self::MESSAGES, ['title' => 'título', 'summary' => 'descripción', 'week' => 'semana', 'study_level_id' => 'nivel']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = [...$this->clean($validator->validated()), 'active' => $request->boolean('active')];

        $file = $request->file('file');
        if ($file instanceof UploadedFile) {
            if (! MediaLibrary::extension($file, ['pdf']) || $file->getSize() > 25 * 1024 * 1024) {
                return $this->fail('La lectura debe ser un archivo PDF de hasta 25 MB.');
            }
            $data['file_path'] = MediaLibrary::storePublic($file, 'estudios/'.now()->format('Y'), 'pdf');
            MediaLibrary::deletePublic($reading?->file_path);
        } elseif (! $reading) {
            return $this->fail('Adjunta el PDF de la lectura.');
        }
        $reading ? $reading->update($data) : StudyReading::query()->create($data);

        return $this->saved($reading ? 'Lectura actualizada.' : 'Lectura publicada en el aula.');
    }

    public function deleteReading(Request $request): JsonResponse
    {
        $reading = $this->find(StudyReading::class, $request->input('id'));
        if ($reading) {
            MediaLibrary::deletePublic($reading->file_path);
            $reading->delete();
        }

        return $this->saved('Lectura eliminada.');
    }

    private function levelOptions(): array
    {
        return StudyLevel::ordered()->get(['id', 'name'])->map(fn (StudyLevel $level) => ['id' => $level->id, 'name' => $level->name])->all();
    }

    private function clean(array $data): array
    {
        return array_map(fn ($value) => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value, $data);
    }
}
