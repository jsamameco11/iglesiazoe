<?php

namespace App\Domain\Radio\Identify;

use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Sources\Deezer;
use App\Domain\Radio\Identify\Sources\ITunes;
use App\Domain\Radio\Identify\Sources\MusicBrainz;
use App\Domain\Radio\Identify\Sources\Wikidata;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use Generator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Identifies a song on the internet from its name, author and length: who sings it and with whom,
 * the album it belongs to, its year, its cover and its genres.
 *
 * It asks iTunes, Deezer and MusicBrainz in several ways until two of them agree on the same
 * recording. Other cuts of the song (remixes, sped-up, instrumental or acoustic versions,
 * performance tracks) and songs with more words in their name never count as the song. The album
 * is only given when it is certain: two databases agree on it for a version of the same length,
 * MusicBrainz has it with the exact length, or the song is on a single album; singles and
 * compilations never count, nor an EP named after the song when the recording is on an album. A co-author is only given when the user wrote it or most databases
 * that have the recording credit it. Genres come from the artist catalog and the tags of every
 * database, in Spanish.
 */
final class Identifier
{
    /** A version is the song from this score on (0 to 1). */
    private const MATCH = 0.75;

    /** A version's name must be at least this alike to the song's. */
    private const SAME_TITLE = 0.8;

    /** No more ways are tried once a version scores this and two databases agree. */
    private const SURE = 0.86;

    /** Seconds a version may differ from the file and still be the same recording. */
    private const SAME_LENGTH = 4.0;

    /** Seconds within which the length is exact. */
    private const EXACT_LENGTH = 2.0;

    /** Albums of other cuts of the songs: karaoke, instrumentals, performance tracks, remixes. */
    private const CUT_ALBUM = '/\b(instrumental|instrumentales|instrumentals|pistas?|karaoke|performance tracks?|backing tracks?|playback|made popular|in the style of|tribute|tributo|remix|remixes|sped up|slowed|lofi|lo fi|piano)\b/';


    private const CACHE = 'radio-identify:v3:';

    public function __construct(
        private readonly ITunes $iTunes,
        private readonly Deezer $deezer,
        private readonly MusicBrainz $musicBrainz,
        private readonly Wikidata $wikidata,
    ) {}

    /**
     * Every song comes out with at least one genre: when nothing confirms one, the radio's general genre
     * goes, and `guessed` says which fields are a best guess to review (genres, year).
     *
     * @param  string|null  $fileGenre  Genre written in the file's tags.
     * @return array{
     *     found: bool, confidence: ?string, sources: list<string>, title: ?string, artist: ?string,
     *     featured: list<string>, album: ?string, year: ?int, cover_url: ?string,
     *     genres: list<array{id: string, name: string, family: string}>, guessed: list<string>,
     *     artist_info: array{name: ?string, kind: ?string, country: ?string, known: bool, convert: bool, musicbrainz_id: ?string},
     *     identity: array<string, mixed>
     * }
     */
    public function identify(SongQuery $query, ?string $fileGenre = null): array
    {
        $first = null;
        foreach ($this->readings($query) as $reading) {
            $found = $this->found($reading);
            if ($found['found']) {
                return $this->classify($reading, $found, $fileGenre);
            }
            $first ??= [$reading, $found];
        }
        [$reading, $found] = $first ?? [$query, ['found' => false]];

        return $this->classify($reading, $found, $fileGenre);
    }

    /**
     * Ways to read the song: as it came; or, when it came without author, with the author written
     * in its name («Marcos Witt Gracias Tu Fidelidad») taken out: a known artist first, then an
     * artist a database credits for the rest of the name.
     *
     * @return Generator<int, SongQuery>
     */
    private function readings(SongQuery $query): Generator
    {
        if ($query->artist !== '') {
            yield $query;

            return;
        }
        $tried = [];
        if ($edge = MusicCatalog::artistAtEdge($query->title)) {
            $tried[Text::key($edge[0]->name)] = true;
            yield $query->withArtist($edge[0]->name, $edge[1]);
        }
        yield $query;
        $known = MusicCatalog::joinedNames();
        foreach ([...$this->iTunes->search($query->title, $known), ...$this->deezer->search($query->title, $known)] as $candidate) {
            foreach ([$candidate->artist, ...$candidate->partners] as $name) {
                $rest = Text::withoutName($query->title, $name);
                if ($rest !== null && ! isset($tried[Text::key($name)]) && Text::titleSimilarity($candidate->title, $rest) >= self::SAME_TITLE) {
                    $tried[Text::key($name)] = true;
                    yield $query->withArtist(MusicCatalog::artist($name)?->name ?? $name, $rest);
                }
            }
        }
    }

    /** What the internet says of a reading of the song, kept for a while. */
    private function found(SongQuery $query): array
    {
        $key = self::CACHE.$query->cacheKey();
        $found = Cache::get($key);
        if (! is_array($found)) {
            $found = $this->research($query);
            Cache::put($key, $found, $found['found'] ? now()->addDays(30) : now()->addHours(6));
        }

        return $found;
    }

    /** What the internet says of the song, before it is classified with the catalog. */
    private function research(SongQuery $query): array
    {
        if ($query->title === '') {
            return ['found' => false];
        }
        $known = MusicCatalog::joinedNames();
        $title = $query->title;
        $artist = $query->artist;
        $plan = $artist !== '' ? [
            fn () => [...$this->iTunes->search("{$artist} {$title}", $known), ...$this->deezer->search("{$artist} {$title}", $known), ...$this->musicBrainz->search($title, $artist)],
            fn () => [...$this->deezer->search('artist:"'.$artist.'" track:"'.$title.'"', $known), ...$this->iTunes->search($title, $known), ...$this->musicBrainz->search($title, $artist, MusicBrainz::LOOSE)],
            fn () => [...$this->deezer->search($title, $known), ...$this->musicBrainz->search($title, '', MusicBrainz::TITLE)],
        ] : [
            fn () => [...$this->iTunes->search($title, $known), ...$this->deezer->search($title, $known), ...$this->musicBrainz->search($title, '', MusicBrainz::TITLE)],
        ];

        $candidates = [];
        foreach ($plan as $step) {
            foreach ($step() as $candidate) {
                $this->score($candidate, $query);
                $candidates[$candidate->source.'|'.$candidate->id.'|'.$candidate->albumId.'|'.Text::key($candidate->album).'|'.$candidate->albumTracks] ??= $candidate;
            }
            $matched = $this->matched($candidates, $query);
            if ($matched && $matched[0]->score >= self::SURE && count(self::sources($matched)) >= 2) {
                break;
            }
        }

        $matched = $this->matched($candidates, $query);
        if (! $matched) {
            return ['found' => false];
        }
        $best = $matched[0];
        $matched = array_values(array_filter($matched, fn (Candidate $candidate) => Text::similarity($candidate->artist, $best->artist) >= 0.85
            || ($artist !== '' && Text::similarity($candidate->artist, $artist) >= 0.85)));
        $isLive = fn (Candidate $candidate) => Text::isLive($candidate->title.' '.($candidate->album ?? ''));
        $this->completeAlbums($matched);
        if (! $query->live && $isLive($best)) {
            $best = collect($matched)->first(fn (Candidate $candidate) => ! $isLive($candidate) && $candidate->score >= $best->score - 0.05) ?? $best;
        }
        if ($best->albumType === Candidate::COMPILATION) {
            $best = collect($matched)->first(fn (Candidate $candidate) => $candidate->onAlbum() && $candidate->score >= $best->score - 0.05) ?? $best;
        }
        $cut = fn (Candidate $candidate) => [$isLive($candidate), Text::cuts($candidate->title)];
        $same = array_values(array_filter($matched, fn (Candidate $candidate) => $cut($candidate) == $cut($best)
            && (! $query->duration || ($gap = $candidate->gap($query->duration)) === null || $gap <= self::SAME_LENGTH)));

        $versions = $same ?: $matched;
        $this->completeAlbums($versions);
        $album = $this->album($same, $query->duration);
        $songYear = $album['year'] ?? ($query->duration ? $this->album(array_values(array_filter($matched, fn (Candidate $candidate) => $cut($candidate) == $cut($best))), null)['first_year'] ?? null : null);
        $recording = self::onePerSource($album['candidates'] ?? $this->recording($versions, $best));
        if ($deezer = collect($recording)->first(fn (Candidate $candidate) => $candidate->source === Deezer::NAME)) {
            $this->deezer->completeCredits($deezer);
        }

        $author = $best->artist;
        $before = [];
        if ($artist !== '' && Text::similarity($author, $artist) < 0.86) {
            $partner = collect($recording)->flatMap(fn (Candidate $candidate) => $candidate->partners)
                ->first(fn (string $name) => Text::similarity($name, $artist) >= 0.86);
            if ($partner) {
                $before[] = $author;
                $author = $partner;
            }
        }
        $artistName = MusicCatalog::artist($author)?->name ?? $author;
        $featured = $this->credits($recording, $query, $artistName, $before);

        $tags = [];
        foreach ($versions as $candidate) {
            foreach ($candidate->tags as $tag) {
                $tags[$candidate->source.':'.Text::key($tag[0])] = $tag;
            }
        }
        $sources = self::sources($matched);
        $info = ['kind' => null, 'country' => null, 'musicbrainz_id' => null];
        $mbArtist = collect($matched)->first(fn (Candidate $candidate) => $candidate->source === MusicBrainz::NAME && $candidate->artistId && Text::similarity($candidate->artist, $author) >= 0.85);
        $info['musicbrainz_id'] = $mbArtist?->artistId;
        $catalog = MusicCatalog::artist($artistName);
        if (! $catalog || ! $catalog->genres()->exists()) {
            if ($mbArtist && ($details = $this->musicBrainz->artist($mbArtist->artistId))) {
                $info['kind'] = $details['kind'];
                $info['country'] = $details['country'];
                foreach ($details['tags'] as $tag) {
                    $tags['musicbrainz-artist:'.Text::key($tag[0])] = $tag;
                }
            }
            if ($details = $this->wikidata->artist($artistName)) {
                $info['kind'] ??= $details['kind'];
                foreach ($details['tags'] as $tag) {
                    $tags['wikidata:'.Text::key($tag[0])] = $tag;
                }
                $sources[] = Wikidata::NAME;
            }
        }

        $confidence = match (true) {
            $best->score >= 0.88 && count(self::sources($matched)) >= 2 => 'alta',
            $best->score >= 0.8 => 'media',
            default => 'baja',
        };
        $first = fn (string $source) => collect($recording)->first(fn (Candidate $candidate) => $candidate->source === $source)
            ?? collect($matched)->first(fn (Candidate $candidate) => $candidate->source === $source);
        $year = $songYear ?? $this->year($versions);
        $likelyYear = $year === null ? $this->likelyYear($same ?: $versions, $query->duration) : null;

        return [
            'found' => true,
            'score' => round($best->score, 3),
            'confidence' => $confidence,
            'sources' => $sources,
            'title' => Text::bestSpelling([
                ...collect($recording)->sortBy(fn (Candidate $candidate) => array_search($candidate->source, [MusicBrainz::NAME, ITunes::NAME, Deezer::NAME], true))
                    ->map(fn (Candidate $candidate) => Text::cleanTitle($candidate->title))
                    ->filter(fn (string $title) => Text::key($title) === Text::key(Text::cleanTitle($best->title)))->all(),
                $query->title,
            ]) ?? $best->title,
            'artist' => $artistName,
            'featured' => array_slice($featured, 0, RadioTrack::MAX_FEATURED),
            'album' => $album['name'] ?? null,
            'year' => $year ?? $likelyYear,
            'guessed' => $likelyYear !== null ? ['year'] : [],
            'cover' => $album['cover'] ?? $this->cover($recording),
            'tags' => array_values($tags),
            'artist_info' => $info,
            'ids' => array_filter([
                'musicbrainz' => $first(MusicBrainz::NAME)?->id,
                'deezer' => $first(Deezer::NAME)?->id,
                'itunes' => $first(ITunes::NAME)?->id,
                'isrc' => $first(Deezer::NAME)?->isrc,
            ]),
        ];
    }

    /**
     * How well a version matches: name 50 %, author 35 %, length 15 %. Another cut of the song
     * (a remix when the song was asked) falls below the name needed; guests the song was not asked
     * with, or a cut asked for that the version lacks, take a little off.
     */
    private function score(Candidate $candidate, SongQuery $query): void
    {
        $title = Text::titleSimilarity($candidate->title, $query->title);
        $cuts = Text::cuts($candidate->title);
        $otherCut = array_diff($cuts, $query->cuts) !== []
            || ($query->cuts === [] && $candidate->album && preg_match(self::CUT_ALBUM, Text::key($candidate->album)));
        $candidate->titleScore = $otherCut ? min($title, self::SAME_TITLE - 0.02) : $title;
        $missing = array_diff($query->cuts, $cuts) !== [] ? 0.15 : 0.0;
        $guests = array_filter(
            [...Text::featuredIn($candidate->title), ...Text::mentionedIn($candidate->title)],
            fn (string $name) => ! collect($query->names())->contains(fn (string $asked) => Text::similarity($asked, $name) >= 0.85),
        );
        $penalty = $missing + 0.01 * min(3, count($guests));

        $gap = $candidate->gap($query->duration);
        $length = match (true) {
            $gap === null => 0.6,
            $gap <= self::EXACT_LENGTH => 1.0,
            $gap <= 5 => 0.85,
            $gap <= 12 => 0.5,
            default => 0.15,
        };
        $live = match (true) {
            $query->live === Text::isLive($candidate->title.' '.($candidate->album ?? '')) => 0.0,
            $query->live => -0.1,
            default => -0.03,
        };

        if ($query->artist === '') {
            $candidate->artistScore = 0.0;
            $candidate->score = round(0.7 * $candidate->titleScore + 0.3 * $length + $live - $penalty, 4);

            return;
        }
        $asMain = max(array_map(fn (string $name) => Text::similarity($candidate->artist, $name), $query->names()));
        $credited = max(array_map(fn (string $name) => Text::similarity($name, $query->artist), [$candidate->artist, ...$candidate->featured]));
        $candidate->artistScore = max(Text::similarity($candidate->artist, $query->artist), 0.85 * $credited, 0.8 * $asMain);
        $candidate->score = round(0.5 * $candidate->titleScore + 0.35 * $candidate->artistScore + 0.15 * $length + $live - $penalty, 4);
    }

    /**
     * Versions that are the song, best first; a Christian version leads one of another artist that scores
     * just as well, and on a tie albums go before singles and compilations.
     *
     * @param  array<string, Candidate>  $candidates
     * @return list<Candidate>
     */
    private function matched(array $candidates, SongQuery $query): array
    {
        $matched = array_values(array_filter($candidates, function (Candidate $candidate) use ($query) {
            if ($candidate->score < self::MATCH || $candidate->titleScore < self::SAME_TITLE) {
                return false;
            }
            if ($query->artist === '') {
                $gap = $candidate->gap($query->duration);

                return $gap !== null && $gap <= self::SAME_LENGTH;
            }

            return $candidate->artistScore >= 0.75;
        }));
        usort($matched, fn (Candidate $a, Candidate $b) => [$b->score + self::christianLead($b), self::rank($b)] <=> [$a->score + self::christianLead($a), self::rank($a)]);

        return $matched;
    }

    /** The lead of a version of Christian music on this church radio: its artist is in the catalog, or a database files it under a Christian genre. */
    private static function christianLead(Candidate $candidate): float
    {
        $artist = MusicCatalog::artist($candidate->artist);
        if ($artist && ! $artist->convert) {
            return 0.03;
        }
        foreach ($candidate->tags as [$names]) {
            foreach (explode('||', (string) $names) as $name) {
                if (MusicCatalog::genre($name)?->family === 'cristiana') {
                    return 0.03;
                }
            }
        }

        return 0.0;
    }

    /** Asks Deezer what kind of release each version is on (album, EP, single or compilation), best versions first. @param list<Candidate> $versions */
    private function completeAlbums(array $versions): void
    {
        $deezer = array_values(array_filter($versions, fn (Candidate $candidate) => $candidate->source === Deezer::NAME));
        collect($deezer)->unique('albumId')->take(6)->each(fn (Candidate $candidate) => $this->deezer->completeAlbum($candidate));
        foreach ($deezer as $candidate) {
            if ($candidate->albumType === null && ($twin = collect($deezer)->first(fn (Candidate $other) => $other->albumId === $candidate->albumId && $other->albumType !== null))) {
                $candidate->albumType = $twin->albumType;
                $candidate->albumTracks = $twin->albumTracks;
                $candidate->year = $twin->year;
                $candidate->tags = $twin->tags;
            }
        }
    }

    /**
     * The versions that are the very recording of the best match (same release), whose credits count.
     *
     * @param  list<Candidate>  $versions
     * @return list<Candidate>
     */
    private function recording(array $versions, Candidate $best): array
    {
        $reference = collect($versions)->first(fn (Candidate $candidate) => $candidate->albumType !== Candidate::COMPILATION) ?? $best;
        $release = $reference->album ? Text::albumKey($reference->album) : '';
        $same = $release === '' ? [] : array_values(array_filter($versions, fn (Candidate $candidate) => $candidate->album && Text::albumKey($candidate->album) === $release));

        return $same ?: [$reference];
    }

    /**
     * The best version of each database, so the deluxe edition's duet with someone else does not
     * lend its credits to the song.
     *
     * @param  list<Candidate>  $versions  Best first.
     * @return list<Candidate>
     */
    private static function onePerSource(array $versions): array
    {
        $chosen = [];
        foreach ($versions as $candidate) {
            $chosen[$candidate->source] ??= $candidate;
        }

        return array_values($chosen);
    }

    /**
     * Co-authors of the recording: those the user wrote, and those credited by most of the databases
     * that have it. A name after «con» or «with» only counts when a database credits it as an artist
     * or the catalog knows it; a social handle takes the name of whoever it belongs to.
     *
     * @param  list<Candidate>  $recording  One version per database.
     * @param  list<string>  $before  Credited names that go first.
     * @return list<string>
     */
    private function credits(array $recording, SongQuery $query, string $artist, array $before): array
    {
        $artists = collect($recording)->flatMap(fn (Candidate $candidate) => [$candidate->artist, ...$candidate->partners, ...$candidate->featured]);
        $groups = [];
        foreach ($recording as $candidate) {
            $names = $candidate->featured;
            foreach ($candidate->mentioned as $name) {
                if (MusicCatalog::artist($name) || $artists->contains(fn (string $credited) => Text::similarity($credited, $name) >= 0.85)) {
                    $names[] = $name;
                }
            }
            foreach (Text::unique($names) as $name) {
                foreach ($groups as &$group) {
                    if (Text::similarity($group['names'][0], $name) >= 0.85) {
                        $group['names'][] = $name;
                        $group['sources'][$candidate->source] = true;

                        continue 2;
                    }
                }
                unset($group);
                $groups[] = ['names' => [$name], 'sources' => [$candidate->source => true]];
            }
        }
        unset($group);
        $spelling = function (array $names): string {
            foreach ($names as $name) {
                if ($known = MusicCatalog::artist($name)) {
                    return $known->name;
                }
            }
            $counts = array_count_values($names);
            arsort($counts);
            $top = array_keys($counts, reset($counts), true);

            return (string) Text::bestSpelling(array_map('strval', $top));
        };

        $needed = min(2, count(self::sources($recording)));
        $names = $before;
        foreach ($query->featured as $name) {
            $group = collect($groups)->first(fn (array $group) => Text::similarity($group['names'][0], $name) >= 0.85);
            $names[] = $group ? $spelling($group['names']) : (MusicCatalog::artist($name)?->name ?? $name);
        }
        foreach ($query->handles as $handle) {
            $group = collect($groups)->first(fn (array $group) => collect($group['names'])->contains(fn (string $name) => Text::handleOf($handle, $name)));
            if ($group) {
                $names[] = $spelling($group['names']);
            }
        }
        foreach ($groups as $group) {
            if (count($group['sources']) >= $needed) {
                $names[] = $spelling($group['names']);
            }
        }

        return array_values(array_filter(
            Text::mergeSpellings(Text::unique($names), fn (string $name) => MusicCatalog::artist($name) !== null),
            fn (string $name) => Text::similarity($name, $artist) < 0.86,
        ));
    }

    /**
     * The album the song belongs to, only when it is certain.
     *
     * @param  list<Candidate>  $same  Versions of the same length as the file.
     * @return array{name: string, year: ?int, first_year: ?int, cover: ?string, candidates: list<Candidate>}|null
     */
    private function album(array $same, ?float $duration): ?array
    {
        $groups = [];
        $onFullAlbum = collect($same)->contains(fn (Candidate $candidate) => $candidate->albumType === Candidate::ALBUM);
        foreach ($same as $candidate) {
            $isAlbum = $candidate->onAlbum() || ($candidate->albumType === null && $candidate->album && ($candidate->albumTracks ?? 0) >= 5);
            $key = $isAlbum ? Text::albumKey((string) $candidate->album) : '';
            if ($onFullAlbum && $candidate->albumType === Candidate::EP && in_array($key, [Text::key(Text::cleanTitle($candidate->title)), Text::key(Text::baseTitle($candidate->title))], true)) {
                continue;
            }
            if ($key === '') {
                continue;
            }
            $groups[$key] ??= ['sources' => [], 'years' => [], 'exact' => false, 'candidates' => []];
            $groups[$key]['sources'][$candidate->source] = true;
            $groups[$key]['years'][] = $candidate->year;
            $groups[$key]['candidates'][] = $candidate;
            $gap = $candidate->gap($duration);
            $groups[$key]['exact'] = $groups[$key]['exact'] || ($gap !== null && $gap <= self::EXACT_LENGTH);
        }
        $paired = count(array_filter($groups, fn (array $group) => count($group['sources']) >= 2));
        $certain = array_filter($groups, fn (array $group) => $duration
            ? count($group['sources']) >= 2 || (isset($group['sources'][MusicBrainz::NAME]) && $group['exact'])
            : count($group['sources']) >= 3 || ($paired === 1 && count($group['sources']) >= 2));
        if (! $certain) {
            return null;
        }
        uasort($certain, fn (array $a, array $b) => [count($b['sources']), $b['exact'], self::earliest($a['years']) ?? 9999]
            <=> [count($a['sources']), $a['exact'], self::earliest($b['years']) ?? 9999]);
        $group = reset($certain);
        $plain = (string) key($certain);
        $bySource = collect($group['candidates'])->sortBy(fn (Candidate $candidate) => array_search($candidate->source, [ITunes::NAME, Deezer::NAME, MusicBrainz::NAME], true));
        $name = $bySource->first(fn (Candidate $candidate) => Text::key($candidate->album) === $plain)?->album ?? $bySource->first()->album;

        return [
            'name' => (string) $name,
            'year' => self::albumYear($group['candidates'], $plain),
            'first_year' => self::earliest(array_map(fn (array $certainGroup, string $key) => self::albumYear($certainGroup['candidates'], $key), $certain, array_keys($certain))),
            'cover' => $this->cover($group['candidates']),
            'candidates' => $group['candidates'],
        ];
    }

    /**
     * Year the album came out, from its original edition (the one named plainly, with the fewest
     * songs; deluxe ones come later): the earliest date MusicBrainz, curated by people, gives;
     * otherwise the earliest the stores give, since Deezer's may be when it was delivered again.
     *
     * @param  list<Candidate>  $candidates
     */
    private static function albumYear(array $candidates, string $plain): ?int
    {
        $dated = array_filter($candidates, fn (Candidate $candidate) => $candidate->year !== null);
        $editions = array_filter($dated, fn (Candidate $candidate) => Text::key($candidate->album) === $plain) ?: $dated;
        $fewest = collect($editions)->pluck('albumTracks')->filter()->min();
        $editions = $fewest ? array_filter($editions, fn (Candidate $candidate) => $candidate->albumTracks === $fewest) : $editions;
        $curated = array_filter($editions, fn (Candidate $candidate) => $candidate->source === MusicBrainz::NAME);

        return self::earliest(array_map(fn (Candidate $candidate) => $candidate->year, $curated))
            ?? self::earliest(array_map(fn (Candidate $candidate) => $candidate->year, $editions));
    }

    /**
     * Year of the song when it is on no certain album: the earliest one two databases confirm
     * (a year apart at most), so re-releases do not hide it and one stray date does not make it.
     *
     * @param  list<Candidate>  $versions
     */
    private function year(array $versions): ?int
    {
        $years = collect($versions)
            ->filter(fn (Candidate $candidate) => $candidate->year && $candidate->albumType !== Candidate::COMPILATION)
            ->groupBy('source')->map(fn (Collection $list) => $list->pluck('year')->unique()->all());

        foreach ($years->flatten()->unique()->sort() as $year) {
            $confirmed = $years->filter(fn (array $list) => collect($list)->contains(fn (int $other) => $other >= $year && $other <= $year + 1));
            if ($confirmed->count() >= 2) {
                return (int) $year;
            }
        }

        return null;
    }

    /**
     * Year of the recording when no two databases agree on one: the earliest a database gives for this very
     * recording (the same length, not a compilation), MusicBrainz's first. A best guess, to review.
     *
     * @param  list<Candidate>  $versions
     */
    private function likelyYear(array $versions, ?float $duration): ?int
    {
        $exact = array_filter($versions, fn (Candidate $candidate) => $candidate->year && $candidate->albumType !== Candidate::COMPILATION
            && ($duration ? ($gap = $candidate->gap($duration)) !== null && $gap <= self::EXACT_LENGTH : $candidate->score >= self::SURE));
        $curated = array_filter($exact, fn (Candidate $candidate) => $candidate->source === MusicBrainz::NAME);

        return self::earliest(array_map(fn (Candidate $candidate) => $candidate->year, $curated ?: $exact));
    }

    /** The best cover among the versions: Apple's 600 px, then Deezer's, then the Cover Art Archive. @param list<Candidate> $versions */
    private function cover(array $versions): ?string
    {
        foreach ([ITunes::NAME, Deezer::NAME, MusicBrainz::NAME] as $source) {
            $candidate = collect($versions)->first(fn (Candidate $candidate) => $candidate->source === $source && $candidate->cover && $candidate->albumType !== Candidate::COMPILATION);
            if ($candidate) {
                return $candidate->cover;
            }
        }

        return null;
    }

    /**
     * Classifies what was found with the catalog: the canonical author, co-authors and up to three genres. The genres
     * weigh, in this order: the author's in the catalog, the original singer's of a cover, the databases' tags, the
     * co-authors' and the file's tag; with none of them, the radio's general genre.
     */
    private function classify(SongQuery $query, array $found, ?string $fileGenre = null): array
    {
        $catalog = MusicCatalog::artist($found['artist'] ?? null) ?? MusicCatalog::artist($query->artist);
        $artist = $catalog?->name ?? ($found['artist'] ?? null) ?? ($query->artist ?: null);
        $featured = $found['featured'] ?? array_map(fn (string $name) => MusicCatalog::artist($name)?->name ?? $name, $query->featured);

        /** @var array<string, array{genre: RadioGenre, score: float}> $scores */
        $scores = [];
        $add = function (?RadioGenre $genre, float $weight) use (&$scores) {
            if ($genre) {
                $scores[$genre->id] ??= ['genre' => $genre, 'score' => 0.0];
                $scores[$genre->id]['score'] += $weight;
            }
        };
        $christian = $catalog && ! $catalog->convert;
        foreach ($catalog?->genres ?? [] as $position => $genre) {
            $add($genre, 6 - 0.5 * $position);
        }
        foreach ($featured as $name) {
            foreach (MusicCatalog::artist($name)?->genres->take(2) ?? [] as $genre) {
                $add($genre, 1.2);
            }
        }
        $original = collect($query->originals)->map(fn (string $name) => MusicCatalog::artist($name))->filter()->first();
        if ($original) {
            $christian = $christian || ! $original->convert;
            foreach ($original->genres->take(2) as $position => $genre) {
                $add($genre, 2.5 - 0.5 * $position);
            }
        }
        foreach ($found['tags'] ?? [] as [$names, $weight]) {
            foreach (explode('||', (string) $names) as $name) {
                if ($genre = MusicCatalog::genre($name)) {
                    $christian = $christian || $genre->family === 'cristiana';
                    $add($genre, (float) $weight);

                    break;
                }
            }
        }
        $tagged = $fileGenre !== null ? MusicCatalog::genre(mb_substr(trim($fileGenre), 0, 60)) : null;
        if ($tagged) {
            $christian = $christian || $tagged->family === 'cristiana';
            $add($tagged, 1.0);
        }
        if ($christian) {
            foreach ($scores as $id => $entry) {
                $version = MusicCatalog::christianOf($entry['genre']);
                if ($version && $version->id !== $id) {
                    unset($scores[$id]);
                    $add($version, $entry['score']);
                }
            }
        }
        $general = MusicCatalog::genre('Música cristiana');
        if ($general && collect($scores)->contains(fn (array $entry) => $entry['genre']->family === 'cristiana' && $entry['genre']->id !== $general->id && $entry['score'] >= 0.9)) {
            unset($scores[$general->id]);
        }
        uasort($scores, fn (array $a, array $b) => $b['score'] <=> $a['score']);
        $top = $scores ? reset($scores)['score'] : 0;
        $genres = collect($scores)->filter(fn (array $entry) => $entry['score'] >= max(0.9, $top * 0.4))->take(3)->pluck('genre');
        $guessed = $found['guessed'] ?? [];
        if ($genres->isEmpty() && $general) {
            $genres = collect([$general]);
            if (! $christian) {
                $guessed[] = 'genres';
            }
        }

        $sources = $found['sources'] ?? [];
        if ($catalog) {
            $sources[] = 'catalogo';
        }
        $info = $found['artist_info'] ?? [];

        return [
            'found' => (bool) $found['found'],
            'confidence' => $found['confidence'] ?? null,
            'sources' => array_values(array_unique($sources)),
            'title' => $found['title'] ?? ($query->title !== '' ? $query->title : null),
            'artist' => $artist,
            'featured' => array_values($featured),
            'album' => $found['album'] ?? null,
            'year' => $found['year'] ?? null,
            'cover_url' => $found['cover'] ?? null,
            'genres' => $genres->map(fn (RadioGenre $genre) => $genre->brief())->values()->all(),
            'guessed' => array_values(array_unique($guessed)),
            'artist_info' => [
                'name' => $artist,
                'kind' => $catalog?->kind ?? ($info['kind'] ?? null),
                'country' => $catalog?->country ?? ($info['country'] ?? null),
                'known' => (bool) $catalog,
                'convert' => (bool) $catalog?->convert,
                'musicbrainz_id' => $info['musicbrainz_id'] ?? null,
            ],
            'identity' => array_filter([
                'confidence' => $found['confidence'] ?? null,
                'score' => $found['score'] ?? null,
                'sources' => array_values(array_unique($sources)),
                'ids' => $found['ids'] ?? null,
            ]),
        ];
    }

    /** @param list<Candidate> $candidates @return list<string> */
    private static function sources(array $candidates): array
    {
        return array_values(array_unique(array_map(fn (Candidate $candidate) => $candidate->source, $candidates)));
    }

    private static function rank(Candidate $candidate): int
    {
        return match ($candidate->albumType) {
            Candidate::ALBUM => 3,
            Candidate::EP => 2,
            Candidate::COMPILATION => 0,
            default => 1,
        };
    }

    /** @param list<?int> $years */
    private static function earliest(array $years): ?int
    {
        $years = array_filter($years);

        return $years ? min($years) : null;
    }
}
