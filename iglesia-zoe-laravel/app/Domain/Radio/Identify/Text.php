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

    /** Notes that make another cut of a song: a remix, a sped-up or instrumental version, a performance track, another language… */
    private const CUTS = '/\b(remix|rmx|mix|reloaded|reimagined|re imagined|rework|redux|revisited|re recorded|rerecorded|re record|new version|nueva version|radio version|sped up|speed up|slowed|reverb|nightcore|8d|instrumental|pista|karaoke|backing track|performance track|playback|acoustic|acustico|unplugged|stripped|piano|demo|extended|edit|club|dub|cover|tribute|made popular|in the style of|spanish|english|portuguese|espanol|ingles|portugues|versao|lofi|lo fi|orchestral|sinfonico|symphonic|a cappella|acapella|session|sessions|medley|popurri|mashup|morning|evening|reprise|interlude|intro|outro|vip|bootleg)\b/';

    /** Endings of a social handle that are not part of the name: @uncorazonorg → «un corazon». */
    private const HANDLE_END = '/(oficial|official|org|music|musica|tv|band|banda|ministries|ministerio|channel|vevo|records|online)$/';

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
        $title = preg_replace('/(^|\s)@[\w.]+/u', ' ', $title) ?? $title;
        $title = preg_replace('/^\s*(?:(?:video\s*-?\s*lyrics?|lyrics?\s*-?\s*video|videolyrics?|lyricvideo|(?:official|oficial)\s+(?:music\s+)?(?:video|v[ií]deo|audio)|(?:video|v[ií]deo|audio)\s+(?:official|oficial)|estreno|premiere)\b[\s:|·.-]*)+/iu', '', $title) ?? $title;
        $title = preg_replace('/\s+(?:(?:official|oficial)\s+)?(?:music\s+)?(?:video|videoclip|v[ií]deo|audio|lyric video|lyrics?|letra|visualizer)(?:\s+(?:official|oficial))?\s*$/iu', '', $title) ?? $title;

        return trim(preg_replace('/\s+/u', ' ', $title) ?? $title, " \t\n\r\0\x0B-–—|·.");
    }

    /** Names credited as guests inside a song name: «Derramo el Perfume (feat. Averly Morillo) [Live]» → [Averly Morillo]. */
    public static function featuredIn(string $title, array $known = []): array
    {
        $title = self::withoutNoise($title);
        $names = [];
        if (preg_match_all('/[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]/iu', $title, $matches)) {
            foreach ($matches[1] as $credit) {
                $names = [...$names, ...self::splitNames($credit, $known)];
            }
        } elseif (preg_match('/\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/iu', $title, $match)) {
            $names = self::splitNames($match[1], $known);
        }

        return self::unique($names);
    }

    /**
     * Names after «con» or «with» in brackets. They may be people or another song of a medley
     * («Eterno (Con Cuando los Santos Marchen Ya)»), so they only count when something confirms them.
     *
     * @param  list<string>  $known
     * @return list<string>
     */
    public static function mentionedIn(string $title, array $known = []): array
    {
        $names = [];
        if (preg_match_all('/[\(\[]\s*(?:con|with)\s+([^\)\]]+)[\)\]]/iu', self::withoutNoise($title), $matches)) {
            foreach ($matches[1] as $credit) {
                $names = [...$names, ...self::splitNames($credit, $known)];
            }
        }

        return self::unique($names);
    }

    /** The song name without bracketed labels that are not credits: «… feat. X (Videoclip Oficial)» → «… feat. X». */
    private static function withoutNoise(string $title): string
    {
        return preg_replace_callback('/\s*[\(\[]([^\)\]]*)[\)\]]/u', fn ($match) => preg_match('/^\s*(feat|ft|featuring|con|with)\b/iu', $match[1]) || ! preg_match(self::NOISE, $match[1]) ? $match[0] : '', $title) ?? $title;
    }

    /**
     * The cuts a song name speaks of, in brackets or after a dash: «Oceans (Sped Up)» → [sped up].
     *
     * @return list<string>
     */
    public static function cuts(string $title): array
    {
        preg_match_all('/[\(\[\{]([^\)\]\}]*)[\)\]\}]/u', $title, $brackets);
        $dash = preg_match('/\s[-–—]\s(.+)$/u', $title, $match) ? $match[1] : '';
        preg_match_all(self::CUTS, self::key(implode(' ', [...$brackets[1], $dash])), $cuts);

        return array_values(array_unique($cuts[0]));
    }

    /** Whether a name is a social handle («@uncorazonorg»). */
    public static function isHandle(string $name): bool
    {
        return str_starts_with(trim($name), '@');
    }

    /** Whether a social handle belongs to a name: «@uncorazonorg» is «Un Corazón». */
    public static function handleOf(string $handle, string $name): bool
    {
        $handle = str_replace(' ', '', self::key($handle));
        $name = str_replace(' ', '', self::key($name));
        if ($handle === '' || strlen($name) < 3) {
            return false;
        }

        return $handle === $name || (str_starts_with($handle, $name) && preg_match(self::HANDLE_END, substr($handle, strlen($name))) === 1
            && preg_replace(self::HANDLE_END, '', substr($handle, strlen($name))) === '');
    }

    /**
     * The song name without the author written at its start or end: («Marcos Witt Gracias», «Marcos Witt») → «Gracias».
     * Null when the name does not start or end with the author, or nothing would be left.
     */
    public static function withoutName(string $title, string $name): ?string
    {
        $name = self::key($name);
        if ($name === '' || ! preg_match_all('/[\p{L}\p{N}]+/u', $title, $words, PREG_OFFSET_CAPTURE)) {
            return null;
        }
        foreach ($words[0] as [$word, $at]) {
            $end = $at + strlen($word);
            if (self::key(substr($title, 0, $end)) === $name) {
                $rest = trim(substr($title, $end), " \t-–—:|·.,");

                return self::key($rest) !== '' ? $rest : null;
            }
        }
        foreach (array_reverse($words[0]) as [, $at]) {
            if (self::key(substr($title, $at)) === $name) {
                $rest = trim(substr($title, 0, $at), " \t-–—:|·.,");

                return self::key($rest) !== '' ? $rest : null;
            }
        }

        return null;
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

    /** Whether a name speaks of a live recording; a studio version on a live album is not one. */
    public static function isLive(string $value): bool
    {
        $value = Str::ascii($value);

        return preg_match(self::LIVE, $value) === 1 && preg_match('/\b(studio|estudio)\b/i', $value) !== 1;
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

    /**
     * How alike two song names are, from 0 to 1. Stricter than similarity(): word order counts
     * («Tú eres» is not «Eres tú») and a name with more words is another song («Tú Eres Santo»),
     * unless the extra words are a subtitle in brackets («Oceans (Where Feet May Fail)»).
     */
    public static function titleSimilarity(string $title, string $asked): float
    {
        $a = self::key(self::cleanTitle($title));
        $b = self::key(self::cleanTitle($asked));
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }
        $baseA = self::key(self::baseTitle($title));
        if ($baseA !== '' && $baseA === self::key(self::baseTitle($asked))) {
            return 0.95;
        }
        similar_text($a, $b, $percent);
        $edit = strlen($a) <= 255 && strlen($b) <= 255 ? 1 - levenshtein($a, $b) / max(strlen($a), strlen($b)) : 0.0;
        $score = max($percent / 100 * 0.95, $edit);
        $short = strlen($a) < strlen($b) ? $a : $b;
        $long = $short === $a ? $b : $a;
        if (preg_match('/(^| )'.preg_quote($short, '/').'( |$)/', $long) === 1) {
            $score = min($score, 0.72);
        }

        return round($score, 4);
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
