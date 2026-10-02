<?php

namespace App\Domain\Studies;

use App\Models\StudyAssessment;
use App\Models\StudyGrade;
use App\Models\StudyLevel;
use App\Models\StudyNotice;
use App\Models\StudyReading;
use App\Models\StudyStudent;
use App\Models\StudyVerse;
use App\Models\User;
use Illuminate\Support\Collection;

/** Everything a student of La Ruta del Servidor sees in their classroom. */
final class Classroom
{
    public const MAX_SCORE = 20;

    public static function average(iterable $scores): ?float
    {
        $list = collect($scores)->filter(fn ($score) => $score !== null)->map(fn ($score) => (float) $score);

        return $list->isEmpty() ? null : round($list->avg(), 1);
    }

    /** Average of every level a student has grades in, keyed by level id. */
    public static function levelAverages(StudyStudent $student): Collection
    {
        return StudyGrade::query()
            ->where('study_student_id', $student->id)
            ->join('study_assessments', 'study_assessments.id', '=', 'study_grades.study_assessment_id')
            ->get(['study_grades.score', 'study_assessments.study_level_id'])
            ->groupBy('study_level_id')
            ->map(fn (Collection $rows) => self::average($rows->pluck('score')));
    }

    public static function for(User $user): array
    {
        $student = $user->studyStudent()->with('level')->first();
        $level = $student?->level;
        $levels = StudyLevel::ordered()->where('active', true)->get();
        $averages = $student ? self::levelAverages($student) : collect();
        $graduated = $student?->status === 'egresado';

        $grades = [];
        if ($student && $level) {
            $scores = StudyGrade::query()->where('study_student_id', $student->id)->pluck('score', 'study_assessment_id');
            $grades = StudyAssessment::query()->where('study_level_id', $level->id)->orderBy('sort_order')->orderBy('created_at')->get()
                ->map(fn (StudyAssessment $assessment) => [
                    'id' => $assessment->id,
                    'title' => $assessment->title,
                    'week' => $assessment->week,
                    'score' => isset($scores[$assessment->id]) ? (float) $scores[$assessment->id] : null,
                ])->all();
        }
        $average = self::average(array_column($grades, 'score'));
        $graded = count(array_filter($grades, fn ($grade) => $grade['score'] !== null));
        $levelFilter = fn ($query) => $query->whereNull('study_level_id')->when($level, fn ($inner) => $inner->orWhere('study_level_id', $level->id));

        return [
            'student' => [
                'name' => $user->name,
                'first_name' => strtok((string) $user->name, ' ') ?: $user->name,
                'username' => $user->username,
                'status' => $student?->status ?? 'cursando',
                'status_label' => StudyStudent::STATUSES[$student?->status ?? 'cursando'] ?? 'Cursando',
            ],
            'level' => $level?->card(),
            'route' => $levels->map(fn (StudyLevel $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'summary' => $item->summary,
                'state' => match (true) {
                    $graduated, $level && $item->sort_order < $level->sort_order => 'done',
                    $level && $item->id === $level->id => 'current',
                    default => 'next',
                },
                'average' => $averages[$item->id] ?? null,
            ])->values()->all(),
            'grades' => $grades,
            'summary' => [
                'average' => $average,
                'graded' => $graded,
                'total' => count($grades),
                'pass_score' => $level?->pass_score ?? 11,
                'max_score' => self::MAX_SCORE,
            ],
            'verses' => StudyVerse::query()->where('active', true)->where($levelFilter)->orderBy('created_at')->get()->map->card()->all(),
            'notices' => StudyNotice::visible()->where($levelFilter)->limit(30)->get()->map->card()->all(),
            'readings' => StudyReading::query()->where('active', true)->where($levelFilter)->orderByRaw('week is null')->orderBy('week')->orderBy('created_at')->get()->map->card()->all(),
        ];
    }
}
