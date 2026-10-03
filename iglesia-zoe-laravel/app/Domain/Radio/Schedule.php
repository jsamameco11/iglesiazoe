<?php

namespace App\Domain\Radio;

use App\Models\RadioPlaylist;
use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Editing of the radio timeline. Blocks of the same layer never overlap; the main layer
 * holds the program and the overlay layers sound on top of it. Times are UTC milliseconds.
 */
final class Schedule
{
    /** Two blocks may touch with this much overlap (ms) without counting as a conflict. */
    private const TOLERANCE = 50;

    public static function utc(int $ms): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestampMs($ms, 'UTC');
    }

    /** A valid Y-m-d calendar date, or null. */
    public static function date(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        try {
            return CarbonImmutable::createFromFormat('!Y-m-d', $value, Station::TZ)->toDateString() === $value ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** UTC milliseconds of a Lima time (HH:MM or HH:MM:SS) on a day, or null. */
    public static function at(string $date, string $time): ?int
    {
        if (! preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/', trim($time), $match)) {
            return null;
        }

        return CarbonImmutable::parse($date, Station::TZ)->startOfDay()
            ->setTime((int) $match[1], (int) $match[2], (int) ($match[3] ?? 0))
            ->getTimestampMs();
    }

    public static function clock(int $ms): string
    {
        return CarbonImmutable::createFromTimestampMs($ms)->setTimezone(Station::TZ)->format('H:i:s');
    }

    /** @return Collection<int, RadioSlot> blocks that overlap [from, to), of one layer or of all */
    public static function between(int $from, int $to, ?string $ignore = null, ?int $layer = null): Collection
    {
        return RadioSlot::query()->with(['track', 'playlist'])
            ->where('starts_at', '>=', self::utc($from - Station::MAX_BLOCK * 1000))
            ->where('starts_at', '<', self::utc($to))
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore))
            ->when($layer !== null, fn ($query) => $query->where('layer', $layer))
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (RadioSlot $slot) => $slot->endsAt()->getTimestampMs() > $from)
            ->values();
    }

    /** Blocks of a Lima day on every layer, including ones that began the day before. */
    public static function day(string $date): array
    {
        [$from, $to] = Station::dayBounds($date);

        return self::between($from, $to)->map(fn (RadioSlot $slot) => self::payload($slot))->all();
    }

    public static function payload(RadioSlot $slot): array
    {
        return [
            'id' => $slot->id,
            'kind' => $slot->kind,
            'layer' => $slot->layer,
            'title' => $slot->title,
            'artist' => $slot->track?->artist,
            'note' => $slot->note,
            'bed' => $slot->bed,
            'duck' => $slot->duck,
            'volume' => $slot->volume,
            'duration' => $slot->duration,
            'track_id' => $slot->radio_track_id,
            'playlist_id' => $slot->radio_playlist_id,
            'playlist' => $slot->kind === RadioSlot::AUTO ? ($slot->playlist?->name ?? Autopilot::RANDOM) : null,
            'shuffle' => $slot->shuffle,
            'src' => $slot->track?->file_path,
            'inactive' => $slot->track !== null && ! $slot->track->active,
            'start' => $slot->starts_at->getTimestampMs(),
            'end' => $slot->endsAt()->getTimestampMs(),
        ];
    }

    public static function conflict(int $start, int $end, int $layer = RadioSlot::MAIN, ?string $ignore = null): ?RadioSlot
    {
        return self::between($start + self::TOLERANCE, $end - self::TOLERANCE, $ignore, $layer)->first();
    }

    /** End of the last block of a layer that starts on the given Lima day, or null when it is empty. */
    public static function dayEnd(string $date, int $layer = RadioSlot::MAIN): ?int
    {
        [$from, $to] = Station::dayBounds($date);
        $last = RadioSlot::query()->where('layer', $layer)
            ->where('starts_at', '>=', self::utc($from))->where('starts_at', '<', self::utc($to))
            ->orderByDesc('starts_at')->first();

        return $last?->endsAt()->getTimestampMs();
    }

    /** Ends of the last block of each layer on a day, keyed by layer. */
    public static function dayEnds(string $date): array
    {
        return collect(range(RadioSlot::MAIN, RadioSlot::OVERLAYS))
            ->mapWithKeys(fn (int $layer) => [$layer => self::dayEnd($date, $layer)])->all();
    }

    /**
     * Blocks for library audios. Overlays keep their own volume and may lower the music;
     * $duck null takes each audio's default.
     *
     * @param  Collection<int, RadioTrack>  $tracks
     * @return list<array<string, mixed>>
     */
    public static function trackBlocks(Collection $tracks, ?string $note = null, int $layer = RadioSlot::MAIN, ?bool $duck = null, int $volume = 100): array
    {
        return $tracks->map(fn (RadioTrack $track) => [
            'kind' => $track->kind,
            'layer' => $layer,
            'title' => $track->title,
            'duration' => $track->duration,
            'radio_track_id' => $track->id,
            'bed' => false,
            'duck' => $layer === RadioSlot::MAIN ? false : ($duck ?? $track->duck),
            'volume' => $layer === RadioSlot::MAIN ? 100 : max(0, min(100, $volume)),
            'note' => $note,
        ])->all();
    }

    /**
     * An automatic-music period of the main layer, split into blocks of at most MAX_BLOCK
     * (they play as one, since back-to-back periods of the same playlist never restart).
     * Without a playlist it plays random songs.
     *
     * @return list<array<string, mixed>>
     */
    public static function autoBlocks(?RadioPlaylist $playlist, bool $shuffle, int $seconds, ?string $note = null): array
    {
        $blocks = [];
        $shuffle = $playlist === null || $shuffle;
        $title = self::autoTitle($playlist, $shuffle);
        for ($left = $seconds; $left > 0; $left -= Station::MAX_BLOCK) {
            $blocks[] = [
                'kind' => RadioSlot::AUTO,
                'layer' => RadioSlot::MAIN,
                'title' => $title,
                'duration' => min($left, Station::MAX_BLOCK),
                'radio_track_id' => null,
                'radio_playlist_id' => $playlist?->id,
                'bed' => false,
                'shuffle' => $shuffle,
                'note' => $note,
            ];
        }

        return $blocks;
    }

    public static function autoTitle(?RadioPlaylist $playlist, bool $shuffle): string
    {
        return 'Música automática · '.($playlist ? $playlist->name.($shuffle ? ' · aleatorio' : ' · en orden') : Autopilot::RANDOM);
    }

    public static function length(array $blocks): int
    {
        return (int) round(array_sum(array_column($blocks, 'duration')) * 1000);
    }

    /** Places the blocks one after another from $start. The caller checks conflicts first. */
    public static function place(array $blocks, int $start): int
    {
        $cursor = $start;
        foreach ($blocks as $block) {
            RadioSlot::query()->create([...$block, 'starts_at' => self::utc($cursor)]);
            $cursor += (int) round($block['duration'] * 1000);
        }
        Station::flush();

        return $cursor;
    }

    /**
     * «Al aire ahora» on the main layer: cuts the block on air, plays the new blocks right
     * away and pushes the blocks that follow just enough to make room (gaps absorb the push).
     */
    public static function insertNow(array $blocks): int
    {
        return DB::transaction(function () use ($blocks) {
            $now = Station::nowMs() + 400;
            $current = self::between($now, $now + 1, null, RadioSlot::MAIN)->first();
            $following = RadioSlot::query()->where('layer', RadioSlot::MAIN)
                ->where('starts_at', '>=', self::utc($now))
                ->where('starts_at', '<', self::utc($now + 24 * 3600 * 1000))
                ->orderBy('starts_at')->get();

            if ($current) {
                $played = ($now - $current->starts_at->getTimestampMs()) / 1000;
                $played < 1 ? $current->delete() : $current->update(['duration' => round($played, 2)]);
            }

            $cursor = self::place($blocks, $now);
            foreach ($following as $slot) {
                if ($slot->starts_at->getTimestampMs() >= $cursor) {
                    break;
                }
                $slot->update(['starts_at' => self::utc($cursor)]);
                $cursor = $slot->endsAt()->getTimestampMs();
            }
            Station::flush();

            return $cursor;
        });
    }

    /**
     * When the live transmission ends at $at, the audios of the main program that were due
     * while it lasted (from $since) go on air one after another: after the block on air if it
     * is an audio, or cutting the automatic period or live block on air. The blocks that
     * follow are pushed just enough to make room; automatic periods are shortened instead.
     *
     * @return int how many audios were placed
     */
    public static function releaseHeld(int $since, int $at): int
    {
        return DB::transaction(function () use ($since, $at) {
            $held = RadioSlot::query()->where('layer', RadioSlot::MAIN)->whereNotIn('kind', [RadioSlot::LIVE, RadioSlot::AUTO])
                ->where('starts_at', '>=', self::utc($since))->where('starts_at', '<', self::utc($at))
                ->orderBy('starts_at')->get();
            if ($held->isEmpty()) {
                return 0;
            }
            $ids = $held->modelKeys();
            $cursor = $at + 400;

            $tail = null;
            $current = self::between($cursor, $cursor + 1, null, RadioSlot::MAIN)->first(fn (RadioSlot $slot) => ! in_array($slot->id, $ids, true));
            if ($current && in_array($current->kind, [RadioSlot::AUTO, RadioSlot::LIVE], true)) {
                $end = $current->endsAt()->getTimestampMs();
                $played = ($cursor - $current->starts_at->getTimestampMs()) / 1000;
                $tail = $current->kind === RadioSlot::AUTO ? [$current->replicate(), $end] : null;
                $played < 1 ? $current->delete() : $current->update(['duration' => round($played, 2)]);
            } elseif ($current) {
                $cursor = $current->endsAt()->getTimestampMs();
            }

            foreach ($held as $slot) {
                $slot->update(['starts_at' => self::utc($cursor)]);
                $cursor = $slot->endsAt()->getTimestampMs();
            }
            if ($tail && $tail[1] - $cursor >= 1000) {
                [$rest, $end] = $tail;
                $rest->fill(['starts_at' => self::utc($cursor), 'duration' => round(($end - $cursor) / 1000, 2)])->save();
                $ids[] = $rest->id;
                $cursor = $end;
            }

            $following = RadioSlot::query()->where('layer', RadioSlot::MAIN)->whereNotIn('id', $ids)
                ->where('starts_at', '>=', self::utc($at))->orderBy('starts_at')->get();
            foreach ($following as $slot) {
                $start = $slot->starts_at->getTimestampMs();
                if ($start >= $cursor) {
                    break;
                }
                $end = $slot->endsAt()->getTimestampMs();
                if ($slot->kind !== RadioSlot::AUTO) {
                    $slot->update(['starts_at' => self::utc($cursor)]);
                    $cursor = $slot->endsAt()->getTimestampMs();
                } elseif ($end - $cursor < 1000) {
                    $slot->delete();
                } else {
                    $slot->update(['starts_at' => self::utc($cursor), 'duration' => round(($end - $cursor) / 1000, 2)]);
                    $cursor = $end;
                }
            }
            Station::flush();

            return $held->count();
        });
    }

    /** Copies the blocks of every layer that start on $date to each target day; blocks that would overlap are skipped. */
    public static function copyDay(string $date, array $targets, bool $replace): array
    {
        [$from, $to] = Station::dayBounds($date);
        $source = RadioSlot::query()->where('starts_at', '>=', self::utc($from))->where('starts_at', '<', self::utc($to))->orderBy('starts_at')->get();
        $copied = 0;
        $skipped = 0;

        DB::transaction(function () use ($source, $targets, $replace, $from, &$copied, &$skipped) {
            foreach ($targets as $target) {
                [$targetFrom, $targetTo] = Station::dayBounds($target);
                if ($replace) {
                    RadioSlot::query()->where('starts_at', '>=', self::utc($targetFrom))->where('starts_at', '<', self::utc($targetTo))->delete();
                }
                $shift = $targetFrom - $from;
                foreach ($source as $slot) {
                    $start = $slot->starts_at->getTimestampMs() + $shift;
                    $end = $start + (int) round($slot->duration * 1000);
                    if (self::conflict($start, $end, $slot->layer)) {
                        $skipped++;

                        continue;
                    }
                    RadioSlot::query()->create([
                        'starts_at' => self::utc($start),
                        ...$slot->only(['duration', 'kind', 'layer', 'radio_track_id', 'radio_playlist_id', 'title', 'note', 'bed', 'shuffle', 'duck', 'volume']),
                    ]);
                    $copied++;
                }
            }
        });
        Station::flush();

        return [$copied, $skipped];
    }

    /** Blocks (all layers) and minutes of the main program scheduled on each of the next days, for the day picker. */
    public static function overview(string $firstDay, int $days): array
    {
        [$from] = Station::dayBounds($firstDay);
        $to = $from + $days * 86400000;
        $totals = [];
        foreach (RadioSlot::query()->where('starts_at', '>=', self::utc($from))->where('starts_at', '<', self::utc($to))->get(['starts_at', 'duration', 'layer']) as $slot) {
            $day = $slot->starts_at->setTimezone(Station::TZ)->toDateString();
            $totals[$day] ??= ['blocks' => 0, 'seconds' => 0];
            $totals[$day]['blocks']++;
            $totals[$day]['seconds'] += $slot->layer === RadioSlot::MAIN ? $slot->duration : 0;
        }

        return collect(range(0, $days - 1))->map(function (int $offset) use ($firstDay, $totals) {
            $day = CarbonImmutable::parse($firstDay, Station::TZ)->addDays($offset)->toDateString();

            return ['date' => $day, 'blocks' => $totals[$day]['blocks'] ?? 0, 'seconds' => (int) round($totals[$day]['seconds'] ?? 0)];
        })->all();
    }
}
