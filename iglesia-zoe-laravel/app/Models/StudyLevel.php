<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyLevel extends UuidModel
{
    public const TIMEZONE = 'America/Lima';

    private const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    protected $fillable = ['slug', 'name', 'summary', 'weeks', 'starts_on', 'ends_on', 'class_time', 'place', 'teacher', 'pass_score', 'sort_order', 'active'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'weeks' => 'integer',
            'pass_score' => 'float',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    public static function ordered(): Builder
    {
        return self::query()->orderBy('sort_order')->orderBy('name');
    }

    public function assessments(): HasMany
    {
        return $this->hasMany(StudyAssessment::class)->orderBy('sort_order')->orderBy('created_at');
    }

    public function students(): HasMany
    {
        return $this->hasMany(StudyStudent::class);
    }

    public function startDate(): ?CarbonImmutable
    {
        return $this->starts_on ? CarbonImmutable::parse($this->starts_on->toDateString(), self::TIMEZONE) : null;
    }

    /** Last class: the date set by the admin, or the start date plus the length of the level. */
    public function endDate(): ?CarbonImmutable
    {
        if ($this->ends_on) {
            return CarbonImmutable::parse($this->ends_on->toDateString(), self::TIMEZONE);
        }

        return $this->startDate()?->addWeeks(max(1, $this->weeks) - 1);
    }

    /**
     * Where the level stands today: not scheduled, about to start, running (with its
     * current week) or finished, plus the next class at its start time.
     */
    public function schedule(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now(self::TIMEZONE);
        $start = $this->startDate();
        $end = $this->endDate();
        $weeks = max(1, (int) $this->weeks);
        $base = [
            'weeks' => $weeks,
            'starts_on' => $start?->toDateString(),
            'ends_on' => $end?->toDateString(),
            'class_time' => $this->class_time ?: '09:00',
            'day' => $start ? self::DAYS[$start->dayOfWeek] : null,
        ];
        if (! $start || ! $end) {
            return [...$base, 'state' => 'pending', 'week' => null, 'progress' => 0, 'next_class' => null];
        }

        $today = $now->startOfDay();
        [$hour, $minute] = array_map('intval', explode(':', $base['class_time']) + [0, 0]);
        if ($today->lessThan($start)) {
            return [...$base, 'state' => 'upcoming', 'week' => 0, 'progress' => 0, 'next_class' => $start->setTime($hour, $minute)->toIso8601String()];
        }
        if ($today->greaterThan($end)) {
            return [...$base, 'state' => 'finished', 'week' => $weeks, 'progress' => 100, 'next_class' => null];
        }

        $week = min($weeks, intdiv((int) abs($start->diffInDays($today)), 7) + 1);
        $next = $today->addDays(($start->dayOfWeek - $today->dayOfWeek + 7) % 7)->setTime($hour, $minute);
        if ($next->lessThan($now)) {
            $next = $next->addWeek();
        }

        return [
            ...$base,
            'state' => 'running',
            'week' => $week,
            'progress' => (int) round(min(100, max(0, abs($start->diffInDays($today)) / max(1, abs($start->diffInDays($end))) * 100))),
            'next_class' => $next->startOfDay()->lessThanOrEqualTo($end) ? $next->toIso8601String() : null,
        ];
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'summary' => $this->summary,
            'place' => $this->place,
            'teacher' => $this->teacher,
            'pass_score' => $this->pass_score,
            'sort_order' => $this->sort_order,
            'active' => $this->active,
            'schedule' => $this->schedule(),
        ];
    }
}
