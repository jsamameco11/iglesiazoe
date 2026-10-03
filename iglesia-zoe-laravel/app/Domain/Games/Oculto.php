<?php

namespace App\Domain\Games;

use App\Models\OcultoCategory;
use App\Models\OcultoWord;

/** Words and rules of El Cristiano Oculto, the hidden-player word game. */
class Oculto
{
    public const MIN_PLAYERS = 3;

    public const CLUE_PASSES = 2;

    /** A random visible word of the chosen themes (any visible theme when none is chosen). */
    public static function randomWord(array $categoryIds = []): ?OcultoWord
    {
        $themes = OcultoCategory::query()->where('active', true)
            ->when($categoryIds, fn ($query) => $query->whereIn('id', $categoryIds))
            ->pluck('id');

        return OcultoWord::query()->where('active', true)->whereIn('oculto_category_id', $themes)
            ->with('category')->inRandomOrder()->first();
    }

    /** Rounds a hidden player can survive: 3 players play one round, 4 play two, and so on up to 8. */
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
     * Counts the votes. The group catches the hidden player only when one person has the most
     * votes on their own, more than half of them, and that person really is hidden.
     *
     * @param  array<string, string>  $votes  Voter => suspect.
     * @param  list<string>  $impostors
     * @return array{top: ?string, caught: bool, tally: array<string, int>}
     */
    public static function tally(array $votes, array $impostors): array
    {
        $tally = array_count_values(array_values($votes));
        arsort($tally);
        $top = array_key_first($tally);
        $topCount = $top === null ? 0 : $tally[$top];
        $tied = count(array_filter($tally, fn (int $count) => $count === $topCount)) > 1;
        $caught = $top !== null && ! $tied && $topCount * 2 > count($votes) && in_array($top, $impostors, true);

        return ['top' => $tied ? null : $top, 'caught' => $caught, 'tally' => $tally];
    }

    /** @return list<array{id: string, slug: string, name: string, words: int}> */
    public static function themes(): array
    {
        return OcultoCategory::ordered()->where('active', true)
            ->withCount(['words' => fn ($query) => $query->where('active', true)])
            ->get()
            ->filter(fn (OcultoCategory $category) => $category->words_count > 0)
            ->map(fn (OcultoCategory $category) => ['id' => $category->id, 'slug' => $category->slug, 'name' => $category->name, 'words' => $category->words_count])
            ->values()->all();
    }
}
