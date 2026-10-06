<?php

namespace App\Domain\Inbox;

use App\Domain\Access\Permissions;
use App\Models\PrayerRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The floating bubble of the panel: every prayer request stays there for each
 * account until that account removes it. Removing it only hides it from the
 * bubble; the request is still kept under Peticiones de oración.
 */
final class PrayerBubble
{
    public const TABLE = 'prayer_request_dismissals';

    public const LIMIT = 40;

    public static function reaches(?User $user): bool
    {
        return Permissions::has($user, Inbox::KINDS['oraciones']['permission']);
    }

    /**
     * @return array{total: int, onAir: int, items: list<array{id: string, full_name: string, age: int|null, topic: string|null, request: string, phone: string|null, on_air: bool, created_at: string|null, network: array{key: string, label: string, color: string}}>}
     */
    public static function pending(User $user): array
    {
        $items = self::query($user)->latest()->limit(self::LIMIT)
            ->get(['id', 'full_name', 'age', 'marital_status', 'topic', 'request', 'phone', 'on_air', 'created_at'])
            ->map(fn (PrayerRequest $prayer) => [
                'id' => (string) $prayer->id,
                'full_name' => $prayer->full_name,
                'age' => $prayer->age,
                'topic' => $prayer->topic,
                'request' => $prayer->request,
                'phone' => $prayer->phone,
                'on_air' => (bool) $prayer->on_air,
                'created_at' => $prayer->created_at?->toIso8601String(),
                'network' => NetworkRoute::for($prayer->age, $prayer->marital_status, (string) $prayer->id),
            ])
            ->all();

        return [
            'total' => self::query($user)->count(),
            'onAir' => self::query($user)->where('on_air', true)->count(),
            'items' => $items,
        ];
    }

    /**
     * Hides the given requests (or all of them) from this account's bubble.
     *
     * @param  list<string>|null  $ids  null removes every pending request
     */
    public static function dismiss(User $user, ?array $ids): int
    {
        $pending = self::query($user)->when($ids !== null, fn (Builder $query) => $query->whereIn('id', $ids))->pluck('id');
        $now = now();
        foreach ($pending->chunk(500) as $chunk) {
            DB::table(self::TABLE)->insertOrIgnore(
                $chunk->map(fn ($id) => ['user_id' => $user->id, 'prayer_request_id' => $id, 'created_at' => $now])->values()->all(),
            );
        }

        return $pending->count();
    }

    private static function query(User $user): Builder
    {
        return PrayerRequest::query()->whereNotIn('id', DB::table(self::TABLE)->where('user_id', $user->id)->select('prayer_request_id'));
    }
}
