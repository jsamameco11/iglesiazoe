<?php

namespace App\Domain\Shared\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class Counts
{
    /**
     * Counts every query in a single round trip: the database is remote, so each separate query pays the whole network delay.
     *
     * @template TKey of string
     *
     * @param  array<TKey, Builder>  $queries
     * @return array<TKey, int>
     */
    public static function all(array $queries): array
    {
        if ($queries === []) {
            return [];
        }
        $select = DB::query();
        foreach ($queries as $name => $query) {
            $select->selectSub($query->toBase()->selectRaw('count(*)'), $name);
        }
        $row = (array) $select->first();
        $counts = [];
        foreach (array_keys($queries) as $name) {
            $counts[$name] = (int) ($row[$name] ?? 0);
        }

        return $counts;
    }
}
