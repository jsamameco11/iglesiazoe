<?php

namespace App\Domain\Site\Actions;

use App\Models\SitePage;
use App\Models\SiteSection;

/**
 * Mirrors config('zoe.pages') into site_pages / site_sections: adds the pages and
 * sections the code introduces, drops the ones it retires, refreshes paths, menu
 * groups and order, and never touches a name already stored.
 */
class SyncSitePages
{
    /**
     * @param  array<string, array{name?: string, note?: string, kicker?: string, sections?: array<string, string>}>  $initial  Names for rows created now, keyed by page.
     */
    public static function run(array $initial = []): void
    {
        SitePage::withoutEvents(fn () => SiteSection::withoutEvents(fn () => self::mirror($initial)));
        LoadPublicSite::flush();
    }

    /**
     * @param  array<string, array{name?: string, note?: string, kicker?: string, sections?: array<string, string>}>  $initial
     */
    private static function mirror(array $initial): void
    {
        $pageKeys = [];
        foreach (array_values(config('zoe.pages')) as $order => $page) {
            $pageKeys[] = $page['key'];
            $seed = $initial[$page['key']] ?? [];

            $row = SitePage::query()->firstOrNew(['key' => $page['key']]);
            if (! $row->exists) {
                $row->fill([
                    'name' => $seed['name'] ?? $page['name'],
                    'note' => $seed['note'] ?? ($page['note'] ?? ''),
                    'kicker' => $seed['kicker'] ?? ($page['kicker'] ?? ''),
                ]);
            }
            $row->fill(['parent_key' => $page['parent'] ?? null, 'path' => $page['path'], 'sort_order' => $order + 1])->save();

            $sectionKeys = [];
            foreach (array_values($page['sections'] ?? []) as $sectionOrder => $section) {
                $sectionKeys[] = $section['key'];
                $stored = SiteSection::query()->firstOrNew(['page_key' => $page['key'], 'key' => $section['key']]);
                if (! $stored->exists) {
                    $stored->name = $seed['sections'][$section['key']] ?? $section['name'];
                }
                $stored->fill(['sort_order' => $sectionOrder + 1])->save();
            }
            SiteSection::query()->where('page_key', $page['key'])->whereNotIn('key', $sectionKeys)->delete();
        }

        SiteSection::query()->whereNotIn('page_key', $pageKeys)->delete();
        SitePage::query()->whereNotIn('key', $pageKeys)->delete();
    }
}
