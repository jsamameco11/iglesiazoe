<?php

namespace App\Domain\Inbox;

use App\Domain\Access\Permissions;
use App\Models\PushSubscription;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\VAPID;
use Throwable;

/**
 * Sends a phone notification (Web Push: Chrome on Android goes through Google's
 * push service) to every account that receives a new web form (for «Quiero
 * servir», only the accounts that cover its área), and other panel notices by permission.
 */
final class PushNotifier
{
    private const SETTING = 'webpush';

    private const PUBLIC_KEY_CACHE = 'zoe.webpush.public_key';

    /** Shared with every panel page, so it is kept in the cache once the keys exist instead of read from the database on each visit. */
    public static function publicKey(): ?string
    {
        $cached = Cache::get(self::PUBLIC_KEY_CACHE);
        if (is_string($cached)) {
            return $cached;
        }
        $key = self::keys()['publicKey'] ?? null;
        if ($key !== null) {
            Cache::forever(self::PUBLIC_KEY_CACHE, $key);
        }

        return $key;
    }

    public static function announce(string $kind, Model $row): void
    {
        try {
            app(PushDelivery::class)->send(self::recipients($kind, $row), [
                ...Inbox::headline($kind, $row),
                'url' => Inbox::url($kind),
                'tag' => $kind.'-'.$row->getKey(),
                'kind' => $kind,
            ]);
        } catch (Throwable $error) {
            Log::error('Web push could not be sent', ['kind' => $kind, 'error' => $error->getMessage()]);
        }
    }

    /**
     * A notice for the panel accounts that hold a permission (and have not muted the notifications).
     *
     * @param  array{title: string, body?: string, url?: string, tag?: string}  $payload
     */
    public static function toPanel(string $permission, array $payload): void
    {
        $subscriptions = User::query()
            ->where(fn ($query) => $query->where('active', true)->orWhereNull('active'))
            ->where('push_muted', false)
            ->whereHas('pushSubscriptions')
            ->with('pushSubscriptions')
            ->get()
            ->filter(fn (User $user) => Permissions::has($user, $permission))
            ->flatMap(fn (User $user) => $user->pushSubscriptions)
            ->values();
        if ($subscriptions->isEmpty()) {
            return;
        }

        app(PushDelivery::class)->send($subscriptions, $payload);
    }

    /** @return Collection<int, PushSubscription> */
    public static function recipients(string $kind, Model $row): Collection
    {
        return User::query()
            ->where(fn ($query) => $query->where('active', true)->orWhereNull('active'))
            ->where('push_muted', false)
            ->whereHas('pushSubscriptions')
            ->with('pushSubscriptions')
            ->get()
            ->filter(fn (User $user) => Inbox::reaches($user, $kind, $row))
            ->flatMap(fn (User $user) => $user->pushSubscriptions)
            ->values();
    }

    /** @return array{publicKey: string, privateKey: string}|null */
    public static function keys(): ?array
    {
        $public = config('services.webpush.public_key');
        $private = config('services.webpush.private_key');
        if ($public && $private) {
            return ['publicKey' => $public, 'privateKey' => $private];
        }

        $stored = SiteSetting::query()->find(self::SETTING)?->value;
        if (is_array($stored) && ! empty($stored['publicKey']) && ! empty($stored['privateKey'])) {
            return ['publicKey' => $stored['publicKey'], 'privateKey' => $stored['privateKey']];
        }

        try {
            $keys = VAPID::createVapidKeys();
            $saved = SiteSetting::withoutEvents(fn () => SiteSetting::query()->createOrFirst(['key' => self::SETTING], ['value' => $keys, 'updated_at' => now()]))->value;
        } catch (Throwable $error) {
            Log::error('VAPID keys could not be created', ['error' => $error->getMessage()]);

            return null;
        }

        return ['publicKey' => $saved['publicKey'], 'privateKey' => $saved['privateKey']];
    }

    public static function subject(): string
    {
        $subject = (string) config('services.webpush.subject');

        return str_starts_with($subject, 'mailto:') || str_starts_with($subject, 'https://')
            ? $subject
            : 'mailto:'.config('mail.from.address');
    }
}
