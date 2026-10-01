<?php

namespace App\Domain\Reports\Support;

use Carbon\Carbon;
use Illuminate\Http\Request;

class Period
{
    private const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

    public function __construct(
        public readonly string $mode,
        public readonly Carbon $from,
        public readonly Carbon $to,
        public readonly string $label,
        public readonly array $filters,
    ) {}

    public static function fromRequest(Request $request, array $modes = ['semana', 'mes', 'anio', 'rango']): self
    {
        $now = WeekCalendar::current();
        $mode = in_array($request->query('periodo'), $modes, true) ? $request->query('periodo') : $modes[0];
        $year = max(2020, min(2100, (int) $request->query('anio', $now['year'])));
        $week = max(1, min(54, (int) $request->query('semana', $year === $now['year'] ? $now['week'] : 1)));
        $month = max(1, min(12, (int) $request->query('mes', now()->month)));
        $filters = ['periodo' => $mode, 'anio' => $year, 'semana' => $week, 'mes' => $month, 'desde' => '', 'hasta' => ''];

        if ($mode === 'semana') {
            [$from, $to] = WeekCalendar::range($year, $week);

            return new self($mode, $from->startOfDay(), $to->endOfDay(), sprintf('Semana %02d · %s al %s', $week, $from->format('d/m'), $to->format('d/m/Y')), $filters);
        }
        if ($mode === 'mes') {
            $from = Carbon::create($year, $month, 1)->startOfDay();

            return new self($mode, $from, $from->copy()->endOfMonth(), ucfirst(self::MONTHS[$month - 1]).' '.$year, $filters);
        }
        if ($mode === 'rango') {
            $from = self::date($request->query('desde')) ?? now()->startOfMonth();
            $to = self::date($request->query('hasta')) ?? now();
            if ($to->lt($from)) {
                [$from, $to] = [$to, $from];
            }
            $filters['desde'] = $from->toDateString();
            $filters['hasta'] = $to->toDateString();

            return new self($mode, $from->startOfDay(), $to->endOfDay(), 'Del '.$from->format('d/m/Y').' al '.$to->format('d/m/Y'), $filters);
        }

        $from = Carbon::create($year, 1, 1)->startOfDay();

        return new self('anio', $from, $from->copy()->endOfYear(), 'Año '.$year, $filters);
    }

    public static function currentMonth(): self
    {
        $from = now()->startOfMonth();

        return new self('mes', $from, $from->copy()->endOfMonth(), ucfirst(self::MONTHS[$from->month - 1]).' '.$from->year, ['periodo' => 'mes', 'anio' => $from->year, 'mes' => $from->month]);
    }

    /** Whether a report filed for year/week on a given date belongs to this period. */
    public function includes(int $year, int $week, string $date): bool
    {
        if ($this->mode === 'semana') {
            return $year === (int) $this->filters['anio'] && $week === (int) $this->filters['semana'];
        }

        return $date >= $this->from->toDateString() && $date <= $this->to->toDateString();
    }

    private static function date(mixed $value): ?Carbon
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? Carbon::parse($value) : null;
    }
}
