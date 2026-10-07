<?php

namespace Database\Factories;

use App\Models\SitePushSubscription;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SitePushSubscription>
 */
class SitePushSubscriptionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $endpoint = 'https://fcm.googleapis.com/fcm/send/'.Str::random(40);

        return [
            'endpoint' => $endpoint,
            'endpoint_hash' => hash('sha256', $endpoint),
            'public_key' => 'B'.Str::random(86),
            'auth_token' => Str::random(22),
            'content_encoding' => 'aes128gcm',
            'user_agent' => 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0',
        ];
    }
}
