<?php

namespace App\Domain\Reports\Support;

use Carbon\Carbon;

class WeekCalendar
{
    public static function range(int $year, int $week): array
    {
        $jan1 = Carbon::create($year, 1, 1)->startOfDay();
        $start = $jan1->copy()->subDays($jan1->dayOfWeek)->addWeeks($week - 1);
        $end = $start->copy()->addDays(6);

        return [$start, $end];
    }

    public static function weeksOfYear(int $year): array
    {
        $weeks = [];
        $months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
        for ($week = 1; $week <= 54; $week++) {
            [$start, $end] = self::range($year, $week);
            if ($end->year < $year) {
                continue;
            }
            if ($start->year > $year) {
                break;
            }
            $weeks[] = [
                'week' => $week,
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'label' => sprintf(
                    'Semana:%02d | %s de %s - %s de %s',
                    $week,
                    $start->format('d'),
                    $months[$start->month - 1],
                    $end->format('d'),
                    $months[$end->month - 1],
                ),
            ];
        }

        return $weeks;
    }

    public static function currentLabel(): string
    {
        $now = self::current();
        [$start, $end] = self::range($now['year'], $now['week']);

        return sprintf('Semana %d · %s - %s', $now['week'], $start->format('d/m'), $end->format('d/m'));
    }

    public static function current(?Carbon $date = null): array
    {
        $date = ($date ?? now())->startOfDay();
        $year = $date->year;
        foreach (self::weeksOfYear($year) as $week) {
            [$start, $end] = self::range($year, $week['week']);
            if ($date->betweenIncluded($start, $end)) {
                return ['year' => $year, 'week' => $week['week']];
            }
        }

        $weeks = self::weeksOfYear($year);

        return ['year' => $year, 'week' => $weeks[array_key_last($weeks)]['week'] ?? 1];
    }
}
