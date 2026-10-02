<?php

namespace App\Domain\Site\Design;

/**
 * Turns whatever the editor (or an older saved version) sends into a design the site can trust:
 * known fonts, #rrggbb colors, clamped scales, known pages and illustrations only.
 */
class NormalizeDesign
{
    public const ROLES = ['heading', 'text', 'accent'];

    private const SECTION_LIMIT = 40;

    private const KEY = '/^[a-z0-9][a-z0-9-]{0,39}$/';

    public static function run(array $input): array
    {
        $defaults = config('design.defaults');
        $fonts = self::fonts($input['fonts'] ?? [], $defaults['fonts']);

        return [
            'palette' => self::palette($input['palette'] ?? [], $defaults['palette']),
            'fonts' => $fonts,
            'sizes' => [
                'title' => self::scale($input['sizes']['title'] ?? null) ?? 1,
                'subtitle' => self::scale($input['sizes']['subtitle'] ?? null) ?? 1,
                'text' => self::scale($input['sizes']['text'] ?? null) ?? 1,
            ],
            'shape' => in_array($input['shape'] ?? '', ['round', 'soft', 'square'], true) ? $input['shape'] : $defaults['shape'],
            'pages' => self::pages(is_array($input['pages'] ?? null) ? $input['pages'] : [], $fonts),
            'art' => self::art(is_array($input['art'] ?? null) ? $input['art'] : []),
        ];
    }

    /** Stylesheet URL for the chosen families that do not ship with the site. */
    public static function fontHref(array $design): string
    {
        $slugs = collect($design['fonts'] ?? [])
            ->reject(fn ($font) => ! is_array($font) || ($font['local'] ?? false))
            ->map(fn ($font) => $font['slug'].':400,400i,500,600,700')
            ->unique()
            ->values();

        return $slugs->isEmpty() ? '' : 'https://fonts.bunny.net/css?family='.$slugs->implode('|').'&display=swap';
    }

    private static function palette(mixed $input, array $defaults): array
    {
        $palette = [];
        foreach ($defaults as $key => $fallback) {
            $palette[$key] = self::color(is_array($input) ? ($input[$key] ?? null) : null) ?: $fallback;
        }

        return $palette;
    }

    private static function fonts(mixed $input, array $defaults): array
    {
        $catalog = collect(config('design.fonts'))->keyBy('name');
        $fonts = [];
        foreach (self::ROLES as $role) {
            $value = is_array($input) ? ($input[$role] ?? null) : null;
            $name = is_array($value) ? ($value['name'] ?? null) : $value;
            $font = is_string($name) ? $catalog->get($name) : null;
            $fonts[$role] = self::font($font ?? $catalog->get($defaults[$role]));
        }

        return $fonts;
    }

    private static function font(array $font): array
    {
        return ['name' => $font['name'], 'slug' => $font['slug'], 'kind' => $font['kind'], 'local' => (bool) ($font['local'] ?? false)];
    }

    private static function pages(array $input, array $fonts): array
    {
        $known = config('design.pages');
        $rules = [];
        foreach (config('design.legacy_pages') as $legacy => $targets) {
            if (is_array($input[$legacy] ?? null) && ! isset($known[$legacy])) {
                foreach ($targets as $target) {
                    $input[$target] ??= $input[$legacy];
                }
            }
        }
        foreach (array_keys($known) as $page) {
            $rule = is_array($input[$page] ?? null) ? self::pageRule($input[$page], $fonts) : [];
            if ($rule) {
                $rules[$page] = $rule;
            }
        }

        return $rules;
    }

    private static function pageRule(array $rule, array $fonts): array
    {
        $clean = self::sectionRule([
            ...$rule,
            'titleFont' => $rule['titleFont'] ?? self::roleOf($rule['heading'] ?? null, $fonts),
            'textFont' => $rule['textFont'] ?? self::roleOf($rule['text'] ?? null, $fonts),
            'hidden' => false,
        ]);
        foreach (['subtitle', 'text_size'] as $key) {
            if (($value = self::scale($rule[$key] ?? null)) !== null) {
                $clean[$key] = $value;
            }
        }
        $sections = [];
        foreach (is_array($rule['sections'] ?? null) ? $rule['sections'] : [] as $key => $section) {
            if (count($sections) >= self::SECTION_LIMIT) {
                break;
            }
            if (is_string($key) && preg_match(self::KEY, $key) && is_array($section) && ($section = self::sectionRule($section))) {
                $sections[$key] = $section;
            }
        }
        if ($sections) {
            $clean['sections'] = $sections;
        }

        return $clean;
    }

    private static function sectionRule(array $rule): array
    {
        $clean = [];
        foreach (['background', 'titleColor', 'textColor', 'accentColor'] as $key) {
            if ($color = self::color($rule[$key] ?? null)) {
                $clean[$key] = $color;
            }
        }
        foreach (['titleFont', 'textFont'] as $key) {
            if (in_array($rule[$key] ?? null, self::ROLES, true)) {
                $clean[$key] = $rule[$key];
            }
        }
        if (($title = self::scale($rule['title'] ?? null)) !== null) {
            $clean['title'] = $title;
        }
        if (($rule['hidden'] ?? false) === true) {
            $clean['hidden'] = true;
        }

        return $clean;
    }

    private static function art(array $input): array
    {
        $rules = [];
        foreach (config('design.art') as $key => $spec) {
            $rule = is_array($input[$key] ?? null) ? $input[$key] : [];
            $clean = [];
            if ($spec['can_hide'] && ($rule['hidden'] ?? false) === true) {
                $clean['hidden'] = true;
            }
            if (($rule['still'] ?? false) === true) {
                $clean['still'] = true;
            }
            if (is_numeric($rule['speed'] ?? null) && ($speed = round(max(0.25, min(3, (float) $rule['speed'])), 2)) !== 1.0) {
                $clean['speed'] = $speed;
            }
            $colors = [];
            foreach (array_keys($spec['colors']) as $slot) {
                if ($color = self::color($rule['colors'][$slot] ?? null)) {
                    $colors[$slot] = $color;
                }
            }
            if ($colors) {
                $clean['colors'] = $colors;
            }
            if ($clean) {
                $rules[$key] = $clean;
            }
        }

        return $rules;
    }

    private static function roleOf(mixed $name, array $fonts): ?string
    {
        foreach ($fonts as $role => $font) {
            if (is_string($name) && $name === $font['name']) {
                return $role;
            }
        }

        return null;
    }

    private static function color(mixed $value): string
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtolower($value) : '';
    }

    private static function scale(mixed $value): ?float
    {
        return is_numeric($value) ? round(max(0.75, min(1.4, (float) $value)), 2) : null;
    }
}
