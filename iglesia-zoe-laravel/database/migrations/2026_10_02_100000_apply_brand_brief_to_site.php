<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\Ministry;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const BRIEF_SETTINGS = [
        'heroTitle', 'heroSubtitle', 'visitCta',
        'headingColor', 'bodyColor', 'accentColor', 'paperColor', 'stoneColor', 'clayColor',
    ];

    private const OBSOLETE_SETTINGS = [
        'sermonsCta', 'railTitle', 'railText',
        'ctaVisitTitle', 'ctaVisitText', 'ctaBaptismTitle', 'ctaBaptismText', 'ctaPrayerTitle', 'ctaPrayerText',
        'homeFamilyKicker', 'homeFamilyTitle', 'homeMinistriesTitle', 'pastor',
    ];

    private const OBSOLETE_COPY = [
        'home.scheduleKicker', 'home.scheduleTitleCasa', 'home.scheduleTitleLuz',
        'home.ministriesKicker', 'home.ministriesMore', 'home.giveCardTitle',
    ];

    private const MINISTRY_SLUGS = ['zoe-young' => 'zoe-youth', 'grupos-28' => 'redes-de-discipulado'];

    public function up(): void
    {
        $this->updateSite();
        $this->updateDesign();
        $this->updateMedia();
        $this->updateMinistries();
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        // Content-only migration: the replaced texts are not kept, so it is not reversible.
    }

    private function updateSite(): void
    {
        $site = SiteSetting::query()->find('site');
        if (! $site || ! is_array($site->value)) {
            return;
        }

        $value = $site->value;
        foreach (self::BRIEF_SETTINGS as $key) {
            $value[$key] = config("zoe.settings.$key");
        }
        foreach (self::OBSOLETE_SETTINGS as $key) {
            unset($value[$key]);
        }
        if (isset($value['copy']) && is_array($value['copy'])) {
            foreach (self::OBSOLETE_COPY as $key) {
                unset($value['copy'][$key]);
            }
        }

        $site->value = $value;
        $site->updated_at = now();
        $site->save();
    }

    private function updateDesign(): void
    {
        $design = SiteSetting::query()->find('design');
        if (! $design || ! is_array($design->value)) {
            return;
        }

        $design->value = [...$design->value, 'palette' => config('design.defaults.palette')];
        $design->updated_at = now();
        $design->save();
    }

    private function updateMedia(): void
    {
        $media = SiteSetting::query()->find('media');
        $assets = is_array($media?->value) ? ($media->value['assets'] ?? []) : [];
        if (! $media || ! is_array($assets) || $assets === []) {
            return;
        }

        $next = [];
        foreach ($assets as $key => $asset) {
            if ($key === 'marea-family') {
                $next['home-cells'] ??= $asset;
            } elseif (in_array($key, ['marea-culto', 'marea-ciudad'], true) || preg_match('/^gallery-\d+$/', $key)) {
                continue;
            } elseif (preg_match('/^ministry:([a-z0-9-]+)(:\d+)?$/', $key, $match) && isset(self::MINISTRY_SLUGS[$match[1]])) {
                $next['ministry:'.self::MINISTRY_SLUGS[$match[1]].($match[2] ?? '')] = $asset;
            } else {
                $next[$key] = $asset;
            }
        }

        $media->value = [...$media->value, 'assets' => $next];
        $media->updated_at = now();
        $media->save();
    }

    private function updateMinistries(): void
    {
        foreach (self::MINISTRY_SLUGS as $from => $to) {
            if (! Ministry::query()->where('slug', $to)->exists()) {
                Ministry::query()->where('slug', $from)->update(['slug' => $to]);
            }
        }

        Ministry::query()->whereIn('slug', array_keys(self::MINISTRY_SLUGS))->update(['active' => false]);

        foreach (config('zoe.ministries') as $row) {
            Ministry::query()->updateOrCreate(['slug' => $row['slug']], $row);
        }
    }
};
