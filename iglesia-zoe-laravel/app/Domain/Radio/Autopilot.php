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
 * continuous music). Each cycle plays every song of the source once, without repeating;
 * shuffled sources draw a new order for every cycle (never starting with the song that
 * closed the previous one), ordered sources follow the playlist. The order depends only
 * on where the music started, so every listener hears the same song.
 */
final class Autopilot
{
    private const GENERATION_KEY = 'radio.autopilot.generation';

    /** Songs this short are jingles, not music. */
    private const MIN_SECONDS = 5;

    /**
     * Songs of a source with their length and the step to the next one (the length minus the
     * crossfade, never more than a third of the song). A missing or empty playlist falls back
     * to every list, so the radio never goes silent because a list was emptied.
     *
     * @return list<array{id: string, kind: string, title: string, artist: ?string, src: string, ms: int, step: int}>
     */
    public static function songs(?string $playlist, int $crossfadeMs): array
    {
        $generation = Cache::rememberForever(self::GENERATION_KEY, fn () => Str::random(8));
        $load = fn (?string $id) => Cache::remember(
            "radio.autopilot.{$generation}.".($id ?? 'all').".{$crossfadeMs}",
            600,
            fn () => self::load($id)->map(fn (RadioTrack $track) => self::song($track, $crossfadeMs))->all(),
        );

        return ($playlist !== null ? $load($playlist) : []) ?: $load(null);
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

        return $name ?? 'Todas las listas';
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
    private static function load(?string $playlist): Collection
    {
        $playable = fn ($query) => $query->where('radio_tracks.kind', 'musica')->where('radio_tracks.active', true)
            ->where('radio_tracks.duration', '>=', self::MIN_SECONDS);

        if ($playlist !== null) {
            $list = RadioPlaylist::query()->find($playlist);

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
