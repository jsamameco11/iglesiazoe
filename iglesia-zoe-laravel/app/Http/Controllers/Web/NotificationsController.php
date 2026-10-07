<?php

namespace App\Http\Controllers\Web;

use App\Domain\Inbox\PushNotifier;
use App\Http\Controllers\Controller;
use App\Models\SitePushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Visitors turn the notifications of the public site on or off for the browser they are using. */
class NotificationsController extends Controller
{
    /** The key the browser needs to sign up with the push service. */
    public function key(): JsonResponse
    {
        return response()->json(['publicKey' => PushNotifier::publicKey()]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => 'required|url|starts_with:https://|max:2000',
            'keys.p256dh' => 'required|string|max:255',
            'keys.auth' => 'required|string|max:255',
            'contentEncoding' => 'nullable|in:aes128gcm,aesgcm',
        ]);

        SitePushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['contentEncoding'] ?? 'aes128gcm',
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ],
        );

        return response()->json(['ok' => true, 'message' => 'Listo: te avisaremos en este dispositivo.']);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => 'required|string|max:2000']);
        SitePushSubscription::query()->where('endpoint_hash', hash('sha256', $data['endpoint']))->delete();

        return response()->json(['ok' => true, 'message' => 'Listo: este dispositivo ya no recibirá notificaciones.']);
    }
}
