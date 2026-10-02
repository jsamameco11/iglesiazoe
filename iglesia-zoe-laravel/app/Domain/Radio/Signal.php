<?php

namespace App\Domain\Radio;

use App\Models\RadioListener;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;

/**
 * WebRTC handshake between the console (the only microphone) and each listener.
 *
 * The console opens one peer connection per listener and the SDP travels through the
 * database: waiting → offering (console preparing) → offered → answered → connected.
 */
final class Signal
{
    private const FRESH = 40;

    /** A handshake stuck in one step for this long can be requested again. */
    public const RETRY = 15;

    public static function touch(string $id): RadioListener
    {
        $now = CarbonImmutable::now();
        $listener = RadioListener::query()->find($id);
        if (! $listener) {
            try {
                return RadioListener::query()->create(['id' => $id, 'state' => 'idle', 'last_seen' => $now]);
            } catch (QueryException) {
                $listener = RadioListener::query()->findOrFail($id);
            }
        }
        if ($listener->last_seen->lt($now->subSeconds(10))) {
            $listener->update(['last_seen' => $now]);
        }

        return $listener;
    }

    /** The listener asks for the live microphone of the current session. */
    public static function request(string $id, string $session): void
    {
        $listener = self::touch($id);
        $listener->update(['session' => $session, 'state' => 'waiting', 'offer' => null, 'answer' => null, 'state_at' => CarbonImmutable::now(), 'last_seen' => CarbonImmutable::now()]);
    }

    public static function answer(string $id, string $session, string $sdp): bool
    {
        return RadioListener::query()->whereKey($id)->where('session', $session)->where('state', 'offered')
            ->update(['answer' => $sdp, 'state' => 'answered', 'state_at' => CarbonImmutable::now(), 'last_seen' => CarbonImmutable::now()]) > 0;
    }

    public static function leave(string $id): void
    {
        RadioListener::query()->whereKey($id)->delete();
    }

    /** What the listener needs from the handshake: its step and, when ready, the console's offer. */
    public static function voiceOf(RadioListener $listener, ?string $session): array
    {
        if (! $session || $listener->session !== $session) {
            return ['state' => 'idle', 'offer' => null];
        }

        return [
            'state' => $listener->state,
            'offer' => $listener->state === 'offered' ? $listener->offer : null,
            'since' => $listener->state_at?->getTimestampMs(),
        ];
    }

    /**
     * Listeners waiting for the microphone, marked as being prepared so the next poll
     * does not offer them twice.
     *
     * @return list<string>
     */
    public static function pending(string $session, int $max): array
    {
        $fresh = CarbonImmutable::now()->subSeconds(self::FRESH);
        $busy = RadioListener::query()->where('session', $session)->whereIn('state', ['offering', 'offered', 'answered', 'connected'])
            ->where('last_seen', '>=', $fresh)->count();
        $room = max(0, $max - $busy);
        if ($room === 0) {
            return [];
        }
        $ids = RadioListener::query()->where('session', $session)->where('state', 'waiting')->where('last_seen', '>=', $fresh)
            ->orderBy('state_at')->limit(min($room, 8))->pluck('id')->all();
        if ($ids) {
            RadioListener::query()->whereIn('id', $ids)->update(['state' => 'offering', 'state_at' => CarbonImmutable::now()]);
        }

        return $ids;
    }

    public static function offer(string $session, string $id, string $sdp): bool
    {
        return RadioListener::query()->whereKey($id)->where('session', $session)->where('state', 'offering')
            ->update(['offer' => $sdp, 'state' => 'offered', 'state_at' => CarbonImmutable::now()]) > 0;
    }

    /** @return list<array{id: string, answer: string}> */
    public static function answers(string $session): array
    {
        $rows = RadioListener::query()->where('session', $session)->where('state', 'answered')->get(['id', 'answer']);
        if ($rows->isNotEmpty()) {
            RadioListener::query()->whereIn('id', $rows->pluck('id'))->update(['state' => 'connected', 'state_at' => CarbonImmutable::now()]);
        }

        return $rows->map(fn ($row) => ['id' => $row->id, 'answer' => (string) $row->answer])->all();
    }

    /** Listeners of the session that are still around; the console closes connections of the rest. */
    public static function alive(string $session): array
    {
        return RadioListener::query()->where('session', $session)->whereIn('state', ['offered', 'answered', 'connected'])
            ->where('last_seen', '>=', CarbonImmutable::now()->subSeconds(self::FRESH))->pluck('id')->all();
    }

    public static function close(string $session): void
    {
        RadioListener::query()->where('session', $session)->update(['session' => null, 'state' => 'idle', 'offer' => null, 'answer' => null]);
    }

    public static function prune(): void
    {
        RadioListener::query()->where('last_seen', '<', CarbonImmutable::now()->subHour())->delete();
    }
}
