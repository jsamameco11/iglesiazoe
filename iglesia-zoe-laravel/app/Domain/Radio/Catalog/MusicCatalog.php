<?php

namespace App\Domain\Radio\Catalog;

use App\Domain\Radio\Identify\Text;
use App\Models\RadioArtist;
use App\Models\RadioGenre;
use App\Models\RadioTrack;
use ArrayObject;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The genres and artists of the radio library: loads the starting catalog, finds a genre or an
 * artist by any of its names and learns the artists of the songs that are saved.
 */
final class MusicCatalog
{
    private const MEMO = 'radio.music-catalog';

    /**
     * Adds the genres and artists of the starting catalog that are missing; never touches what the admin changed.
     *
     * @return array{genres: int, artists: int}
     */
    public static function sync(): array
    {
        $added = ['genres' => 0, 'artists' => 0];
        $owners = [];
        foreach (Genres::all() as $genres) {
            foreach ($genres as [$name, $aliases]) {
                foreach ([$name, ...$aliases] as $alias) {
                    $owners[Text::key($alias)] = Str::slug($name);
                }
            }
        }
        $existing = RadioGenre::query()->get()->keyBy('slug');
        $order = 0;
        $rows = [];
        foreach (Genres::all() as $family => $genres) {
            foreach ($genres as [$name, $aliases]) {
                $order += 10;
                $slug = Str::slug($name);
                $genre = $existing->get($slug);
                if (! $genre) {
                    $rows[] = [
                        'id' => (string) Str::uuid(), 'name' => $name, 'slug' => $slug, 'family' => $family,
                        'aliases' => json_encode($aliases, JSON_UNESCAPED_UNICODE), 'sort_order' => $order, 'custom' => false,
                        'created_at' => now(), 'updated_at' => now(),
                    ];

                    continue;
                }
                if ($genre->custom) {
                    continue;
                }
                $kept = array_filter($genre->aliases ?? [], fn (string $alias) => ($owners[Text::key($alias)] ?? $slug) === $slug);
                $merged = Text::unique([...$kept, ...$aliases]);
                if ($merged !== ($genre->aliases ?? []) || $genre->sort_order !== $order) {
                    $genre->update(['aliases' => $merged, 'sort_order' => $order]);
                }
            }
        }
        foreach (array_chunk($rows, 100) as $chunk) {
            RadioGenre::query()->insert($chunk);
        }
        $added['genres'] = count($rows);
        self::forget();

        foreach (Artists::all() as $entry) {
            [$name, $kind, $country, $genres] = $entry;
            $aliases = $entry[4] ?? [];
            $artist = self::artist($name) ?? collect($aliases)->map(fn (string $alias) => self::artist($alias))->filter()->first();
            if ($artist) {
                continue;
            }
            $artist = RadioArtist::query()->create([
                'name' => $name,
                'slug' => self::artistSlug($name),
                'aliases' => $aliases ?: null,
                'kind' => $kind,
                'country' => $country,
                'convert' => (bool) ($entry[5] ?? false),
                'source' => 'catalogo',
            ]);
            self::attachGenres($artist, collect($genres)->map(fn (string $genre) => self::genre($genre))->filter()->values());
            self::remember($artist);
            $added['artists']++;
        }
        self::forget();

        return $added;
    }

    /** Clears what was read from the database, after the catalog changes. */
    public static function forget(): void
    {
        app()->forgetInstance(self::MEMO);
    }

    /** The genre a name or tag stands for («progressive pop» → Pop progresivo), or null. */
    public static function genre(string $name): ?RadioGenre
    {
        $key = Text::key($name);
        if ($key === '') {
            return null;
        }
        $genres = self::genres();
        if (isset($genres[$key])) {
            return $genres[$key];
        }
        $plain = trim(preg_replace('/\b(music|musica|genre|style|estilo)\b/', '', $key) ?? $key);
        if ($plain !== $key && isset($genres[$plain])) {
            return $genres[$plain];
        }
        $secular = trim(preg_replace('/\b(christian|cristiano|cristiana|gospel)\b/', '', $plain) ?? $plain);
        if ($secular !== $plain && $secular !== '' && isset($genres[$secular])) {
            return self::christianOf($genres[$secular]) ?? $genres[$secular];
        }

        return null;
    }

    /** The Christian version of a secular genre (Reguetón → Reguetón cristiano), or null when it has none. */
    public static function christianOf(RadioGenre $genre): ?RadioGenre
    {
        $name = Genres::CHRISTIAN[$genre->name] ?? null;

        return $name ? self::genres()[Text::key($name)] ?? null : null;
    }

    /** The genre with that name, created as a custom genre when the catalog does not have it. */
    public static function genreFor(string $name): RadioGenre
    {
        $name = Str::limit(trim(preg_replace('/\s+/u', ' ', $name) ?? $name), 60, '');
        if ($genre = self::genre($name)) {
            return $genre;
        }
        $genre = RadioGenre::query()->create([
            'name' => Str::ucfirst($name),
            'slug' => self::genreSlug($name),
            'family' => 'otros',
            'aliases' => null,
            'sort_order' => (int) RadioGenre::query()->max('sort_order') + 10,
            'custom' => true,
        ]);
        self::forget();

        return $genre;
    }

    /** The known artist with that name or spelling, or null. */
    public static function artist(?string $name): ?RadioArtist
    {
        $key = Text::key($name);

        return $key === '' ? null : self::artists()[$key] ?? null;
    }

    /**
     * The known artist a song name starts or ends with, and the rest of the name:
     * «Marcos Witt Gracias Tu Fidelidad» → [Marcos Witt, «Gracias Tu Fidelidad»]. The longest name wins.
     *
     * @return array{0: RadioArtist, 1: string}|null
     */
    public static function artistAtEdge(string $title): ?array
    {
        $text = Text::key($title);
        $keys = array_filter(array_keys(self::artists()), fn ($key) => strlen((string) $key) >= 3
            && (str_starts_with($text, $key.' ') || str_ends_with($text, ' '.$key)));
        usort($keys, fn ($a, $b) => strlen((string) $b) <=> strlen((string) $a));
        foreach ($keys as $key) {
            if (($rest = Text::withoutName($title, (string) $key)) !== null) {
                return [self::artists()[$key], $rest];
            }
        }

        return null;
    }

    /**
     * Known names that contain a separator («Majo y Dan»), so credits are not split inside them.
     *
     * @return list<string>
     */
    public static function joinedNames(): array
    {
        return collect(self::artists())
            ->flatMap(fn (RadioArtist $artist) => [$artist->name, ...($artist->aliases ?? [])])
            ->filter(fn (string $name) => preg_match('/,|\s(&|\+|y|e|x|and|con|with)\s/iu', $name) === 1)
            ->unique()->values()->all();
    }

    /**
     * Learns the author and co-authors of a saved song: unknown names become artists of the
     * library, and an artist without genres takes the genres of its song.
     *
     * @param  array{kind?: ?string, country?: ?string, musicbrainz_id?: ?string}  $details  What the internet said of the main author.
     */
    public static function learn(RadioTrack $track, array $details = []): void
    {
        if ($track->kind !== 'musica' || ! $track->artist) {
            return;
        }
        $genres = $track->genres()->get();
        foreach ([$track->artist, ...($track->featured ?? [])] as $index => $name) {
            $main = $index === 0;
            $artist = self::artist($name);
            if (! $artist) {
                $artist = RadioArtist::query()->create([
                    'name' => Str::limit(trim($name), 120, ''),
                    'slug' => self::artistSlug($name),
                    'kind' => $main && in_array($details['kind'] ?? null, array_keys(Artists::KINDS), true) ? $details['kind'] : null,
                    'country' => $main && preg_match('/^[A-Z]{2}$/', (string) ($details['country'] ?? '')) ? $details['country'] : null,
                    'musicbrainz_id' => $main && Str::isUuid((string) ($details['musicbrainz_id'] ?? '')) ? $details['musicbrainz_id'] : null,
                    'source' => 'aprendido',
                ]);
                self::remember($artist);
            }
            if ($main && $genres->isNotEmpty() && ! $artist->genres()->exists()) {
                self::attachGenres($artist, $genres);
            }
        }
    }

    /** @param  Collection<int, RadioGenre>  $genres */
    public static function attachGenres(RadioArtist $artist, Collection $genres): void
    {
        $artist->genres()->sync($genres->unique('id')->values()->mapWithKeys(fn (RadioGenre $genre, int $position) => [$genre->id => ['position' => $position]])->all());
    }

    /** @return array<string, RadioGenre> Every name of every genre; a genre's own name wins over another's alias. */
    private static function genres(): array
    {
        $memo = self::memo();
        if (! isset($memo['genres'])) {
            $genres = [];
            $all = RadioGenre::query()->orderBy('sort_order')->get();
            foreach ($all as $genre) {
                foreach ([$genre->name, $genre->slug] as $name) {
                    $genres[Text::key($name)] ??= $genre;
                }
            }
            foreach ($all as $genre) {
                foreach ($genre->aliases ?? [] as $name) {
                    $genres[Text::key($name)] ??= $genre;
                }
            }
            $memo['genres'] = $genres;
        }

        return $memo['genres'];
    }

    /** @return array<string, RadioArtist> */
    private static function artists(): array
    {
        $memo = self::memo();
        if (! isset($memo['artists'])) {
            $memo['artists'] = [];
            RadioArtist::query()->get()->each(fn (RadioArtist $artist) => self::remember($artist));
        }

        return $memo['artists'];
    }

    private static function remember(RadioArtist $artist): void
    {
        $memo = self::memo();
        if (! isset($memo['artists'])) {
            return;
        }
        $artists = $memo['artists'];
        foreach ([$artist->name, ...($artist->aliases ?? [])] as $name) {
            $artists[Text::key($name)] ??= $artist;
        }
        $memo['artists'] = $artists;
    }

    /** What was read from the database during this request. */
    private static function memo(): ArrayObject
    {
        if (! app()->bound(self::MEMO)) {
            app()->instance(self::MEMO, new ArrayObject);
        }

        return app(self::MEMO);
    }

    public static function artistSlug(string $name): string
    {
        $base = Str::limit(Str::slug($name) ?: 'artista', 120, '');
        $slug = $base;
        for ($n = 2; RadioArtist::query()->where('slug', $slug)->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }

    public static function genreSlug(string $name): string
    {
        $base = Str::limit(Str::slug($name) ?: 'genero', 70, '');
        $slug = $base;
        for ($n = 2; RadioGenre::query()->where('slug', $slug)->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }
}
