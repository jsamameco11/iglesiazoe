<?php

namespace App\Domain\Radio\Identify;

use Illuminate\Support\Str;

/** Text rules to compare song names, artist names and albums the way people write them. */
final class Text
{
    /** Words that mark a recorded-live version. */
    private const LIVE = '/\b(live|en vivo|ao vivo|en directo|directo|desde casa|sesion en vivo)\b/i';

    /** Bracketed notes that are not part of a song name: credits, versions, video labels. */
    private const NOISE = '/\b(feat|ft|featuring|con|with|live|en vivo|ao vivo|en directo|official|oficial|video|videoclip|audio|lyric|lyrics|letra|visualizer|remaster(ed)?|remasterizado|version|versi[oó]n|edit|radio edit|mono|stereo|explicit|hd|4k|single|sencillo|deluxe|bonus|acoustic|ac[uú]stico|instrumental|pista|karaoke|cover)\b/iu';

    /** Separators between the credited names of a song. */
    private const SPLIT = '/(?:\s*(?:,|;|\/|(?<=\s)(?:&|\+|y|e|x|and|feat\.?|ft\.?|featuring|con|with|vs\.?)(?=\s))\s*)+/iu';

    /** Lowercase, without accents or punctuation: «Renuévame (En Vivo)» → «renuevame en vivo». */
    public static function key(?string $value): string
    {
        $value = Str::lower(Str::ascii((string) $value));
        $value = str_replace(['&', '+'], [' and ', ' and '], $value);
        $value = preg_replace('/[^a-z0-9]+/', ' ', $value) ?? '';

        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    /** The song name without credits, version notes or video labels. */
    public static function cleanTitle(string $title): string
    {
        $title = preg_replace_callback('/\s*[\(\[\{]([^\)\]\}]*)[\)\]\}]/u', fn ($match) => preg_match(self::NOISE, $match[1]) ? '' : $match[0], $title) ?? $title;
        $title = preg_replace('/\s+[-–—|]\s+.*\b(live|en vivo|ao vivo|official|oficial|video|audio|lyric|letra|remaster|versi[oó]n|version|ac[uú]stico|acoustic)\b.*$/iu', '', $title) ?? $title;
        $title = preg_replace('/\s+(feat\.?|ft\.?|featuring)\s+.+$/iu', '', $title) ?? $title;

        return trim(preg_replace('/\s+/u', ' ', $title) ?? $title, " \t\n\r\0\x0B-–—|·.");
    }

    /** Names credited inside a song name: «Derramo el Perfume (feat. Averly Morillo) [Live]» → [Averly Morillo]. */
    public static function featuredIn(string $title, array $known = []): array
    {
        $names = [];
        if (preg_match_all('/[\(\[]\s*(?:feat\.?|ft\.?|featuring|con|with)\s+([^\)\]]+)[\)\]]/iu', $title, $matches)) {
            foreach ($matches[1] as $credit) {
                $names = [...$names, ...self::splitNames($credit, $known)];
            }
        } elseif (preg_match('/\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/iu', $title, $match)) {
            $names = self::splitNames($match[1], $known);
        }

        return self::unique($names);
    }

    /**
     * Credited names one by one, keeping known names whole even when they contain a separator
     * («Majo y Dan», «for KING & COUNTRY»).
     *
     * @param  list<string>  $known
     * @return list<string>
     */
    public static function splitNames(string $credit, array $known = []): array
    {
        $credit = trim($credit);
        if ($credit === '') {
            return [];
        }
        $kept = [];
        $joined = array_filter($known, fn (string $name) => preg_match(self::SPLIT, ' '.$name.' ') === 1 || str_contains($name, ','));
        usort($joined, fn (string $a, string $b) => mb_strlen($b) <=> mb_strlen($a));
        foreach ($joined as $name) {
            $pattern = '/(?<![\p{L}\p{N}])'.preg_quote($name, '/').'(?![\p{L}\p{N}])/iu';
            if (preg_match($pattern, $credit, $match)) {
                $kept[] = $match[0];
                $credit = preg_replace($pattern, ',', $credit, 1) ?? $credit;
            }
        }
        $parts = preg_split(self::SPLIT, ' '.$credit.' ') ?: [];
        $names = array_map(fn (string $part) => trim($part, " \t\n\r\0\x0B.-–—"), [...$kept, ...$parts]);

        return self::unique(array_values(array_filter($names, fn (string $name) => self::key($name) !== '')));
    }

    /** @param  list<string>  $names */
    public static function unique(array $names): array
    {
        $seen = [];
        $unique = [];
        foreach ($names as $name) {
            $name = trim(preg_replace('/\s+/u', ' ', $name) ?? $name);
            $key = self::key($name);
            if ($key !== '' && ! isset($seen[$key])) {
                $seen[$key] = true;
                $unique[] = $name;
            }
        }

        return $unique;
    }

    public static function isLive(string $value): bool
    {
        return preg_match(self::LIVE, Str::ascii($value)) === 1;
    }

    /** The album name without edition notes, to group the same album across stores. */
    public static function albumKey(string $album): string
    {
        $album = preg_replace('/\s*[\(\[][^\)\]]*(live|en vivo|ao vivo|deluxe|edition|edicion|edición|remaster|expanded|bonus|version|versión)[^\)\]]*[\)\]]/iu', '', $album) ?? $album;
        $album = preg_replace('/\s+-\s+(single|ep)$/iu', '', $album) ?? $album;

        return self::key($album);
    }

    /** How alike two names are, from 0 to 1, ignoring case, accents and punctuation. */
    public static function similarity(?string $a, ?string $b): float
    {
        $a = self::key($a);
        $b = self::key($b);
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }
        $short = strlen($a) < strlen($b) ? $a : $b;
        $long = $short === $a ? $b : $a;
        $contained = strlen($short) >= 4 && preg_match('/(^| )'.preg_quote($short, '/').'( |$)/', $long) === 1
            ? 0.7 + 0.3 * strlen($short) / strlen($long)
            : 0.0;
        similar_text($a, $b, $percent);
        $tokensA = array_unique(explode(' ', $a));
        $tokensB = array_unique(explode(' ', $b));
        $jaccard = count(array_intersect($tokensA, $tokensB)) / max(1, count(array_unique([...$tokensA, ...$tokensB])));
        $edit = strlen($a) <= 255 && strlen($b) <= 255 ? 1 - levenshtein($a, $b) / max(strlen($a), strlen($b)) : 0.0;

        return round(max($percent / 100 * 0.95, $jaccard * 0.95, $edit, $contained), 4);
    }

    /** The song name without anything in brackets: «Oceans (Where Feet May Fail)» → «Oceans». */
    public static function baseTitle(string $title): string
    {
        return trim(preg_replace('/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/u', '', self::cleanTitle($title)) ?? $title) ?: self::cleanTitle($title);
    }

    /** The best written of several spellings of the same name: mixed case before «BONITA» or «bonita». */
    public static function bestSpelling(array $spellings): ?string
    {
        $spellings = array_values(array_filter($spellings, fn ($spelling) => is_string($spelling) && trim($spelling) !== ''));
        foreach ($spellings as $spelling) {
            if (mb_strtoupper($spelling) !== $spelling && mb_strtolower($spelling) !== $spelling) {
                return $spelling;
            }
        }

        return $spellings[0] ?? null;
    }

    /**
     * Joins spellings of the same person («Averly Morillo», «Arely Morillo»): the most repeated,
     * or the known one, stays.
     *
     * @param  list<string>  $names  In order of preference, repeated as often as they were credited.
     * @param  callable(string): bool  $known
     * @return list<string>
     */
    public static function mergeSpellings(array $names, callable $known): array
    {
        $groups = [];
        foreach ($names as $name) {
            foreach ($groups as &$group) {
                if (self::similarity($group['names'][0], $name) >= 0.85 && ! ($known($group['names'][0]) && $known($name) && self::key($group['names'][0]) !== self::key($name))) {
                    $group['names'][] = $name;

                    continue 2;
                }
            }
            unset($group);
            $groups[] = ['names' => [$name]];
        }

        return array_map(function (array $group) use ($known) {
            $counts = array_count_values($group['names']);
            arsort($counts);
            foreach (array_keys($counts) as $name) {
                if ($known((string) $name)) {
                    return (string) $name;
                }
            }

            return (string) array_key_first($counts);
        }, $groups);
    }
}
