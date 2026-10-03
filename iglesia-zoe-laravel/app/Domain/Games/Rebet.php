<?php

namespace App\Domain\Games;

use App\Models\RebetCategory;
use App\Models\RebetQuestion;
use Illuminate\Support\Collection;

/** Questions and scoring of REBET, the timed Bible trivia. */
class Rebet
{
    public const COUNTS = [5, 10, 15, 20];

    public const SPEED_BONUS_MAX = 500;

    public const STREAK_STEP = 50;

    public const STREAK_CAP = 500;

    public const DIFFICULTY_MULTIPLIER = ['easy' => 1.0, 'medium' => 1.2, 'hard' => 1.5, 'expert' => 2.0];

    /** Seconds of network delay forgiven before an answer counts as late. */
    private const GRACE_SECONDS = 2;

    /**
     * Picks the questions of a game: the chosen themes and difficulty first, then the same
     * themes at any difficulty, then any theme, so a game is never left short.
     *
     * @param  list<string>  $categoryIds
     * @return Collection<int, RebetQuestion>
     */
    public static function pick(array $categoryIds, string $difficulty, int $count): Collection
    {
        $count = in_array($count, self::COUNTS, true) ? $count : 10;
        $themes = RebetCategory::query()->where('active', true)->whereIn('id', $categoryIds)->pluck('id')->all();
        $base = fn () => RebetQuestion::query()->where('active', true)
            ->whereHas('category', fn ($query) => $query->where('active', true))
            ->with('category');

        $picked = collect();
        $attempts = [
            [$themes, array_key_exists($difficulty, RebetQuestion::DIFFICULTIES) ? $difficulty : null],
            [$themes, null],
            [[], null],
        ];
        foreach ($attempts as [$scope, $level]) {
            if ($picked->count() >= $count) {
                break;
            }
            $query = $base()->whereNotIn('id', $picked->pluck('id')->all());
            if ($scope) {
                $query->whereIn('rebet_category_id', $scope);
            }
            if ($level) {
                $query->where('difficulty', $level);
            }
            $picked = $picked->concat($query->inRandomOrder()->limit($count - $picked->count())->get());
        }

        return $picked->shuffle()->values();
    }

    /**
     * Grades one answer. A right answer inside the time earns its base points plus a speed
     * bonus and a streak bonus, all multiplied by the difficulty; anything else earns nothing.
     *
     * @return array{correct: bool, points: int, right: int, explanation: ?string, reference: ?string, late: bool}
     */
    public static function grade(RebetQuestion $question, int $choice, float $seconds, int $streak): array
    {
        $late = $seconds > $question->time_limit + self::GRACE_SECONDS;
        $correct = ! $late && $choice === $question->correct;
        $points = 0;
        if ($correct) {
            $elapsed = min(max($seconds, 0), $question->time_limit);
            $speed = (int) round(self::SPEED_BONUS_MAX * (1 - $elapsed / max($question->time_limit, 1)));
            $bonus = min(self::STREAK_CAP, max($streak, 0) * self::STREAK_STEP);
            $points = (int) round(($question->base_points + $speed + $bonus) * (self::DIFFICULTY_MULTIPLIER[$question->difficulty] ?? 1.0));
        }

        return [
            'correct' => $correct,
            'points' => $points,
            'right' => $question->correct,
            'explanation' => $question->explanation,
            'reference' => $question->reference,
            'late' => $late,
        ];
    }

    /** @return list<array{id: string, slug: string, name: string, questions: int}> */
    public static function themes(): array
    {
        return RebetCategory::ordered()->where('active', true)
            ->withCount(['questions' => fn ($query) => $query->where('active', true)])
            ->get()
            ->filter(fn (RebetCategory $category) => $category->questions_count > 0)
            ->map(fn (RebetCategory $category) => ['id' => $category->id, 'slug' => $category->slug, 'name' => $category->name, 'questions' => $category->questions_count])
            ->values()->all();
    }
}
