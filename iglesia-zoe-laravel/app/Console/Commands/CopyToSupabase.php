<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

class CopyToSupabase extends Command
{
    protected $signature = 'zoe:copy-to-supabase {sqlite : Ruta del archivo SQLite de origen} {--force : Vaciar las tablas de destino antes de copiar}';

    protected $description = 'Copia todos los datos de SQLite a la conexión pgsql (Supabase), conservando los IDs.';

    private const SKIP = ['migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sqlite_sequence'];

    public function handle(): int
    {
        $path = (string) $this->argument('sqlite');
        if (! is_file($path)) {
            $this->error("No existe $path");

            return self::FAILURE;
        }

        Config::set('database.connections.zoe_source', ['driver' => 'sqlite', 'database' => $path, 'foreign_key_constraints' => false]);
        $source = DB::connection('zoe_source');
        $target = DB::connection('pgsql');

        $tables = collect($source->select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"))
            ->pluck('name')
            ->reject(fn ($name) => in_array($name, self::SKIP, true))
            ->values()
            ->all();

        $targetTables = collect($target->select('select table_name from information_schema.tables where table_schema = current_schema()'))
            ->pluck('table_name')
            ->all();

        $missing = array_diff($tables, $targetTables);
        if ($missing) {
            $this->error('Faltan tablas en destino (ejecuta migrate primero): '.implode(', ', $missing));

            return self::FAILURE;
        }

        $ordered = $this->order($source, $tables);

        $filled = array_filter($ordered, fn ($table) => $target->table($table)->exists());
        if ($filled && ! $this->option('force')) {
            $this->error('El destino ya tiene datos en: '.implode(', ', $filled).'. Usa --force para reemplazarlos.');

            return self::FAILURE;
        }

        $target->transaction(function () use ($source, $target, $ordered) {
            $target->statement('truncate table '.implode(', ', array_map(fn ($t) => '"'.$t.'"', $ordered)).' restart identity cascade');

            foreach ($ordered as $table) {
                $booleans = collect($target->select(
                    "select column_name from information_schema.columns where table_schema = current_schema() and table_name = ? and data_type = 'boolean'",
                    [$table],
                ))->pluck('column_name')->all();
                $columns = collect($target->select(
                    'select column_name from information_schema.columns where table_schema = current_schema() and table_name = ?',
                    [$table],
                ))->pluck('column_name')->all();

                $selfKeys = collect($source->select("pragma foreign_key_list(\"$table\")"))
                    ->filter(fn ($fk) => $fk->table === $table)
                    ->map(fn ($fk) => [$fk->from, $fk->to ?: 'id'])
                    ->values()
                    ->all();
                $chunks = $selfKeys
                    ? collect($this->parentsFirst($source->table($table)->get()->all(), $selfKeys))->chunk(300)
                    : $source->table($table)->cursor()->chunk(300);

                $count = 0;
                foreach ($chunks as $chunk) {
                    $rows = $chunk->map(function ($row) use ($booleans, $columns) {
                        $row = array_intersect_key((array) $row, array_flip($columns));
                        foreach ($booleans as $column) {
                            if (array_key_exists($column, $row) && $row[$column] !== null) {
                                $row[$column] = (bool) $row[$column];
                            }
                        }

                        return $row;
                    })->values()->all();
                    $target->table($table)->insert($rows);
                    $count += count($rows);
                }
                $this->line(str_pad($table, 32).$count);
            }

            $serial = collect($target->select(
                "select table_name from information_schema.columns where table_schema = current_schema() and column_name = 'id' and (column_default like 'nextval%' or is_identity = 'YES')",
            ))->pluck('table_name')->all();
            foreach (array_intersect($ordered, $serial) as $table) {
                $sequence = $target->selectOne("select pg_get_serial_sequence(?, 'id') as seq", ['"'.$table.'"'])?->seq ?? null;
                if ($sequence) {
                    $target->statement("select setval('$sequence', coalesce((select max(id) from \"$table\"), 0) + 1, false)");
                }
            }
        });

        $mismatch = [];
        foreach ($ordered as $table) {
            $from = $source->table($table)->count();
            $to = $target->table($table)->count();
            if ($from !== $to) {
                $mismatch[] = "$table ($from → $to)";
            }
        }
        if ($mismatch) {
            $this->error('Conteos distintos: '.implode(', ', $mismatch));

            return self::FAILURE;
        }

        $this->info('Copia completa y verificada: '.count($ordered).' tablas.');

        return self::SUCCESS;
    }

    /**
     * @param  list<object>  $rows
     * @param  list<array{0:string,1:string}>  $keys
     * @return list<object>
     */
    private function parentsFirst(array $rows, array $keys): array
    {
        $seen = [];
        $ordered = [];
        while ($rows) {
            $rest = [];
            foreach ($rows as $row) {
                $ready = true;
                foreach ($keys as [$from, $to]) {
                    $parent = $row->{$from} ?? null;
                    if ($parent !== null && ! isset($seen[$to][(string) $parent]) && (string) $parent !== (string) ($row->{$to} ?? '')) {
                        $ready = false;
                    }
                }
                if ($ready) {
                    $ordered[] = $row;
                    foreach ($keys as [, $to]) {
                        $seen[$to][(string) ($row->{$to} ?? '')] = true;
                    }
                } else {
                    $rest[] = $row;
                }
            }
            if (count($rest) === count($rows)) {
                array_push($ordered, ...$rest);
                break;
            }
            $rows = $rest;
        }

        return $ordered;
    }

    /** @param  list<string>  $tables */
    private function order($source, array $tables): array
    {
        $deps = [];
        foreach ($tables as $table) {
            $deps[$table] = collect($source->select("pragma foreign_key_list(\"$table\")"))
                ->pluck('table')
                ->filter(fn ($parent) => $parent !== $table && in_array($parent, $tables, true))
                ->unique()
                ->values()
                ->all();
        }

        $ordered = [];
        while (count($ordered) < count($tables)) {
            $progress = false;
            foreach ($tables as $table) {
                if (in_array($table, $ordered, true)) {
                    continue;
                }
                if (! array_diff($deps[$table], $ordered)) {
                    $ordered[] = $table;
                    $progress = true;
                }
            }
            if (! $progress) {
                foreach ($tables as $table) {
                    if (! in_array($table, $ordered, true)) {
                        $ordered[] = $table;
                    }
                }
            }
        }

        return $ordered;
    }
}
