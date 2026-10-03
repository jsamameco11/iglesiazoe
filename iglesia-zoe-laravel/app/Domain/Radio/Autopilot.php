<?php

namespace App\Domain\Radio;

use App\Models\RadioPlaylist;
use App\Models\RadioTrack;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The automatic music: what plays when nobody is on air and nothing is scheduled.
 *
 * A source is one playlist or every playlist together (plus the songs marked for the
 * continuous music); when it has nothing playable the music falls back along the chain of
 * resolve(), down to every song of the library. Each cycle plays every song of the source once, without repeating;
 * shuffled sources draw a new order for every cycle (never starting with the song that
 * closed the previous one), ordered sources follow the playlist. The order depends only
 * on where the music started, so every listener hears the same song.
 */
final class Autopilot
{
    /** Name of the source without a playlist: every song of the radio, shuffled. */
    public const RANDOM = 'Canciones aleatorias';

    /** Levels of the fallback chain: the chosen playlist, every list, every song of the library. */
    public const PLAYLIST = 'playlist';

    public const LISTS = 'lists';

    public const LIBRARY = 'library';

    public const NONE = 'none';

    private const GENERATION_KEY = 'radio.autopilot.generation';

    /** Songs this short are jingles, not music. */
    private const MIN_SECONDS = 5;

    /** Songs every listener keeps at hand to cover a file that fails or a server that stops answering. */
    private const RESERVE = 8;

    /**
     * Songs of a source with their length and the step to the next one (the length minus the
     * crossfade, never more than a third of the song).
     *
     * @return list<array{id: string, kind: string, title: string, artist: ?string, src: string, ms: int, step: int}>
     */
    public static function songs(?string $playlist, int $crossfadeMs): array
    {
        return self::resolve($playlist, true, $crossfadeMs)['songs'];
    }

    /**
     * What the automatic music really plays: the first level of the chain with a playable song.
     * The chosen playlist; when it is missing, empty or every song of it is unplayable, every
     * list together (and the songs marked for the continuous music); when there is none, every
     * song of the library. Only songs that pass every check sound: active, music, long enough
     * and with a healthy file (see RadioHealth). The fallback levels are always shuffled.
     *
     * @return array{level: string, shuffle: bool, songs: list<array<string, mixed>>}
     */
    public static function resolve(?string $playlist, bool $shuffle, int $crossfadeMs): array
    {
        $chain = $playlist !== null ? [[self::PLAYLIST, $playlist]] : [];
        foreach ([...$chain, [self::LISTS, self::LISTS], [self::LIBRARY, self::LIBRARY]] as [$level, $source]) {
            $songs = self::cached($source, $crossfadeMs);
            if ($songs) {
                return ['level' => $level, 'shuffle' => $level === self::PLAYLIST ? $shuffle : true, 'songs' => $songs];
            }
        }

        return ['level' => self::NONE, 'shuffle' => true, 'songs' => []];
    }

    /**
     * Songs of the whole library for the listeners' players to fall back on, a new pick every hour.
     *
     * @return list<array{id: string, title: string, artist: ?string, src: string, ms: int}>
     */
    public static function reserve(int $now): array
    {
        $songs = self::shuffled(self::cached(self::LIBRARY, 0), 'reserve:'.intdiv($now, 3600000));

        return array_map(fn (array $song) => [
            'id' => $song['id'], 'title' => $song['title'], 'artist' => $song['artist'], 'src' => $song['src'], 'ms' => $song['ms'],
        ], array_slice($songs, 0, self::RESERVE));
    }

    /**
     * Playable songs of a playlist id, of every list (LISTS) or of the whole library (LIBRARY).
     *
     * @return list<array{id: string, kind: string, title: string, artist: ?string, src: string, ms: int, step: int}>
     */
    private static function cached(string $source, int $crossfadeMs): array
    {
        $generation = Cache::rememberForever(self::GENERATION_KEY, fn () => Str::random(8));

        return Cache::remember(
            "radio.autopilot.{$generation}.{$source}.{$crossfadeMs}",
            600,
            fn () => self::load($source)->map(fn (RadioTrack $track) => self::song($track, $crossfadeMs))->all(),
        );
    }

    /** Called whenever the library, a playlist or the crossfade changes. */
    public static function flush(): void
    {
        Cache::forever(self::GENERATION_KEY, Str::random(8));
    }

    /** Name of a source for the console and the program. */
    public static function label(?string $playlist): string
    {
        $name = $playlist !== null ? RadioPlaylist::query()->whereKey($playlist)->value('name') : null;

        return $name ?? self::RANDOM;
    }

    /**
     * Songs of the source between $from and $to for music that started at $anchor. Each item
     * keeps its origin, so a listener who joins mid-song seeks to the same moment as the rest.
     *
     * @param  array<string, mixed>  $extra  fields that override every item (kind, bed, block)
     * @return list<array<string, mixed>>
     */
    public static function fill(array $songs, bool $shuffle, int $anchor, int $from, int $to, int $limit, array $extra = []): array
    {
        $count = count($songs);
        $total = array_sum(array_column($songs, 'step'));
        if ($count === 0 || $total <= 0 || $to <= $from || $limit <= 0) {
            return [];
        }

        // One cycle back, so the last song of the previous cycle is kept while it fades into this one.
        $cycle = max(0, intdiv(max(0, $from - $anchor), $total) - 1);
        $t = $anchor + $cycle * $total;
        $order = self::order($songs, $shuffle, $anchor, $cycle);
        $index = 0;
        $advance = function () use (&$t, &$index, &$cycle, &$order, $songs, $shuffle, $anchor, $count) {
            $t += $order[$index]['step'];
            if (++$index === $count) {
                $index = 0;
                $order = self::order($songs, $shuffle, $anchor, ++$cycle);
            }
        };
        while ($t + $order[$index]['ms'] <= $from) {
            $advance();
        }

        $items = [];
        while ($t < $to && count($items) < $limit) {
            $song = $order[$index];
            $begin = max($t, $from);
            $items[] = [
                'id' => 'r'.$t.'-'.substr($song['id'], 0, 8),
                'kind' => 'musica',
                'title' => $song['title'],
                'artist' => $song['artist'],
                'src' => $song['src'],
                'start' => $begin,
                'end' => min($t + $song['ms'], $to),
                'origin' => $t,
                'seek' => round(($begin - $t) / 1000, 3),
                'bed' => false,
                'block' => null,
                'slot' => null,
                'track' => $song['id'],
                ...$extra,
            ];
            $advance();
        }

        return $items;
    }

    /**
     * Order of one cycle. Two songs or fewer simply alternate; otherwise a shuffled cycle never
     * opens with the song that closed the previous one (only the first two places can swap, so
     * the closing song of a cycle is always the one of its plain shuffle).
     */
    private static function order(array $songs, bool $shuffle, int $anchor, int $cycle): array
    {
        if (! $shuffle || count($songs) < 3) {
            return $songs;
        }
        $order = self::shuffled($songs, $anchor.':'.$cycle);
        if ($cycle > 0 && $order[0]['id'] === self::shuffled($songs, $anchor.':'.($cycle - 1))[count($songs) - 1]['id']) {
            [$order[0], $order[1]] = [$order[1], $order[0]];
        }

        return $order;
    }

    private static function shuffled(array $songs, string $seed): array
    {
        usort($songs, fn ($a, $b) => [crc32($a['id'].$seed), $a['id']] <=> [crc32($b['id'].$seed), $b['id']]);

        return $songs;
    }

    /** @return Collection<int, RadioTrack> */
    private static function load(string $source): Collection
    {
        $playable = fn ($query) => $query->where('radio_tracks.kind', 'musica')->where('radio_tracks.active', true)
            ->where('radio_tracks.duration', '>=', self::MIN_SECONDS)
            ->whereNull('radio_tracks.file_problem')
            ->whereNotNull('radio_tracks.file_path')->where('radio_tracks.file_path', '!=', '');

        if ($source === self::LIBRARY) {
            return $playable(RadioTrack::query())->orderBy('id')->get();
        }

        if ($source !== self::LISTS) {
            $list = RadioPlaylist::query()->find($source);

            return $list ? $playable($list->tracks())->get() : collect();
        }

        $listed = $playable(RadioTrack::query()->select('radio_tracks.*')
            ->join('radio_playlist_track', 'radio_playlist_track.radio_track_id', '=', 'radio_tracks.id')
            ->join('radio_playlists', 'radio_playlists.id', '=', 'radio_playlist_track.radio_playlist_id'))
            ->orderBy('radio_playlists.sort_order')->orderBy('radio_playlists.created_at')->orderBy('radio_playlist_track.position')
            ->get();
        $rotation = $playable(RadioTrack::query())->where('rotation', true)->orderBy('id')->get();

        return $listed->concat($rotation)->unique('id')->values();
    }

    private static function song(RadioTrack $track, int $crossfadeMs): array
    {
        $ms = (int) round($track->duration * 1000);

        return [
            'id' => $track->id,
            'kind' => $track->kind,
            'title' => $track->title,
            'artist' => $track->artist,
            'src' => $track->file_path,
            'ms' => $ms,
            'step' => max(1000, $ms - min($crossfadeMs, intdiv($ms, 3))),
        ];
    }
}
