<?php

namespace App\Domain\Radio\Identify;

use App\Domain\Radio\Catalog\MusicCatalog;
use App\Domain\Radio\Identify\Sources\Deezer;
use App\Domain\Radio\Identify\Sources\ITunes;
use App\Domain\Radio\Identify\Sources\MusicBrainz;
use App\Domain\Radio\Identify\Sources\Wikidata;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Identifies a song on the internet from its name, author and length: who sings it and with whom,
 * the album it belongs to, its year, its cover and its genres.
 *
 * It asks iTunes, Deezer and MusicBrainz in several ways until two of them agree on the same
 * recording. The album is only given when it is certain: two databases agree on it for a version
 * of the same length, or MusicBrainz has it with the exact length; singles and compilations never
 * count. Genres come from the artist catalog and the tags of every database, in Spanish.
 */
final class Identifier
{
    /** A version is the song from this score on (0 to 1). */
    private const MATCH = 0.75;

    /** No more ways are tried once a version scores this and two databases agree. */
    private const SURE = 0.86;

    /** Seconds a version may differ from the file and still be the same recording. */
    private const SAME_LENGTH = 4.0;

    /** Seconds within which the length is exact. */
    private const EXACT_LENGTH = 2.0;

    private const CACHE = 'radio-identify:v1:';

    public function __construct(
        private readonly ITunes $iTunes,
        private readonly Deezer $deezer,
        private readonly MusicBrainz $musicBrainz,
        private readonly Wikidata $wikidata,
    ) {}

    /**
     * @return array{
     *     found: bool, confidence: ?string, sources: list<string>, title: ?string, artist: ?string,
     *     featured: list<string>, album: ?string, year: ?int, cover_url: ?string,
     *     genres: list<array{id: string, name: string, family: string}>,
     *     artist_info: array{name: ?string, kind: ?string, country: ?string, known: bool, convert: bool, musicbrainz_id: ?string},
     *     identity: array<string, mixed>
     * }
     */
    public function identify(SongQuery $query): array
    {
        $key = self::CACHE.$query->cacheKey();
        $found = Cache::get($key);
        if (! is_array($found)) {
            $found = $this->research($query);
            Cache::put($key, $found, $found['found'] ? now()->addDays(30) : now()->addHours(6));
        }

        return $this->classify($query, $found);
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
                $candidates[$candidate->source.'|'.$candidate->id.'|'.$candidate->albumId.'|'.Text::key($candidate->album)] ??= $candidate;
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
        $same = $query->duration
            ? array_values(array_filter($matched, fn (Candidate $candidate) => ($gap = $candidate->gap($query->duration)) === null || $gap <= self::SAME_LENGTH))
            : $matched;

        $versions = $same ?: $matched;
        $this->completeAlbums($versions);
        $album = $this->album($same, $query);
        $recording = $album['candidates'] ?? $this->recording($versions, $best);
        if ($deezer = collect($recording)->first(fn (Candidate $candidate) => $candidate->source === Deezer::NAME)) {
            $this->deezer->completeCredits($deezer);
        }

        $artistName = MusicCatalog::artist($best->artist)?->name ?? $best->artist;
        $credited = array_map(fn (string $name) => MusicCatalog::artist($name)?->name ?? trim($name), [
            ...$query->featured,
            ...collect($recording)->flatMap(fn (Candidate $candidate) => $candidate->featured)->all(),
        ]);
        $featured = array_values(array_filter(
            Text::mergeSpellings($credited, fn (string $name) => MusicCatalog::artist($name) !== null),
            fn (string $name) => Text::similarity($name, $artistName) < 0.86,
        ));

        $tags = [];
        foreach ($versions as $candidate) {
            foreach ($candidate->tags as $tag) {
                $tags[$candidate->source.':'.Text::key($tag[0])] = $tag;
            }
        }
        $sources = self::sources($matched);
        $info = ['kind' => null, 'country' => null, 'musicbrainz_id' => null];
        $mbArtist = collect($matched)->first(fn (Candidate $candidate) => $candidate->source === MusicBrainz::NAME && $candidate->artistId);
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
        $first = fn (string $source) => collect($versions)->first(fn (Candidate $candidate) => $candidate->source === $source)
            ?? collect($matched)->first(fn (Candidate $candidate) => $candidate->source === $source);

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
            'year' => $album['year'] ?? $this->year($versions),
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

    /** How well a version matches: name 50 %, author 35 %, length 15 %. */
    private function score(Candidate $candidate, SongQuery $query): void
    {
        $candidate->titleScore = max(
            Text::similarity(Text::cleanTitle($candidate->title), $query->title),
            Text::similarity(Text::baseTitle($candidate->title), Text::baseTitle($query->title)),
        );
        $gap = $candidate->gap($query->duration);
        $length = match (true) {
            $gap === null => 0.6,
            $gap <= self::EXACT_LENGTH => 1.0,
            $gap <= 5 => 0.85,
            $gap <= 12 => 0.5,
            default => 0.15,
        };
        $live = $query->live === Text::isLive($candidate->title.' '.($candidate->album ?? '')) ? 0.0 : -0.03;

        if ($query->artist === '') {
            $candidate->artistScore = 0.0;
            $candidate->score = round(0.7 * $candidate->titleScore + 0.3 * $length + $live, 4);

            return;
        }
        $asMain = max(array_map(fn (string $name) => Text::similarity($candidate->artist, $name), $query->names()));
        $credited = max(array_map(fn (string $name) => Text::similarity($name, $query->artist), [$candidate->artist, ...$candidate->featured]));
        $candidate->artistScore = max(Text::similarity($candidate->artist, $query->artist), 0.85 * $credited, 0.8 * $asMain);
        $candidate->score = round(0.5 * $candidate->titleScore + 0.35 * $candidate->artistScore + 0.15 * $length + $live, 4);
    }

    /**
     * Versions that are the song, best first; on a tie, albums before singles and compilations.
     *
     * @param  array<string, Candidate>  $candidates
     * @return list<Candidate>
     */
    private function matched(array $candidates, SongQuery $query): array
    {
        $matched = array_values(array_filter($candidates, function (Candidate $candidate) use ($query) {
            if ($candidate->score < self::MATCH || $candidate->titleScore < 0.8) {
                return false;
            }
            if ($query->artist === '') {
                $gap = $candidate->gap($query->duration);

                return $gap !== null && $gap <= self::SAME_LENGTH;
            }

            return $candidate->artistScore >= 0.75;
        }));
        usort($matched, fn (Candidate $a, Candidate $b) => [$b->score, self::rank($b)] <=> [$a->score, self::rank($a)]);

        return $matched;
    }

    /** Asks Deezer what kind of release each version is on (album, EP, single or compilation). @param list<Candidate> $versions */
    private function completeAlbums(array $versions): void
    {
        $deezer = array_values(array_filter($versions, fn (Candidate $candidate) => $candidate->source === Deezer::NAME));
        collect($deezer)->unique('albumId')->take(4)->each(fn (Candidate $candidate) => $this->deezer->completeAlbum($candidate));
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
        $release = $best->album ? Text::albumKey($best->album) : '';
        $same = $release === '' ? [] : array_values(array_filter($versions, fn (Candidate $candidate) => $candidate->album && Text::albumKey($candidate->album) === $release));

        return $same ?: [$best];
    }

    /**
     * The album the song belongs to, only when it is certain.
     *
     * @param  list<Candidate>  $same  Versions of the same length as the file.
     * @return array{name: string, year: ?int, cover: ?string, candidates: list<Candidate>}|null
     */
    private function album(array $same, SongQuery $query): ?array
    {
        $groups = [];
        foreach ($same as $candidate) {
            $isAlbum = $candidate->onAlbum() || ($candidate->albumType === null && $candidate->album && ($candidate->albumTracks ?? 0) >= 5);
            $key = $isAlbum ? Text::albumKey((string) $candidate->album) : '';
            if ($key === '') {
                continue;
            }
            $groups[$key] ??= ['names' => [], 'sources' => [], 'years' => [], 'releaseYears' => [], 'exact' => false, 'candidates' => []];
            $groups[$key]['names'][] = (string) $candidate->album;
            $groups[$key]['sources'][$candidate->source] = true;
            $groups[$key]['years'][] = $candidate->year;
            if ($candidate->source !== ITunes::NAME) {
                $groups[$key]['releaseYears'][] = $candidate->year;
            }
            $groups[$key]['candidates'][] = $candidate;
            $gap = $candidate->gap($query->duration);
            $groups[$key]['exact'] = $groups[$key]['exact'] || ($gap !== null && $gap <= self::EXACT_LENGTH);
        }
        $certain = array_filter($groups, fn (array $group) => $query->duration
            ? count($group['sources']) >= 2 || (isset($group['sources'][MusicBrainz::NAME]) && $group['exact'])
            : count($group['sources']) >= 3);
        if (! $certain) {
            return null;
        }
        uasort($certain, fn (array $a, array $b) => [count($b['sources']), $b['exact'], self::earliest($a['years']) ?? 9999]
            <=> [count($a['sources']), $a['exact'], self::earliest($b['years']) ?? 9999]);
        $group = reset($certain);
        $plain = key($certain);
        $spellings = array_count_values($group['names']);
        uksort($spellings, fn ($a, $b) => [Text::key((string) $a) !== $plain, -$spellings[$a]] <=> [Text::key((string) $b) !== $plain, -$spellings[$b]]);

        return [
            'name' => (string) array_key_first($spellings),
            'year' => self::earliest($group['releaseYears']) ?? self::earliest($group['years']),
            'cover' => $this->cover($group['candidates']),
            'candidates' => $group['candidates'],
        ];
    }

    /** Year of the song when it is on no certain album: two databases must agree on it. @param list<Candidate> $versions */
    private function year(array $versions): ?int
    {
        $years = collect($versions)
            ->filter(fn (Candidate $candidate) => $candidate->year && $candidate->albumType !== Candidate::COMPILATION)
            ->groupBy('source')->map(fn (Collection $list) => $list->min('year'));

        return $years->count() >= 2 && $years->max() - $years->min() <= 1 ? (int) $years->min() : null;
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

    /** Classifies what was found with the catalog: the canonical author, co-authors and up to three genres. */
    private function classify(SongQuery $query, array $found): array
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
        foreach ($found['tags'] ?? [] as [$names, $weight]) {
            foreach (explode('||', (string) $names) as $name) {
                if ($genre = MusicCatalog::genre($name)) {
                    $christian = $christian || $genre->family === 'cristiana';
                    $add($genre, (float) $weight);

                    break;
                }
            }
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
        if ($genres->isEmpty() && $christian && $general) {
            $genres = collect([$general]);
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
            'title' => $found['title'] ?? null,
            'artist' => $artist,
            'featured' => array_values($featured),
            'album' => $found['album'] ?? null,
            'year' => $found['year'] ?? null,
            'cover_url' => $found['cover'] ?? null,
            'genres' => $genres->map(fn (RadioGenre $genre) => $genre->brief())->values()->all(),
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
