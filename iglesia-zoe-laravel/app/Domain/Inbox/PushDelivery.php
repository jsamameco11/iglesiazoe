<?php

namespace App\Domain\Inbox;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Delivers one Web Push notification to many browsers (Chrome and Android go through Google's
 * push service, Safari through Apple's) and forgets the ones the push service says are gone.
 * Both the panel accounts and the visitors of the public site are reached through here.
 */
class PushDelivery
{
    /** Notifications queued per request to the push services, so a big audience never piles up in memory. */
    private const BATCH = 200;

    /**
     * @param  Collection<int, Model>  $subscriptions  rows with endpoint, public_key, auth_token, content_encoding and endpoint_hash
     * @param  array{title: string, body?: string, url?: string, tag?: string, kind?: string}  $payload
     */
    public function send(Collection $subscriptions, array $payload, int $ttl = 86400): void
    {
        $keys = PushNotifier::keys();
        if ($subscriptions->isEmpty() || ! $keys) {
            return;
        }

        try {
            $push = new WebPush(
                ['VAPID' => ['subject' => PushNotifier::subject(), 'publicKey' => $keys['publicKey'], 'privateKey' => $keys['privateKey']]],
                ['TTL' => $ttl, 'urgency' => 'high', 'batchSize' => self::BATCH],
            );
            $push->setReuseVAPIDHeaders(true);
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            foreach ($subscriptions as $subscription) {
                $push->queueNotification(Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'publicKey' => $subscription->public_key,
                    'authToken' => $subscription->auth_token,
                    'contentEncoding' => $subscription->content_encoding,
                ]), $body);
            }

            $expired = [];
            foreach ($push->flush(self::BATCH) as $report) {
                if ($report->isSubscriptionExpired()) {
                    $expired[] = hash('sha256', $report->getEndpoint());
                } elseif (! $report->isSuccess()) {
                    Log::warning('Web push failed', ['reason' => $report->getReason()]);
                }
            }
            if ($expired) {
                $subscriptions->first()::query()->whereIn('endpoint_hash', $expired)->delete();
            }
        } catch (Throwable $error) {
            Log::error('Web push could not be sent', ['tag' => $payload['tag'] ?? null, 'error' => $error->getMessage()]);
        }
    }
}
