<?php

namespace App\Domain\Finance;

use App\Domain\Reports\Support\Period;
use App\Domain\Reports\Support\WeekCalendar;
use App\Models\Expense;
use App\Models\Report;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class Finance
{
    private const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

    /** Report income inside the period, one row per report. */
    public static function income(Period $period, ?array $cellIds = null): Collection
    {
        return Report::query()
            ->with(['cell.network', 'attendance'])
            ->whereBetween('year', [$period->from->year - 1, $period->to->year + 1])
            ->when($cellIds !== null, fn ($query) => $query->whereIn('cell_id', $cellIds ?: ['00000000-0000-0000-0000-000000000000']))
            ->get()
            ->map(function (Report $report) {
                $date = $report->meeting_date
                    ? Carbon::parse($report->meeting_date)
                    : WeekCalendar::range($report->year, $report->week)[0];

                return [
                    'id' => $report->id,
                    'date' => $date->toDateString(),
                    'year' => (int) $report->year,
                    'week' => (int) $report->week,
                    'cell' => $report->cell?->code ?? '—',
                    'leader' => $report->cell?->leader_name,
                    'network' => $report->cell?->network?->code ?? '—',
                    'met' => (bool) $report->met,
                    'offering' => (float) $report->offering,
                    'tithes' => (float) $report->attendance->sum('tithe'),
                ];
            })
            ->filter(fn ($row) => $period->includes($row['year'], $row['week'], $row['date']))
            ->sortBy('date')
            ->values();
    }

    public static function expenses(Period $period): Collection
    {
        return Expense::query()->with('user')
            ->whereBetween('spent_on', [$period->from->toDateString(), $period->to->toDateString()])
            ->orderByDesc('spent_on')
            ->get();
    }

    public static function summary(Period $period, ?Collection $income = null, ?Collection $expenses = null): array
    {
        $income ??= self::income($period);
        $expenses ??= self::expenses($period);
        $offerings = round($income->sum('offering'), 2);
        $tithes = round($income->sum('tithes'), 2);
        $spent = round((float) $expenses->sum('amount'), 2);

        return [
            'offerings' => $offerings,
            'tithes' => $tithes,
            'income' => round($offerings + $tithes, 2),
            'expenses' => $spent,
            'balance' => round($offerings + $tithes - $spent, 2),
            'reports' => $income->count(),
        ];
    }

    /** Buckets by week or month for the chart. */
    public static function series(Period $period, Collection $income, Collection $expenses): array
    {
        $byMonth = $period->from->diffInDays($period->to) > 70;
        $key = function (string $date) use ($byMonth) {
            $day = Carbon::parse($date);
            if ($byMonth) {
                return $day->format('Y-m');
            }
            $week = WeekCalendar::current($day);

            return sprintf('%d-%02d', $week['year'], $week['week']);
        };
        $label = function (string $bucket) use ($byMonth) {
            [$year, $part] = explode('-', $bucket);

            return $byMonth ? self::MONTHS[(int) $part - 1].' '.substr($year, 2) : 'Sem '.(int) $part;
        };

        $buckets = [];
        $cursor = $period->from->copy()->startOfDay();
        while ($cursor->lte($period->to)) {
            $buckets[$key($cursor->toDateString())] = ['offerings' => 0.0, 'tithes' => 0.0, 'expenses' => 0.0];
            $byMonth ? $cursor->addMonthNoOverflow()->startOfMonth() : $cursor->addDay();
        }
        foreach ($income as $row) {
            $bucket = $period->mode === 'semana' ? array_key_first($buckets) : $key($row['date']);
            if (isset($buckets[$bucket])) {
                $buckets[$bucket]['offerings'] += $row['offering'];
                $buckets[$bucket]['tithes'] += $row['tithes'];
            }
        }
        foreach ($expenses as $expense) {
            $bucket = $key($expense->spent_on->toDateString());
            if (isset($buckets[$bucket])) {
                $buckets[$bucket]['expenses'] += (float) $expense->amount;
            }
        }

        return collect($buckets)->map(fn ($values, $bucket) => [
            'label' => $label($bucket),
            'offerings' => round($values['offerings'], 2),
            'tithes' => round($values['tithes'], 2),
            'expenses' => round($values['expenses'], 2),
        ])->values()->all();
    }

    public static function money(float $amount): string
    {
        return 'S/ '.number_format($amount, 2, '.', ',');
    }
}
