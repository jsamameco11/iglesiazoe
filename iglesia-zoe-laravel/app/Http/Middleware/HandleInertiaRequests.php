<?php

namespace App\Http\Middleware;

use App\Domain\Access\Permissions;
use App\Domain\Auth\Support\Entrance;
use App\Domain\Inbox\Inbox;
use App\Domain\Inbox\PrayerBubble;
use App\Domain\Inbox\PushNotifier;
use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Actions\ResolveSiteSkin;
use App\Domain\Site\Design\NormalizeDesign;
use App\Domain\Site\Support\SiteVersion;
use App\Domain\Stream\LiveState;
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
            'settings' => LoadPublicSite::publicSettings(),
            'ministries' => LoadPublicSite::ministries(),
            'sitePages' => LoadPublicSite::pages(),
            'design' => [...$design, 'fontHref' => NormalizeDesign::fontHref($design)],
            'siteVersion' => SiteVersion::current(),
            'auth' => [
                'user' => $user ? [
                    ...$user->profilePayload(),
                    'cereal' => Permissions::label($user),
                    'superadmin' => Permissions::isSuperadmin($user),
                    'administrator' => Permissions::isAdministrator($user),
                    'types' => Permissions::typesOf($user),
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
                'notice' => $request->session()->get('notice'),
            ],
            'onAir' => fn () => LiveState::onAir(),
            'inbox' => fn () => $user && Inbox::kindsFor($user) ? [
                'unread' => Inbox::unread($user),
                'prayers' => $request->is('admin', 'admin/*') && PrayerBubble::reaches($user) ? PrayerBubble::pending($user) : null,
                'push' => [
                    'publicKey' => PushNotifier::publicKey(),
                    'muted' => (bool) $user->push_muted,
                    'canMute' => Permissions::isSuperadmin($user),
                ],
            ] : null,
        ];
    }
}
