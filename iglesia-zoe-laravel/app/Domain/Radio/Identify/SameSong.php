<?php

namespace App\Domain\Radio\Identify;

use App\Domain\Radio\Catalog\MusicCatalog;
use App\Models\RadioTrack;

/**
 * Tells whether two songs are the same one, the way a music librarian would: by the name without
 * labels, credits or version notes, the authors and co-authors (aliases of the catalog included),
 * the length, the album, the year and the codes the music databases gave the recording.
 *
 * The verdict is «misma» (the same recording: uploading it again duplicates it), «version» (the same
 * song in another cut: live, acoustic, remix, another recording) or «posible» (too alike to let it
 * pass unseen, too different to call it the same). Different songs get no verdict.
 */
final class SameSong
{
    public const SAME = 'misma';

    public const VERSION = 'version';

    public const MAYBE = 'posible';

    /** Seconds two copies of one recording may differ: encoders and trimmed silences. */
    private const SAME_LENGTH = 2.0;

    /** Up to here the difference may be a longer fade; beyond it, a video intro or another recording. */
    private const CLOSE_LENGTH = 5.0;

    /** Beyond this the lengths speak of another recording. */
    private const OTHER_LENGTH = 20.0;

    /** Name similarity from which two names are the same name written differently. */
    private const SAME_NAME = 0.9;

    /** Name similarity from which two names are worth a look. */
    private const CLOSE_NAME = 0.8;

    /** Cuts that are the same kind of version, under the words a listener reads. */
    private const CUT_GROUPS = [
        'en vivo' => ['live'],
        'un remix o una edición especial' => ['remix', 'rmx', 'mix', 'reloaded', 'rework', 'vip', 'bootleg', 'club', 'dub', 'extended', 'edit', 'radio version'],
        'una versión regrabada o reimaginada' => ['reimagined', 're imagined', 'redux', 'revisited', 're recorded', 'rerecorded', 're record', 'new version', 'nueva version'],
        'acelerada, lenta o lo-fi' => ['sped up', 'speed up', 'slowed', 'reverb', 'nightcore', '8d', 'lofi', 'lo fi'],
        'instrumental, pista o a capela' => ['instrumental', 'pista', 'karaoke', 'backing track', 'performance track', 'playback', 'a cappella', 'acapella'],
        'acústica' => ['acoustic', 'acustico', 'unplugged', 'stripped', 'piano', 'session', 'sessions'],
        'un cover' => ['cover', 'tribute', 'made popular', 'in the style of'],
        'en otro idioma' => ['spanish', 'english', 'portuguese', 'espanol', 'ingles', 'portugues', 'versao'],
        'sinfónica' => ['orchestral', 'sinfonico', 'symphonic'],
        'un popurrí' => ['medley', 'popurri', 'mashup'],
        'un demo' => ['demo'],
        'un reprise, intro o interludio' => ['morning', 'evening', 'reprise', 'interlude', 'intro', 'outro'],
    ];

    /** Codes of the music databases, by what they prove when two songs share them. */
    private const IDS = [
        'isrc' => 'mismo código ISRC',
        'musicbrainz' => 'misma grabación en MusicBrainz',
        'deezer' => 'misma grabación en Deezer',
        'itunes' => 'misma grabación en Apple Music',
    ];

    private const RANK = [self::SAME => 0, self::MAYBE => 1, self::VERSION => 2];

    /** Matches shown for each song, the most serious first. */
    private const MAX_MATCHES = 4;

    /**
     * The verdict on two songs, with the reasons that led to it; null when they are different songs.
     *
     * @param  array{title: string, artist?: ?string, featured?: ?list<string>, album?: ?string, year?: int|string|null, duration?: float|string|null, ids?: ?array<string, string>}  $song
     * @param  array{title: string, artist?: ?string, featured?: ?list<string>, album?: ?string, year?: int|string|null, duration?: float|string|null, ids?: ?array<string, string>}  $other
     * @return array{verdict: string, reasons: list<string>}|null
     */
    public static function verdict(array $song, array $other): ?array
    {
        return self::judge(self::facts($song), self::facts($other));
    }

    /**
     * Every song of an upload compared with the library and with the songs before it in the same upload.
     * With `$only`, just those songs are judged (the rest only count as the songs before them), so a long
     * upload asks again only for the songs that changed.
     *
     * @param  array<string, array{title: string, artist?: ?string, featured?: ?list<string>, album?: ?string, year?: int|string|null, duration?: float|string|null, ids?: ?array<string, string>}>  $songs  By the key the browser gave them, in upload order.
     * @param  iterable<RadioTrack>  $library
     * @param  list<string>|null  $only
     * @return array<string, list<array{verdict: string, reasons: list<string>, track?: array<string, mixed>, batch?: string}>>
     */
    public static function review(array $songs, iterable $library, ?array $only = null): array
    {
        $judged = $only === null ? null : array_flip($only);
        $tracks = [];
        foreach ($library as $track) {
            $tracks[] = [$track, self::facts(self::songOf($track))];
        }

        $results = [];
        $earlier = [];
        foreach ($songs as $key => $song) {
            $facts = self::facts($song);
            if ($judged !== null && ! isset($judged[(string) $key])) {
                $earlier[(string) $key] = $facts;

                continue;
            }
            $swapped = self::swapped($song);
            $matches = [];
            foreach ($tracks as [$track, $other]) {
                if ($verdict = self::judgeBothWays($facts, $swapped, $other)) {
                    $matches[] = [...$verdict, 'track' => self::brief($track)];
                }
            }
            foreach ($earlier as $earlierKey => $other) {
                if ($verdict = self::judgeBothWays($facts, $swapped, $other)) {
                    $matches[] = [...$verdict, 'batch' => (string) $earlierKey];
                }
            }
            usort($matches, fn (array $a, array $b) => self::RANK[$a['verdict']] <=> self::RANK[$b['verdict']]);
            $results[(string) $key] = array_slice($matches, 0, self::MAX_MATCHES);
            $earlier[(string) $key] = $facts;
        }

        return $results;
    }

    /**
     * The song of the library an upload would duplicate, or null.
     *
     * @param  array{title: string, artist?: ?string, featured?: ?list<string>, album?: ?string, year?: int|string|null, duration?: float|string|null, ids?: ?array<string, string>}  $song
     * @param  iterable<RadioTrack>  $library
     */
    public static function twinIn(array $song, iterable $library): ?RadioTrack
    {
        $facts = self::facts($song);
        $swapped = self::swapped($song);
        foreach ($library as $track) {
            if ((self::judgeBothWays($facts, $swapped, self::facts(self::songOf($track)))['verdict'] ?? null) === self::SAME) {
                return $track;
            }
        }

        return null;
    }

    /**
     * The song read with its name and author the other way round, as file names often come
     * («Supe Que Me Amabas - Marcela Gándara»); null when it names no author.
     *
     * @param  array<string, mixed>  $song
     * @return array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}|null
     */
    private static function swapped(array $song): ?array
    {
        $artist = trim((string) ($song['artist'] ?? ''));

        return $artist === '' ? null : self::facts([...$song, 'title' => $artist, 'artist' => (string) ($song['title'] ?? ''), 'featured' => []]);
    }

    /**
     * The verdict as the song was written, or as read the other way round when that makes it the same
     * song (or a possible duplicate) of the other one; another version read backwards is not worth a word.
     *
     * @param  array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}  $facts
     * @param  array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}|null  $swapped
     * @param  array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}  $other
     * @return array{verdict: string, reasons: list<string>}|null
     */
    private static function judgeBothWays(array $facts, ?array $swapped, array $other): ?array
    {
        $verdict = self::judge($facts, $other);
        if ($swapped === null || ($verdict['verdict'] ?? null) === self::SAME) {
            return $verdict;
        }
        $reversed = self::judge($swapped, $other);
        if (! $reversed || $reversed['verdict'] === self::VERSION || ($verdict && self::RANK[$verdict['verdict']] <= self::RANK[$reversed['verdict']])) {
            return $verdict;
        }

        return ['verdict' => $reversed['verdict'], 'reasons' => ['nombre y autor al revés', ...$reversed['reasons']]];
    }

    /**
     * @return array{title: string, artist: ?string, featured: list<string>, album: ?string, year: ?int, duration: ?float, ids: array<string, string>}
     */
    private static function songOf(RadioTrack $track): array
    {
        return [
            'title' => $track->title,
            'artist' => $track->artist,
            'featured' => $track->featured ?? [],
            'album' => $track->album,
            'year' => $track->year,
            'duration' => $track->duration,
            'ids' => (array) ($track->identity['ids'] ?? []),
        ];
    }

    /** @return array<string, mixed> */
    private static function brief(RadioTrack $track): array
    {
        return [
            'id' => $track->id,
            'title' => $track->title,
            'artist' => $track->credit(),
            'album' => $track->album,
            'year' => $track->year,
            'duration' => $track->duration,
            'genres' => $track->genres->pluck('name')->all(),
            'cover' => $track->cover_path,
            'src' => $track->file_path,
        ];
    }

    /**
     * What is compared of a song, read once.
     *
     * @param  array<string, mixed>  $song
     * @return array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}
     */
    private static function facts(array $song): array
    {
        $title = trim(preg_replace('/^\s*\d{1,3}\s*[-.)]\s+/u', '', (string) ($song['title'] ?? '')) ?? '');
        preg_match_all('/\d+/', Text::key(Text::cleanTitle($title)), $numbers);
        $credited = Text::splitNames(trim((string) ($song['artist'] ?? '')), MusicCatalog::joinedNames());
        $names = [];
        foreach ([...$credited, ...array_filter((array) ($song['featured'] ?? []), 'is_string')] as $name) {
            $names[] = Text::key(MusicCatalog::artist($name)->name ?? $name);
        }
        $albumName = trim((string) ($song['album'] ?? ''));
        $album = $albumName !== '' ? Text::albumKey($albumName) : '';
        if ($album === Text::key(Text::baseTitle($title))) {
            $album = '';
        }
        $year = is_numeric($song['year'] ?? null) ? (int) $song['year'] : null;
        $duration = is_numeric($song['duration'] ?? null) && (float) $song['duration'] > 0 ? (float) $song['duration'] : null;
        $ids = [];
        foreach ((array) ($song['ids'] ?? []) as $source => $id) {
            if (isset(self::IDS[$source]) && is_scalar($id) && (string) $id !== '') {
                $ids[$source] = strtoupper((string) $id);
            }
        }

        return [
            'title' => $title,
            'numbers' => collect($numbers[0])->map(fn (string $number) => (int) $number)->unique()->sort()->values()->all(),
            'lead' => $credited[0] ?? '',
            'names' => array_values(array_unique(array_filter($names))),
            'album' => $album,
            'albumName' => $albumName,
            'year' => $year && $year >= 1900 ? $year : null,
            'duration' => $duration,
            'cuts' => self::cuts($title, $albumName),
            'ids' => $ids,
        ];
    }

    /**
     * The kinds of version a song is, by the words of its name and album: «Oceans (Live)» → [en vivo];
     * a studio version on a live album is not live.
     *
     * @return list<string>
     */
    private static function cuts(string $title, string $album): array
    {
        $words = Text::cuts($title);
        if (Text::isLive(trim($title.' '.$album))) {
            $words[] = 'live';
        }
        $groups = [];
        foreach ($words as $word) {
            $group = collect(self::CUT_GROUPS)->search(fn (array $members) => in_array($word, $members, true));
            $groups[] = $group === false ? $word : $group;
        }

        return array_values(array_unique($groups));
    }

    /**
     * @param  array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}  $a
     * @param  array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}  $b
     * @return array{verdict: string, reasons: list<string>}|null
     */
    private static function judge(array $a, array $b): ?array
    {
        if ($a['title'] === '' || $b['title'] === '') {
            return null;
        }
        $shared = array_keys(array_intersect_assoc($a['ids'], $b['ids']));
        $name = self::nameScore($a, $b);
        if ($shared === [] && ($name < self::CLOSE_NAME || $a['numbers'] !== $b['numbers'])) {
            return null;
        }

        $authors = self::authors($a, $b);
        $gap = $a['duration'] !== null && $b['duration'] !== null ? abs($a['duration'] - $b['duration']) : null;
        $cuts = array_values(array_diff([...$a['cuts'], ...$b['cuts']], array_intersect($a['cuts'], $b['cuts'])));
        $album = $a['album'] === '' || $b['album'] === '' ? null : $a['album'] === $b['album'];
        $year = $a['year'] === null || $b['year'] === null ? null : $a['year'] === $b['year'];

        $verdict = match (true) {
            $shared !== [] => $cuts === [] ? self::SAME : self::MAYBE,
            $name < self::SAME_NAME => $authors === true && $cuts === [] && $gap !== null && $gap <= self::SAME_LENGTH ? self::MAYBE : null,
            $authors === false => $gap !== null && $gap <= 1.0 && $cuts === [] ? self::MAYBE : null,
            $cuts !== [] => $gap !== null && $gap <= 1.5 ? self::MAYBE : self::VERSION,
            $gap === null => $album === false && $year === false ? self::VERSION : self::SAME,
            $gap <= self::SAME_LENGTH => self::SAME,
            $gap <= self::CLOSE_LENGTH => match (true) {
                $album === true || ($year === true && $album !== false) => self::SAME,
                $album === false && $year === false => self::VERSION,
                default => self::MAYBE,
            },
            $gap <= self::OTHER_LENGTH => $album === false || $year === false ? self::VERSION : self::MAYBE,
            default => self::VERSION,
        };
        if ($verdict === null) {
            return null;
        }

        return ['verdict' => $verdict, 'reasons' => self::reasons($a, $b, $shared, $name, $authors, $gap, $cuts, $album, $year)];
    }

    /** How alike the names are, also when one of them carries the author: («Marcos Witt Gracias», «Gracias»). */
    private static function nameScore(array $a, array $b): float
    {
        $score = Text::titleSimilarity($a['title'], $b['title']);
        foreach ([[$a, $b], [$b, $a]] as [$song, $other]) {
            $rest = $other['lead'] !== '' ? Text::withoutName($song['title'], $other['lead']) : null;
            if ($rest !== null) {
                $score = max($score, Text::titleSimilarity($rest, $other['title']));
            }
        }

        return $score;
    }

    /** True when they share an author or co-author, false when both name theirs and none match, null when one names none. */
    private static function authors(array $a, array $b): ?bool
    {
        if ($a['names'] === [] || $b['names'] === []) {
            return null;
        }
        if (array_intersect($a['names'], $b['names']) !== []) {
            return true;
        }

        return Text::similarity($a['names'][0], $b['names'][0]) >= 0.88;
    }

    /**
     * What the verdict rests on, in the words of the admin.
     *
     * @param  list<string>  $shared
     * @param  list<string>  $cuts
     * @return list<string>
     */
    private static function reasons(array $a, array $b, array $shared, float $name, ?bool $authors, ?float $gap, array $cuts, ?bool $album, ?bool $year): array
    {
        $reasons = array_map(fn (string $source) => self::IDS[$source], $shared);
        $reasons[] = match (true) {
            $name >= 0.999 => 'mismo nombre',
            $name >= self::SAME_NAME => 'mismo nombre, escrito distinto',
            $name >= self::CLOSE_NAME => 'nombre parecido',
            default => 'otro nombre',
        };
        if ($authors !== null) {
            $reasons[] = $authors ? 'mismo autor' : 'otro autor';
        }
        if ($gap !== null) {
            $reasons[] = match (true) {
                $gap <= 0.5 => 'misma duración ('.self::clock($a['duration']).')',
                $gap <= self::SAME_LENGTH => 'duración casi igual ('.self::clock($a['duration']).' y '.self::clock($b['duration']).')',
                default => 'duración distinta ('.self::clock($a['duration']).' y '.self::clock($b['duration']).')',
            };
        }
        if ($album !== null) {
            $reasons[] = $album ? 'mismo álbum' : 'otro álbum («'.$a['albumName'].'» y «'.$b['albumName'].'»)';
        }
        if ($year !== null) {
            $reasons[] = $year ? 'mismo año ('.$a['year'].')' : 'otro año ('.$a['year'].' y '.$b['year'].')';
        }
        foreach ($cuts as $cut) {
            $reasons[] = 'solo una es '.$cut;
        }

        return $reasons;
    }

    private static function clock(?float $seconds): string
    {
        $seconds = (int) round((float) $seconds);

        return intdiv($seconds, 60).':'.str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
    }
}
