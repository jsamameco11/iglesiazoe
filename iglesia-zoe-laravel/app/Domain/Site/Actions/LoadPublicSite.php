<?php

namespace App\Domain\Site\Actions;

use App\Domain\Site\Design\NormalizeDesign;
use App\Domain\Site\Support\SiteVersion;
use App\Models\Ministry;
use App\Models\ServeArea;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;

class LoadPublicSite
{
    private const KEYS = ['zoe.site.settings', 'zoe.site.ministries', 'zoe.site.serve', 'zoe.site.media', 'zoe.site.design', 'zoe.site.notice'];

    public const LIST_SETTINGS = ['values', 'prayerTopics', 'routeLevels'];

    public static function settings(): array
    {
        return Cache::rememberForever('zoe.site.settings', function () {
            $stored = SiteSetting::query()->where('key', 'site')->first()?->value;
            $stored = is_array($stored) ? $stored : [];
            $settings = array_replace_recursive(config('zoe.settings'), $stored);
            foreach (self::LIST_SETTINGS as $key) {
                if (isset($stored[$key]) && is_array($stored[$key]) && $stored[$key] !== []) {
                    $settings[$key] = array_values($stored[$key]);
                }
            }

            return $settings;
        });
    }

    public static function prayerTopics(): array
    {
        $topics = self::settings()['prayerTopics'] ?? [];

        return is_array($topics) && $topics !== [] ? array_values($topics) : config('zoe.settings.prayerTopics');
    }

    public static function ministries(): array
    {
        return Cache::rememberForever('zoe.site.ministries', function () {
            if (! Ministry::query()->exists()) {
                return config('zoe.ministries');
            }

            return Ministry::query()->where('active', true)->orderBy('sort_order')->get()->toArray();
        });
    }

    /** Visible áreas de servicio in their admin order, as shown in the menu, the home carousel and Involúcrate. */
    public static function serveAreas(): array
    {
        return Cache::rememberForever('zoe.site.serve', fn () => ServeArea::query()
            ->where('active', true)->orderBy('sort_order')->get()
            ->map->card()->all());
    }

    public static function mediaOverrides(): array
    {
        return Cache::rememberForever('zoe.site.media', function () {
            $stored = SiteSetting::query()->where('key', 'media')->first()?->value;
            $assets = is_array($stored) ? ($stored['assets'] ?? []) : [];

            return is_array($assets) ? $assets : [];
        });
    }

    public static function weeklyNotice(): array
    {
        return Cache::rememberForever('zoe.site.notice', function () {
            $row = SiteSetting::query()->where('key', 'weekly_notice')->first();
            $stored = is_array($row?->value) ? $row->value : [];

            return [
                ...array_replace(config('zoe.weekly_notice'), $stored),
                'updated_at' => $row?->updated_at?->toIso8601String(),
            ];
        });
    }

    public static function design(): array
    {
        return Cache::rememberForever('zoe.site.design', function () {
            $stored = SiteSetting::query()->where('key', 'design')->first()?->value;

            return NormalizeDesign::run(is_array($stored) ? $stored : []);
        });
    }

    public static function flush(): void
    {
        foreach (self::KEYS as $key) {
            Cache::forget($key);
        }
        SiteVersion::bump();
    }
}
