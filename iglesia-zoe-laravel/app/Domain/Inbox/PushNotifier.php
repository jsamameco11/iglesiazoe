<?php

namespace App\Domain\Inbox;

use App\Models\PushSubscription;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\VAPID;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Sends a phone notification (Web Push: Chrome on Android goes through Google's
 * push service) to every account that receives a new web form (for «Quiero
 * servir», only the accounts that cover its área).
 */
final class PushNotifier
{
    private const SETTING = 'webpush';

    public static function publicKey(): ?string
    {
        return self::keys()['publicKey'] ?? null;
    }

    public static function announce(string $kind, Model $row): void
    {
        try {
            $subscriptions = self::recipients($kind, $row);
            $keys = self::keys();
            if ($subscriptions->isEmpty() || ! $keys) {
                return;
            }

            $push = new WebPush(
                ['VAPID' => ['subject' => self::subject(), 'publicKey' => $keys['publicKey'], 'privateKey' => $keys['privateKey']]],
                ['TTL' => 86400, 'urgency' => 'high'],
            );
            $push->setReuseVAPIDHeaders(true);

            $payload = json_encode([
                ...Inbox::headline($kind, $row),
                'url' => Inbox::url($kind),
                'tag' => $kind.'-'.$row->getKey(),
                'kind' => $kind,
            ], JSON_UNESCAPED_UNICODE);

            foreach ($subscriptions as $subscription) {
                $push->queueNotification(Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'publicKey' => $subscription->public_key,
                    'authToken' => $subscription->auth_token,
                    'contentEncoding' => $subscription->content_encoding,
                ]), $payload);
            }

            $expired = [];
            foreach ($push->flush() as $report) {
                if ($report->isSubscriptionExpired()) {
                    $expired[] = hash('sha256', $report->getEndpoint());
                } elseif (! $report->isSuccess()) {
                    Log::warning('Web push failed', ['reason' => $report->getReason()]);
                }
            }
            if ($expired) {
                PushSubscription::query()->whereIn('endpoint_hash', $expired)->delete();
            }
        } catch (Throwable $error) {
            Log::error('Web push could not be sent', ['kind' => $kind, 'error' => $error->getMessage()]);
        }
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
    private static function keys(): ?array
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
            $saved = SiteSetting::query()->createOrFirst(['key' => self::SETTING], ['value' => $keys, 'updated_at' => now()])->value;
        } catch (Throwable $error) {
            Log::error('VAPID keys could not be created', ['error' => $error->getMessage()]);

            return null;
        }

        return ['publicKey' => $saved['publicKey'], 'privateKey' => $saved['privateKey']];
    }

    private static function subject(): string
    {
        $subject = (string) config('services.webpush.subject');

        return str_starts_with($subject, 'mailto:') || str_starts_with($subject, 'https://')
            ? $subject
            : 'mailto:'.config('mail.from.address');
    }
}
