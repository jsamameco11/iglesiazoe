<?php

namespace App\Domain\Games;

use App\Models\OcultoCategory;
use App\Models\OcultoWord;

/**
 * Words and rules of El Cristiano Oculto, the hidden-player word game. Each round every
 * player still in the game gives one clue, then they vote; the most voted player is out.
 * The group wins when every hidden player is out; the hidden ones win when the rounds run
 * out or they are as many as the faithful players left.
 */
class Oculto
{
    public const MIN_PLAYERS = 3;

    public const DEFAULT_LEVEL = 'intermedio';

    /** A random visible word of the chosen themes (any visible theme when none is chosen) and level. */
    public static function randomWord(array $categoryIds = [], ?string $level = null): ?OcultoWord
    {
        $themes = OcultoCategory::query()->where('active', true)
            ->when($categoryIds, fn ($query) => $query->whereIn('id', $categoryIds))
            ->pluck('id');

        return OcultoWord::query()->where('active', true)->whereIn('oculto_category_id', $themes)
            ->when(self::level($level), fn ($query, string $chosen) => $query->where('level', $chosen))
            ->with('category')->inRandomOrder()->first();
    }

    /** A known level, or null to mix both. */
    public static function level(?string $level): ?string
    {
        return array_key_exists((string) $level, OcultoWord::LEVELS) ? $level : null;
    }

    /** Rounds the game lasts at most: 3 players play one round, 4 play two, and so on up to 8. */
    public static function maxRounds(int $players): int
    {
        return $players <= self::MIN_PLAYERS ? 1 : min($players - 2, 8);
    }

    /** Two hidden players need at least five seats; smaller groups always play with one. */
    public static function maxImpostors(int $players): int
    {
        return $players >= 5 ? 2 : 1;
    }

    /**
     * Counts the votes: the player with the most votes on their own is out; a tie sends nobody out.
     *
     * @param  array<string, string>  $votes  Voter => suspect.
     * @return array{out: ?string, tally: array<string, int>}
     */
    public static function tally(array $votes): array
    {
        $tally = array_count_values(array_values($votes));
        arsort($tally);
        $top = array_key_first($tally);
        $topCount = $top === null ? 0 : $tally[$top];
        $tied = count(array_filter($tally, fn (int $count) => $count === $topCount)) > 1;

        return ['out' => $tied ? null : $top, 'tally' => $tally];
    }

    /**
     * Who won once a round is over, or null while the game goes on.
     *
     * @param  list<string>  $alive  Players still in the game.
     * @param  list<string>  $impostors  Hidden players still in the game.
     */
    public static function winner(array $alive, array $impostors, int $round, int $rounds): ?string
    {
        if (! $impostors) {
            return 'group';
        }
        if (count($impostors) * 2 >= count($alive) || $round >= $rounds) {
            return 'hidden';
        }

        return null;
    }

    /** @return list<array{id: string, slug: string, name: string, words: int, levels: array<string, int>}> */
    public static function themes(): array
    {
        $levels = OcultoWord::query()->where('active', true)
            ->selectRaw('oculto_category_id, level, count(*) as total')
            ->groupBy('oculto_category_id', 'level')
            ->get()
            ->groupBy('oculto_category_id');

        return OcultoCategory::ordered()->where('active', true)->get()
            ->map(function (OcultoCategory $category) use ($levels) {
                $counts = array_map(fn () => 0, OcultoWord::LEVELS);
                foreach ($levels->get($category->id, []) as $row) {
                    $counts[$row->level] = (int) $row->total;
                }

                return ['id' => $category->id, 'slug' => $category->slug, 'name' => $category->name, 'words' => array_sum($counts), 'levels' => $counts];
            })
            ->filter(fn (array $theme) => $theme['words'] > 0)
            ->values()->all();
    }
}
