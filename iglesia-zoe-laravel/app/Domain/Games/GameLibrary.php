<?php

namespace App\Domain\Games;

use Illuminate\Support\Facades\DB;

/**
 * Loads the starting content of the three games (REBET, LINGOBIBLE and El Cristiano Oculto)
 * from database/data/games. It only fills empty tables, so the content the church edits in
 * the panel is never overwritten.
 */
class GameLibrary
{
    private const CHUNK = 200;

    public static function import(): void
    {
        $now = now();
        $stamp = ['created_at' => $now, 'updated_at' => $now];

        if (! DB::table('rebet_categories')->exists()) {
            $rebet = self::read('rebet');
            self::insert('rebet_categories', array_map(fn (array $row) => [...$row, ...$stamp], $rebet['categories']));
            self::insert('rebet_questions', array_map(fn (array $row) => [
                'id' => $row['id'],
                'rebet_category_id' => $row['category_id'],
                'difficulty' => $row['difficulty'],
                'question' => $row['question'],
                'options' => json_encode($row['options'], JSON_UNESCAPED_UNICODE),
                'correct' => $row['correct'],
                'explanation' => $row['explanation'],
                'reference' => $row['reference'],
                'time_limit' => $row['time_limit'],
                'base_points' => $row['base_points'],
                'active' => true,
                ...$stamp,
            ], $rebet['questions']));
        }

        if (! DB::table('lingo_paths')->exists()) {
            $lingo = self::read('lingobible');
            self::insert('lingo_paths', array_map(fn (array $row) => [...$row, ...$stamp], $lingo['paths']));
            self::insert('lingo_units', array_map(fn (array $row) => [
                'id' => $row['id'],
                'lingo_path_id' => $row['path_id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'sort_order' => $row['sort_order'],
                ...$stamp,
            ], $lingo['units']));
            self::insert('lingo_lessons', array_map(fn (array $row) => [
                'id' => $row['id'],
                'lingo_unit_id' => $row['unit_id'],
                'title' => $row['title'],
                'xp' => $row['xp'],
                'sort_order' => $row['sort_order'],
                'published' => $row['published'],
                ...$stamp,
            ], $lingo['lessons']));
            self::insert('lingo_exercises', array_map(fn (array $row) => [
                'id' => $row['id'],
                'lingo_lesson_id' => $row['lesson_id'],
                'kind' => $row['kind'],
                'prompt' => $row['prompt'],
                'passage_reference' => $row['passage_reference'],
                'passage_text' => $row['passage_text'],
                'options' => $row['options'] === null ? null : json_encode($row['options'], JSON_UNESCAPED_UNICODE),
                'answer' => $row['answer'],
                'sort_order' => $row['sort_order'],
                ...$stamp,
            ], $lingo['exercises']));
        }

        if (! DB::table('oculto_categories')->exists()) {
            $oculto = self::read('oculto');
            self::insert('oculto_categories', array_map(fn (array $row) => [...$row, ...$stamp], $oculto['categories']));
            self::insert('oculto_words', array_map(fn (array $row) => [
                'id' => $row['id'],
                'oculto_category_id' => $row['category_id'],
                'word' => $row['word'],
                'description' => $row['description'],
                'reference' => $row['reference'],
                'clues' => json_encode($row['clues'], JSON_UNESCAPED_UNICODE),
                'active' => $row['active'],
                ...$stamp,
            ], $oculto['words']));
        }
    }

    /** @return array<string, list<array<string, mixed>>> */
    private static function read(string $name): array
    {
        return json_decode((string) file_get_contents(database_path("data/games/{$name}.json")), true, flags: JSON_THROW_ON_ERROR);
    }

    /** @param  list<array<string, mixed>>  $rows */
    private static function insert(string $table, array $rows): void
    {
        foreach (array_chunk($rows, self::CHUNK) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }
}
