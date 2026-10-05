<?php

namespace App\Domain\Radio\Identify\Sources;

use App\Domain\Radio\Catalog\Artists;
use App\Domain\Radio\Identify\Candidate;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * MusicBrainz, the open music encyclopedia: every release a recording is on (telling albums from
 * singles and compilations), exact credits, and the genres of the recording and of its artist.
 * It allows one request per second, so requests from every worker wait their turn.
 */
final class MusicBrainz extends Source
{
    public const NAME = 'musicbrainz';

    private const API = 'https://musicbrainz.org/ws/2/';

    /** Exact name and author, loose words, or the name alone. */
    public const EXACT = 'exact';

    public const LOOSE = 'loose';

    public const TITLE = 'title';

    /** @return list<Candidate> */
    public function search(string $title, string $artist, string $mode = self::EXACT): array
    {
        $query = match ($mode) {
            self::LOOSE => 'recording:('.self::words($title).')'.($artist !== '' ? ' AND artist:('.self::words($artist).')' : ''),
            self::TITLE => 'recording:"'.self::phrase($title).'"',
            default => 'recording:"'.self::phrase($title).'"'.($artist !== '' ? ' AND artist:"'.self::phrase($artist).'"' : ''),
        };
        $data = $this->ask('recording', ['query' => $query, 'limit' => 25]);

        $candidates = [];
        foreach ($data['recordings'] ?? [] as $recording) {
            if (! is_array($recording) || ($recording['score'] ?? 0) < 50 || empty($recording['title']) || empty($recording['artist-credit'][0]['name'])) {
                continue;
            }
            $credits = collect($recording['artist-credit'])->filter(fn ($credit) => ! empty($credit['name']))->values();
            $partners = [];
            $guest = false;
            foreach ($credits as $index => $credit) {
                if ($index > 0 && ! $guest) {
                    $partners[] = (string) $credit['name'];
                }
                $guest = $guest || preg_match('/\b(feat|ft|featuring|with|con)\b/i', (string) ($credit['joinphrase'] ?? '')) === 1;
            }
            $tags = collect($recording['tags'] ?? [])->filter(fn ($tag) => ($tag['count'] ?? 0) > 0 && ! empty($tag['name']))
                ->map(fn ($tag) => [(string) $tag['name'], 2.0])->values()->all();
            $releases = collect($recording['releases'] ?? [])
                ->filter(fn ($release) => ! in_array($release['status'] ?? 'Official', ['Bootleg', 'Pseudo-Release'], true))
                ->take(20);
            $base = [
                'source' => self::NAME,
                'id' => (string) $recording['id'],
                'title' => (string) $recording['title'],
                'artist' => (string) $credits->first()['name'],
                'featured' => $credits->slice(1)->pluck('name')->values()->all(),
                'duration' => isset($recording['length']) ? round($recording['length'] / 1000, 1) : null,
                'tags' => $tags,
                'artistId' => $credits->first()['artist']['id'] ?? null,
                'partners' => $partners,
            ];
            if ($releases->isEmpty()) {
                $candidates[] = new Candidate(...$base);

                continue;
            }
            foreach ($releases as $release) {
                $group = $release['release-group'] ?? [];
                $candidates[] = new Candidate(...array_merge($base, [
                    'album' => ! empty($release['title']) ? (string) $release['title'] : null,
                    'albumType' => self::type($group, (string) ($release['artist-credit'][0]['name'] ?? '')),
                    'albumTracks' => isset($release['track-count']) ? (int) $release['track-count'] : null,
                    'year' => self::year($release['date'] ?? null),
                    'cover' => ! empty($group['id']) ? 'https://coverartarchive.org/release-group/'.$group['id'].'/front-500' : null,
                    'albumId' => $group['id'] ?? null,
                ]));
            }
        }

        return $candidates;
    }

    /**
     * What MusicBrainz knows of an artist: soloist or group, country and genres.
     *
     * @return array{kind: ?string, country: ?string, tags: list<array{0: string, 1: float}>}|null
     */
    public function artist(string $id): ?array
    {
        $key = 'radio-identify:musicbrainz-artist:'.$id;
        if (is_array($cached = Cache::get($key))) {
            return $cached;
        }
        $data = $this->ask('artist/'.$id, ['inc' => 'genres+tags']);
        if (! $data) {
            return null;
        }
        $genres = collect($data['genres'] ?? [])->filter(fn ($genre) => ! empty($genre['name']))->map(fn ($genre) => [(string) $genre['name'], 2.5]);
        $tags = collect($data['tags'] ?? [])->filter(fn ($tag) => ($tag['count'] ?? 0) > 0 && ! empty($tag['name']))->map(fn ($tag) => [(string) $tag['name'], 1.0]);
        $artist = [
            'kind' => match ($data['type'] ?? null) {
                'Person' => Artists::SOLO,
                'Group', 'Orchestra', 'Choir' => Artists::GROUP,
                default => null,
            },
            'country' => is_string($data['country'] ?? null) && preg_match('/^[A-Z]{2}$/', $data['country']) ? $data['country'] : null,
            'tags' => $genres->concat($tags)->values()->all(),
        ];
        Cache::put($key, $artist, now()->addDays(30));

        return $artist;
    }

    private function ask(string $path, array $query): ?array
    {
        $this->waitTurn();

        return $this->json(self::API.$path, [...$query, 'fmt' => 'json']);
    }

    /** Keeps MusicBrainz's limit of one request per second, shared by every worker of the server. */
    private function waitTurn(): void
    {
        $gap = (int) config('services.music.musicbrainz_gap_ms', 1100);
        if ($gap <= 0) {
            return;
        }
        try {
            Cache::lock('radio-identify:musicbrainz-turn', 10)->block(8, function () use ($gap) {
                $wait = (float) Cache::get('radio-identify:musicbrainz-last', 0) + $gap / 1000 - microtime(true);
                if ($wait > 0) {
                    usleep((int) ceil($wait * 1_000_000));
                }
                Cache::put('radio-identify:musicbrainz-last', microtime(true), 60);
            });
        } catch (LockTimeoutException) {
            usleep($gap * 1000);
        }
    }

    private static function type(array $group, string $releaseArtist): ?string
    {
        $secondary = $group['secondary-types'] ?? [];
        if (array_intersect($secondary, ['Compilation', 'DJ-mix', 'Mixtape/Street']) || preg_match('/^(various artists|varios artistas)$/i', $releaseArtist)) {
            return Candidate::COMPILATION;
        }

        return match ($group['primary-type'] ?? null) {
            'Album' => Candidate::ALBUM,
            'EP' => Candidate::EP,
            'Single' => Candidate::SINGLE,
            default => null,
        };
    }

    private static function phrase(string $text): string
    {
        return trim(str_replace(['\\', '"'], ' ', $text));
    }

    private static function words(string $text): string
    {
        return trim(preg_replace('/([+\-&|!(){}\[\]^"~*?:\\\\\/])/', ' ', $text) ?? $text);
    }
}
