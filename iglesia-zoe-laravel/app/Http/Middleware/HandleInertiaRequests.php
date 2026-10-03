<?php

namespace App\Http\Middleware;

use App\Domain\Access\Permissions;
use App\Domain\Auth\Support\Entrance;
use App\Domain\Inbox\Inbox;
use App\Domain\Inbox\PushNotifier;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Domain\Site\Design\NormalizeDesign;
use App\Domain\Site\Support\SiteVersion;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();
        $skin = ResolveSiteSkin::fromRequest($request);
        $design = LoadPublicSite::design();

        return [
            ...parent::share($request),
            'skin' => $skin,
            'settings' => LoadPublicSite::settings(),
            'ministries' => LoadPublicSite::ministries(),
            'design' => [...$design, 'fontHref' => NormalizeDesign::fontHref($design)],
            'siteVersion' => SiteVersion::current(),
            'auth' => [
                'user' => $user ? [
                    ...$user->profilePayload(),
                    'cereal' => Permissions::label($user),
                    'superadmin' => Permissions::isSuperadmin($user),
                    'types' => Permissions::cleanTypes($user->admin_types ?? []),
                    'permissions' => Permissions::of($user),
                ] : null,
                'profile' => $user?->profilePayload(),
            ],
            'entrance' => [
                'admin' => Entrance::isAdminHost($request),
                'siteUrl' => Entrance::siteUrl(),
            ],
            'flash' => [
                'denied' => (bool) $request->session()->get('denied'),
            ],
            'inbox' => fn () => $user && Inbox::kindsFor($user) ? [
                'unread' => Inbox::unread($user),
                'push' => [
                    'publicKey' => PushNotifier::publicKey(),
                    'muted' => (bool) $user->push_muted,
                    'canMute' => Permissions::isSuperadmin($user),
                ],
            ] : null,
        ];
    }
}
