<?php

namespace App\Domain\Site\Actions;

use App\Domain\Media\Support\HotMedia;
use App\Domain\Site\Design\NormalizeDesign;
use App\Domain\Site\Support\SiteVersion;
use App\Models\Ministry;
use App\Models\ServeArea;
use App\Models\SitePage;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;

use function Illuminate\Support\defer;

class LoadPublicSite
{
    private const KEYS = ['zoe.site.settings', 'zoe.site.ministries', 'zoe.site.serve', 'zoe.site.media', 'zoe.site.design', 'zoe.site.notice', 'zoe.site.pages'];

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

    /**
     * Every public page in menu order with the names stored in the admin, falling back to the
     * catalog default for a page or section the database does not have yet.
     *
     * @return list<array{key: string, parent: ?string, path: string, name: string, note: string, kicker: string, sections: list<array{key: string, name: string}>}>
     */
    public static function pages(): array
    {
        return Cache::rememberForever('zoe.site.pages', function () {
            $stored = SitePage::query()->with('sections')->get()->keyBy('key');

            return collect(config('zoe.pages'))->map(function (array $page) use ($stored) {
                $row = $stored->get($page['key']);
                $sectionNames = $row?->sections->pluck('name', 'key') ?? collect();

                return [
                    'key' => $page['key'],
                    'parent' => $page['parent'] ?? null,
                    'path' => $page['path'],
                    'name' => $row?->name ?? $page['name'],
                    'note' => $row?->note ?? ($page['note'] ?? ''),
                    'kicker' => $row?->kicker ?? ($page['kicker'] ?? ''),
                    'sections' => collect($page['sections'] ?? [])
                        ->map(fn (array $section) => ['key' => $section['key'], 'name' => $sectionNames->get($section['key']) ?? $section['name']])
                        ->all(),
                ];
            })->values()->all();
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

    /** Forgets the cached site and, after answering, brings the web server's copy of the home media up to date. */
    public static function flush(): void
    {
        foreach (self::KEYS as $key) {
            Cache::forget($key);
        }
        SiteVersion::bump();
        defer(fn () => HotMedia::sync(), 'zoe.hot.sync');
    }
}
