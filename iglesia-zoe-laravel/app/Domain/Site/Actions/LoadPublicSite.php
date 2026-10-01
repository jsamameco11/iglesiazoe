<?php

namespace App\Domain\Site\Actions;

use App\Models\Ministry;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Cache;

class LoadPublicSite
{
    private const KEYS = ['zoe.site.settings', 'zoe.site.ministries', 'zoe.site.media', 'zoe.site.design', 'zoe.site.notice'];

    private const LIST_SETTINGS = ['values', 'prayerTopics'];

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

            return self::normalizeDesign(is_array($stored) ? $stored : []);
        });
    }

    public static function normalizeDesign(array $input): array
    {
        $defaults = config('design.defaults');
        $fonts = array_column(config('design.fonts'), 'name');
        $pages = array_keys(config('design.pages'));
        $color = fn ($value) => is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtolower($value) : '';
        $font = fn ($value, $fallback = '') => in_array($value, $fonts, true) ? $value : $fallback;
        $scale = fn ($value, $fallback = 1) => is_numeric($value) ? round(max(0.75, min(1.4, (float) $value)), 2) : $fallback;

        $palette = [];
        foreach (array_keys($defaults['palette']) as $key) {
            $value = $color($input['palette'][$key] ?? '');
            $palette[$key] = $value !== '' ? $value : $defaults['palette'][$key];
        }

        $pageRules = [];
        foreach ($pages as $page) {
            $rule = $input['pages'][$page] ?? [];
            if (! is_array($rule)) {
                continue;
            }
            $clean = array_filter([
                'heading' => $font($rule['heading'] ?? ''),
                'text' => $font($rule['text'] ?? ''),
                'titleColor' => $color($rule['titleColor'] ?? ''),
                'textColor' => $color($rule['textColor'] ?? ''),
                'title' => isset($rule['title']) && $rule['title'] !== '' ? $scale($rule['title']) : null,
                'subtitle' => isset($rule['subtitle']) && $rule['subtitle'] !== '' ? $scale($rule['subtitle']) : null,
                'text_size' => isset($rule['text_size']) && $rule['text_size'] !== '' ? $scale($rule['text_size']) : null,
            ], fn ($value) => $value !== '' && $value !== null);
            if ($clean) {
                $pageRules[$page] = $clean;
            }
        }

        return [
            'palette' => $palette,
            'fonts' => [
                'heading' => $font($input['fonts']['heading'] ?? '', $defaults['fonts']['heading']),
                'text' => $font($input['fonts']['text'] ?? '', $defaults['fonts']['text']),
            ],
            'sizes' => [
                'title' => $scale($input['sizes']['title'] ?? 1),
                'subtitle' => $scale($input['sizes']['subtitle'] ?? 1),
                'text' => $scale($input['sizes']['text'] ?? 1),
            ],
            'shape' => in_array($input['shape'] ?? '', ['round', 'soft', 'square'], true) ? $input['shape'] : $defaults['shape'],
            'pages' => $pageRules,
        ];
    }

    public static function fontHref(array $design): string
    {
        $used = [$design['fonts']['heading'], $design['fonts']['text']];
        foreach ($design['pages'] as $rule) {
            $used[] = $rule['heading'] ?? null;
            $used[] = $rule['text'] ?? null;
        }
        $slugs = collect(config('design.fonts'))
            ->whereIn('name', array_filter(array_unique($used)))
            ->reject(fn ($font) => in_array($font['slug'], ['inter', 'cormorant-garamond'], true))
            ->map(fn ($font) => $font['slug'].':400,400i,500,600,700')
            ->values();

        return $slugs->isEmpty() ? '' : 'https://fonts.bunny.net/css?family='.$slugs->implode('|').'&display=swap';
    }

    public static function flush(): void
    {
        foreach (self::KEYS as $key) {
            Cache::forget($key);
        }
    }
}
