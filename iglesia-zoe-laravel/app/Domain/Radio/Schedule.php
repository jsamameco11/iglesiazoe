<?php

namespace App\Domain\Radio;

use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Editing of the radio timeline. Blocks never overlap; times are UTC milliseconds. */
final class Schedule
{
    /** Two blocks may touch with this much overlap (ms) without counting as a conflict. */
    private const TOLERANCE = 50;

    public static function utc(int $ms): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestampMs($ms, 'UTC');
    }

    /** @return Collection<int, RadioSlot> blocks that overlap [from, to) */
    public static function between(int $from, int $to, ?string $ignore = null): Collection
    {
        return RadioSlot::query()->with('track')
            ->where('starts_at', '>=', self::utc($from - Station::MAX_BLOCK * 1000))
            ->where('starts_at', '<', self::utc($to))
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore))
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (RadioSlot $slot) => $slot->endsAt()->getTimestampMs() > $from)
            ->values();
    }

    /** Blocks of a Lima day as the timeline shows them, including one that began the day before. */
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
            'title' => $slot->title,
            'artist' => $slot->track?->artist,
            'note' => $slot->note,
            'bed' => $slot->bed,
            'duration' => $slot->duration,
            'track_id' => $slot->radio_track_id,
            'src' => $slot->track?->file_path,
            'inactive' => $slot->track !== null && ! $slot->track->active,
            'start' => $slot->starts_at->getTimestampMs(),
            'end' => $slot->endsAt()->getTimestampMs(),
        ];
    }

    public static function conflict(int $start, int $end, ?string $ignore = null): ?RadioSlot
    {
        return self::between($start + self::TOLERANCE, $end - self::TOLERANCE, $ignore)->first();
    }

    /** End of the last block that starts on the given Lima day, or null when the day is empty. */
    public static function dayEnd(string $date): ?int
    {
        [$from, $to] = Station::dayBounds($date);
        $last = RadioSlot::query()->where('starts_at', '>=', self::utc($from))->where('starts_at', '<', self::utc($to))->orderByDesc('starts_at')->first();

        return $last?->endsAt()->getTimestampMs();
    }

    /**
     * @param  Collection<int, RadioTrack>  $tracks
     * @return list<array{kind: string, title: string, duration: float, radio_track_id: ?string, bed: bool, note: ?string}>
     */
    public static function trackBlocks(Collection $tracks, ?string $note = null): array
    {
        return $tracks->map(fn (RadioTrack $track) => [
            'kind' => $track->kind,
            'title' => $track->title,
            'duration' => $track->duration,
            'radio_track_id' => $track->id,
            'bed' => false,
            'note' => $note,
        ])->all();
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
     * «Al aire ahora»: cuts the block on air, plays the new blocks right away and pushes the
     * blocks that follow just enough to make room (gaps absorb the push).
     */
    public static function insertNow(array $blocks): int
    {
        return DB::transaction(function () use ($blocks) {
            $now = Station::nowMs() + 400;
            $current = self::between($now, $now + 1)->first();
            $following = RadioSlot::query()
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

    /** Copies the blocks that start on $date to each target day; blocks that would overlap are skipped. */
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
                    if (self::conflict($start, $end)) {
                        $skipped++;

                        continue;
                    }
                    RadioSlot::query()->create([
                        'starts_at' => self::utc($start),
                        'duration' => $slot->duration,
                        'kind' => $slot->kind,
                        'radio_track_id' => $slot->radio_track_id,
                        'title' => $slot->title,
                        'note' => $slot->note,
                        'bed' => $slot->bed,
                    ]);
                    $copied++;
                }
            }
        });
        Station::flush();

        return [$copied, $skipped];
    }

    /** Blocks and minutes scheduled on each of the next days, for the day picker. */
    public static function overview(string $firstDay, int $days): array
    {
        [$from] = Station::dayBounds($firstDay);
        $to = $from + $days * 86400000;
        $totals = [];
        foreach (RadioSlot::query()->where('starts_at', '>=', self::utc($from))->where('starts_at', '<', self::utc($to))->get(['starts_at', 'duration']) as $slot) {
            $day = $slot->starts_at->setTimezone(Station::TZ)->toDateString();
            $totals[$day] ??= ['blocks' => 0, 'seconds' => 0];
            $totals[$day]['blocks']++;
            $totals[$day]['seconds'] += $slot->duration;
        }

        return collect(range(0, $days - 1))->map(function (int $offset) use ($firstDay, $totals) {
            $day = CarbonImmutable::parse($firstDay, Station::TZ)->addDays($offset)->toDateString();

            return ['date' => $day, 'blocks' => $totals[$day]['blocks'] ?? 0, 'seconds' => (int) round($totals[$day]['seconds'] ?? 0)];
        })->all();
    }
}
