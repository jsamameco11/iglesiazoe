<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Inbox\Inbox;
use App\Domain\Inbox\NetworkRoute;
use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Models\ServeArea;
use App\Models\ServeRegistration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function home(Request $request): RedirectResponse
    {
        $kinds = Inbox::kindsFor($request->user());

        return $kinds ? redirect(Inbox::url($kinds[0])) : redirect('/admin')->with('denied', true);
    }

    public function show(Request $request, string $kind): Response|RedirectResponse
    {
        $user = $request->user();
        if (! in_array($kind, Inbox::kindsFor($user), true)) {
            return redirect('/admin')->with('denied', true);
        }
        $previous = Inbox::markSeen($user, $kind);
        $areas = $kind === 'servidores' ? Inbox::serveAreasOf($user) : null;

        return Inertia::render('Admin/Formularios', [
            'kind' => $kind,
            'title' => Inbox::KINDS[$kind]['title'],
            'tabs' => collect(Inbox::kindsFor($user))->map(fn ($key) => ['key' => $key, 'title' => Inbox::KINDS[$key]['title'], 'href' => Inbox::url($key)])->values(),
            'rows' => Inbox::rows($kind, $user),
            'limit' => Inbox::LIMIT,
            'seenBefore' => $previous?->toIso8601String(),
            'routes' => NetworkRoute::catalog(),
            'statuses' => $kind === 'servidores' ? ServeRegistration::STATUSES : null,
            'scope' => $areas === null ? null : ServeArea::query()->whereIn('id', $areas)->orderBy('sort_order')->pluck('name')->all(),
        ]);
    }

    /** Follow-up of a «Quiero servir» sign-up, only within the áreas the account covers. */
    public function serveStatus(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|string',
            'status' => ['required', Rule::in(array_keys(ServeRegistration::STATUSES))],
        ], ['required' => 'Falta elegir la inscripción y su estado.', 'status.in' => 'Elige un estado válido.']);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }
        $data = $validator->validated();
        $user = $request->user();
        $registration = ServeRegistration::query()->find($data['id']);
        if (! $registration || ! Inbox::reaches($user, 'servidores', $registration)) {
            return $this->fail('Esta inscripción no está entre las áreas que recibes.', 403);
        }

        $registration->update(['status' => $data['status'], 'status_at' => now(), 'status_by' => $user->name ?: $user->username]);

        return response()->json([
            'ok' => true,
            'reload' => true,
            'message' => "{$registration->first_name} quedó como «".ServeRegistration::STATUSES[$data['status']].'».',
        ]);
    }

    public function pulse(Request $request): JsonResponse
    {
        return response()->json(['unread' => Inbox::unread($request->user())]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => 'required|url|starts_with:https://|max:2000',
            'keys.p256dh' => 'required|string|max:255',
            'keys.auth' => 'required|string|max:255',
            'contentEncoding' => 'nullable|in:aes128gcm,aesgcm',
        ]);
        $user = $request->user();

        PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $user->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['contentEncoding'] ?? 'aes128gcm',
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ],
        );
        if (Permissions::isSuperadmin($user) && $user->push_muted) {
            $user->forceFill(['push_muted' => false])->save();
        }

        return response()->json(['ok' => true, 'message' => 'Listo: este dispositivo recibirá una notificación con cada formulario nuevo.']);
    }

    public function mute(Request $request): JsonResponse
    {
        $muted = $request->boolean('muted');
        $request->user()->forceFill(['push_muted' => $muted])->save();

        return response()->json([
            'ok' => true,
            'muted' => $muted,
            'message' => $muted
                ? 'Notificaciones desactivadas. Sigues viendo todos los formularios en el panel.'
                : 'Notificaciones activadas.',
        ]);
    }
}
