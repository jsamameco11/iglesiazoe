<?php

namespace App\Domain\Radio\Identify\Sources;

use App\Domain\Radio\Identify\Candidate;
use App\Domain\Radio\Identify\Text;

/** Apple's iTunes Search API: credits, the album of each version, its year, a 600 px cover and Apple's genre. */
final class ITunes extends Source
{
    public const NAME = 'itunes';

    /** Album names that give away a compilation («Lo mejor de…», «Grandes éxitos», «20 Éxitos»). */
    public const COMPILATION = '/\b(lo mejor|grandes exitos|greatest hits|best of|the very best|exitos|hits|coleccion|collection|album de coleccion|antologia|anthology|essentials|esenciales|recopilacion|compilation|clasicos de|top \d+|\d+ (canciones|exitos|songs|temas|alabanzas|coros))\b/';

    /**
     * @param  list<string>  $known  Known names with separators, kept whole.
     * @return list<Candidate>
     */
    public function search(string $term, array $known = []): array
    {
        $data = $this->json('https://itunes.apple.com/search', [
            'term' => $term,
            'media' => 'music',
            'entity' => 'song',
            'limit' => 25,
            'country' => config('services.music.store', 'US'),
        ]);

        return collect($data['results'] ?? [])
            ->filter(fn ($item) => is_array($item) && ($item['kind'] ?? '') === 'song' && ! empty($item['trackName']) && ! empty($item['artistName']))
            ->map(fn (array $item) => $this->candidate($item, $known))
            ->values()->all();
    }

    /** @param  list<string>  $known */
    private function candidate(array $item, array $known): Candidate
    {
        $credited = Text::splitNames((string) $item['artistName'], $known);
        [$album, $type] = self::release((string) ($item['collectionName'] ?? ''), (int) ($item['trackCount'] ?? 0), (string) ($item['collectionArtistName'] ?? ''));
        $cover = is_string($item['artworkUrl100'] ?? null) ? preg_replace('#/\d+x\d+bb\.(jpg|png)$#', '/600x600bb.$1', $item['artworkUrl100']) : null;

        return new Candidate(
            source: self::NAME,
            id: (string) ($item['trackId'] ?? ''),
            title: (string) $item['trackName'],
            artist: $credited[0] ?? (string) $item['artistName'],
            featured: Text::unique([...array_slice($credited, 1), ...Text::featuredIn((string) $item['trackName'], $known)]),
            album: $album,
            albumType: $type,
            albumTracks: (int) ($item['trackCount'] ?? 0) ?: null,
            year: self::year($item['releaseDate'] ?? null),
            duration: isset($item['trackTimeMillis']) ? round($item['trackTimeMillis'] / 1000, 1) : null,
            cover: $cover,
            tags: ! empty($item['primaryGenreName']) ? [[(string) $item['primaryGenreName'], 1.0]] : [],
            albumId: isset($item['collectionId']) ? (string) $item['collectionId'] : null,
        );
    }

    /**
     * The album name and its kind: «Renuévame - Single» is a single, «Lo mejor de…» a compilation.
     *
     * @return array{0: ?string, 1: ?string}
     */
    public static function release(string $name, int $tracks, string $collectionArtist = ''): array
    {
        $name = trim($name);
        if ($name === '') {
            return [null, null];
        }
        if (preg_match('/\s+-\s+single$/i', $name)) {
            return [trim(preg_replace('/\s+-\s+single$/i', '', $name) ?? $name), Candidate::SINGLE];
        }
        if (preg_match('/\s+-\s+ep$/i', $name)) {
            return [trim(preg_replace('/\s+-\s+ep$/i', '', $name) ?? $name), Candidate::EP];
        }
        if (preg_match('/\b(various artists|varios artistas|artistas varios)\b/i', $collectionArtist) || preg_match(self::COMPILATION, Text::key($name))) {
            return [$name, Candidate::COMPILATION];
        }

        return [$name, match (true) {
            $tracks >= 5 => Candidate::ALBUM,
            $tracks === 4 => Candidate::EP,
            $tracks > 0 => Candidate::SINGLE,
            default => null,
        }];
    }
}
