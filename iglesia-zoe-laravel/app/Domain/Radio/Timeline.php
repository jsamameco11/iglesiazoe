<?php

namespace App\Domain\Radio;

use App\Models\RadioSlot;
use App\Models\RadioTrack;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The blocks of the timeline around now, kept in the cache so the state every listener polls
 * is computed without a round trip to the database. It covers SPAN before and after the moment
 * it was built and is rebuilt once now drifts DRIFT away from it, or as soon as a block or an
 * audio changes (flush). Ranges it does not cover are read from the database as before.
 */
final class Timeline
{
    private const GENERATION_KEY = 'radio.timeline.generation';

    private const SPAN = 48 * 3600000;

    private const DRIFT = 12 * 3600000;

    /**
     * The snapshot already read in this process, reused while its generation is the current one.
     *
     * @var array{generation: string, center: int, from: int, to: int, slots: Collection<int, RadioSlot>, before: ?RadioSlot, after: ?RadioSlot}|null
     */
    private static ?array $memo = null;

    /** Called whenever a block or an audio changes; again after the transaction commits, so no snapshot keeps what it replaced. */
    public static function flush(): void
    {
        Cache::forever(self::GENERATION_KEY, Str::random(12));
        DB::afterCommit(fn () => Cache::forever(self::GENERATION_KEY, Str::random(12)));
    }

    /**
     * Blocks of the main program ($main) or of the overlay layers starting in [$from, $to), oldest first, with their audio.
     *
     * @return Collection<int, RadioSlot>
     */
    public static function blocks(int $from, int $to, bool $main): Collection
    {
        $snapshot = self::covering($from, $to);
        if ($snapshot === null) {
            return RadioSlot::query()->with('track')->where('layer', $main ? '=' : '>', RadioSlot::MAIN)
                ->where('starts_at', '>=', self::at($from))->where('starts_at', '<', self::at($to))
                ->orderBy('starts_at')->get();
        }

        return $snapshot['slots']->filter(fn (RadioSlot $slot) => ($slot->layer === RadioSlot::MAIN) === $main
            && self::start($slot) >= $from && self::start($slot) < $to)->values();
    }

    /** The last block of the main program before $at that is not a live block (nor an audio still waiting for the live transmission since $hold). */
    public static function lastBefore(int $at, ?int $hold): ?RadioSlot
    {
        $counts = fn (RadioSlot $slot) => $slot->layer === RadioSlot::MAIN && $slot->kind !== RadioSlot::LIVE
            && ($hold === null || $slot->kind === RadioSlot::AUTO || self::start($slot) < $hold);
        $snapshot = self::covering($at, $at);
        if ($snapshot !== null) {
            $found = $snapshot['slots']->filter(fn (RadioSlot $slot) => self::start($slot) < $at && $counts($slot))->last()
                ?? $snapshot['before'];
            if ($found === null || $counts($found)) {
                return $found;
            }
        }

        return RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::LIVE)
            ->when($hold !== null, fn ($query) => $query->where(fn ($query) => $query->where('kind', RadioSlot::AUTO)
                ->orWhere('starts_at', '<', self::at($hold))))
            ->where('starts_at', '<', self::at($at))->orderByDesc('starts_at')->first();
    }

    /** The block of the main program right before $start, if it began within the longest block. */
    public static function previous(int $start): ?RadioSlot
    {
        $from = $start - Station::MAX_BLOCK * 1000;
        if (self::covering($from, $start) !== null) {
            return self::blocks($from, $start, true)->last();
        }

        return RadioSlot::query()->where('layer', RadioSlot::MAIN)
            ->where('starts_at', '<', self::at($start))->where('starts_at', '>=', self::at($from))
            ->orderByDesc('starts_at')->first();
    }

    /** The next scheduled block of the main program after $now that is not an automatic-music period. */
    public static function nextShow(int $now): ?RadioSlot
    {
        $snapshot = self::covering($now, $now);
        if ($snapshot !== null) {
            return $snapshot['slots']->first(fn (RadioSlot $slot) => $slot->layer === RadioSlot::MAIN
                && $slot->kind !== RadioSlot::AUTO && self::start($slot) > $now) ?? $snapshot['after'];
        }

        return RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::AUTO)
            ->where('starts_at', '>', self::at($now))->orderBy('starts_at')->first();
    }

    /** @return array{generation: string, center: int, from: int, to: int, slots: Collection<int, RadioSlot>, before: ?RadioSlot, after: ?RadioSlot}|null */
    private static function covering(int $from, int $to): ?array
    {
        $snapshot = self::snapshot(Station::nowMs());

        return $from >= $snapshot['from'] && $to <= $snapshot['to'] ? $snapshot : null;
    }

    /** @return array{generation: string, center: int, from: int, to: int, slots: Collection<int, RadioSlot>, before: ?RadioSlot, after: ?RadioSlot} */
    private static function snapshot(int $now): array
    {
        $generation = (string) Cache::rememberForever(self::GENERATION_KEY, fn () => Str::random(12));
        $fresh = fn (mixed $snapshot) => is_array($snapshot) && ($snapshot['generation'] ?? null) === $generation
            && is_int($snapshot['center'] ?? null) && abs($now - $snapshot['center']) <= self::DRIFT
            && (is_array($snapshot['slots'] ?? null) || ($snapshot['slots'] ?? null) instanceof Collection);
        if ($fresh(self::$memo)) {
            return self::$memo;
        }
        $key = 'radio.timeline.'.$generation;
        $cached = Cache::get($key);
        if (! $fresh($cached)) {
            $cached = self::build($generation, $now);
            Cache::put($key, $cached, now()->addDay());
        }

        return self::$memo = [
            ...$cached,
            'slots' => new Collection(array_map(fn (array $row) => self::unpack($row), $cached['slots'])),
            'before' => $cached['before'] ? self::unpack($cached['before']) : null,
            'after' => $cached['after'] ? self::unpack($cached['after']) : null,
        ];
    }

    /**
     * The cache only takes plain values (it does not unserialize objects), so the blocks travel as their raw columns.
     *
     * @return array{generation: string, center: int, from: int, to: int, slots: list<array<string, mixed>>, before: ?array<string, mixed>, after: ?array<string, mixed>}
     */
    private static function build(string $generation, int $now): array
    {
        $from = $now - self::SPAN;
        $to = $now + self::SPAN;
        $before = RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::LIVE)
            ->where('starts_at', '<', self::at($from))->orderByDesc('starts_at')->first();
        $after = RadioSlot::query()->where('layer', RadioSlot::MAIN)->where('kind', '!=', RadioSlot::AUTO)
            ->where('starts_at', '>=', self::at($to))->orderBy('starts_at')->first();

        return [
            'generation' => $generation,
            'center' => $now,
            'from' => $from,
            'to' => $to,
            'slots' => RadioSlot::query()->with('track')
                ->where('starts_at', '>=', self::at($from))->where('starts_at', '<', self::at($to))
                ->orderBy('starts_at')->orderBy('layer')->get()
                ->map(fn (RadioSlot $slot) => [...self::pack($slot), 'track' => $slot->track?->getAttributes()])->all(),
            'before' => $before ? self::pack($before) : null,
            'after' => $after ? self::pack($after) : null,
        ];
    }

    /** @return array{slot: array<string, mixed>} */
    private static function pack(RadioSlot $slot): array
    {
        return ['slot' => $slot->getAttributes()];
    }

    /** @param  array{slot: array<string, mixed>, track?: ?array<string, mixed>}  $row */
    private static function unpack(array $row): RadioSlot
    {
        $slot = (new RadioSlot)->newFromBuilder($row['slot']);
        if (array_key_exists('track', $row)) {
            $slot->setRelation('track', $row['track'] !== null ? (new RadioTrack)->newFromBuilder($row['track']) : null);
        }

        return $slot;
    }

    private static function start(RadioSlot $slot): int
    {
        return $slot->starts_at->getTimestampMs();
    }

    private static function at(int $ms): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestampMs($ms);
    }
}
