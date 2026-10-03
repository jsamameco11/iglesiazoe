<?php

namespace App\Domain\Site\Design;

use App\Domain\Media\Support\MediaLibrary;

/**
 * Turns whatever the editor (or an older saved version) sends into a design the site can trust:
 * known fonts, #rrggbb colors, clamped scales, known pages and illustrations only.
 */
class NormalizeDesign
{
    public const ROLES = ['heading', 'text', 'accent'];

    private const SECTION_LIMIT = 40;

    private const TEXT_LIMIT = 80;

    private const KEY = '/^[a-z0-9][a-z0-9-]{0,39}$/';

    /** Where one text sits: its band ("~" for the page itself), then its place among the children at each level. */
    public const TEXT_PATH = '/^(~|[a-z0-9][a-z0-9-]{0,39}):[1-9][0-9]{0,2}(\.[1-9][0-9]{0,2}){0,15}$/';

    private const ALIGNS = ['left', 'center', 'right'];

    /** How an inline text (a link, a word) becomes its own line so it can be aligned. */
    private const BOXES = ['block', 'flex', 'grid'];

    public const IMAGES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

    public const VIDEOS = ['mp4', 'webm', 'mov'];

    /** Numeric fields of a page or band: [min, max, step]. */
    private const RANGES = [
        'gradient' => [0, 360, 1],
        'imageX' => [0, 100, 1],
        'imageY' => [0, 100, 1],
        'overlay' => [0, 0.85, 0.05],
        'titleWeight' => [100, 900, 100],
        'textWeight' => [100, 900, 100],
        'titleLeading' => [0.8, 1.8, 0.05],
        'textLeading' => [1.1, 2.4, 0.05],
        'titleTracking' => [-0.06, 0.3, 0.005],
        'textTracking' => [-0.03, 0.2, 0.005],
    ];

    /** Typography of the menu bar links and of the options that drop from them: [min, max, step], sizes in px. */
    private const NAV = [
        'size' => [12, 19, 0.5],
        'weight' => [300, 700, 100],
        'dropSize' => [12, 18, 0.5],
        'dropWeight' => [300, 700, 100],
        'tracking' => [-0.03, 0.2, 0.005],
    ];

    public static function run(array $input): array
    {
        $defaults = config('design.defaults');
        $fonts = self::fonts($input['fonts'] ?? [], $defaults['fonts']);
        $nav = self::nav($input['nav'] ?? null);

        return [
            'palette' => self::palette($input['palette'] ?? [], $defaults['palette']),
            'fonts' => $fonts,
            'sizes' => [
                'title' => self::scale($input['sizes']['title'] ?? null) ?? 1,
                'subtitle' => self::scale($input['sizes']['subtitle'] ?? null) ?? 1,
                'text' => self::scale($input['sizes']['text'] ?? null) ?? 1,
            ],
            'shape' => in_array($input['shape'] ?? '', ['round', 'soft', 'square'], true) ? $input['shape'] : $defaults['shape'],
            ...($nav ? ['nav' => $nav] : []),
            'pages' => self::pages(is_array($input['pages'] ?? null) ? $input['pages'] : [], $fonts),
            'art' => self::art(is_array($input['art'] ?? null) ? $input['art'] : []),
        ];
    }

    /** Stylesheet URL for the chosen families that do not ship with the site, including those of single texts. */
    public static function fontHref(array $design): string
    {
        $texts = collect($design['pages'] ?? [])->flatMap(fn ($page) => is_array($page['texts'] ?? null) ? array_column($page['texts'], 'font') : []);
        $slugs = collect($design['fonts'] ?? [])
            ->concat($texts)
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

    private static function nav(mixed $input): array
    {
        if (! is_array($input)) {
            return [];
        }
        $clean = [];
        if (in_array($input['font'] ?? null, self::ROLES, true)) {
            $clean['font'] = $input['font'];
        }
        foreach (self::NAV as $key => [$min, $max, $step]) {
            if (is_numeric($input[$key] ?? null)) {
                $value = round(max($min, min($max, (float) $input[$key])) / $step) * $step;
                $clean[$key] = is_int($step) ? (int) $value : round($value, 3);
            }
        }

        return $clean;
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
        if (($subtitle = self::scale($rule['subtitle'] ?? null)) !== null) {
            $clean['subtitle'] = $subtitle;
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
        if ($texts = self::texts($rule['texts'] ?? null)) {
            $clean['texts'] = $texts;
        }

        return $clean;
    }

    /**
     * Looks of single texts picked in the preview: any catalog font (or one of the three site roles),
     * a size factor, alignment, weight and italics. Unchanged texts keep the page's look.
     *
     * @return array<string, array{font?: string|array{name: string, slug: string, kind: string, local: bool}, size?: float, align?: string, box?: string, weight?: int, italic?: true, label?: string}>
     */
    private static function texts(mixed $input): array
    {
        if (! is_array($input)) {
            return [];
        }
        $catalog = collect(config('design.fonts'))->keyBy('name');
        $texts = [];
        foreach ($input as $path => $rule) {
            if (count($texts) >= self::TEXT_LIMIT) {
                break;
            }
            if (! is_string($path) || ! preg_match(self::TEXT_PATH, $path) || ! is_array($rule)) {
                continue;
            }
            $clean = [];
            $font = $rule['font'] ?? null;
            $name = is_array($font) ? ($font['name'] ?? null) : $font;
            if (in_array($font, self::ROLES, true)) {
                $clean['font'] = $font;
            } elseif (is_string($name) && $catalog->has($name)) {
                $clean['font'] = self::font($catalog->get($name));
            }
            if (is_numeric($rule['size'] ?? null) && ($size = round(round(max(0.5, min(2.5, (float) $rule['size'])) / 0.05) * 0.05, 2)) !== 1.0) {
                $clean['size'] = $size;
            }
            if (in_array($rule['align'] ?? null, self::ALIGNS, true)) {
                $clean['align'] = $rule['align'];
                if (in_array($rule['box'] ?? null, self::BOXES, true)) {
                    $clean['box'] = $rule['box'];
                }
            }
            if (is_numeric($rule['weight'] ?? null)) {
                $clean['weight'] = (int) (round(max(100, min(900, (float) $rule['weight'])) / 100) * 100);
            }
            if (($rule['italic'] ?? false) === true) {
                $clean['italic'] = true;
            }
            if (! $clean) {
                continue;
            }
            $label = is_string($rule['label'] ?? null) ? trim(preg_replace('/\s+/u', ' ', strip_tags($rule['label']))) : '';
            $texts[$path] = $label !== '' ? [...$clean, 'label' => mb_substr($label, 0, 80)] : $clean;
        }

        return $texts;
    }

    private static function sectionRule(array $rule): array
    {
        $clean = [];
        foreach (['background', 'background2', 'overlayColor', 'titleColor', 'textColor', 'accentColor'] as $key) {
            if ($color = self::color($rule[$key] ?? null)) {
                $clean[$key] = $color;
            }
        }
        foreach (['titleFont', 'textFont'] as $key) {
            if (in_array($rule[$key] ?? null, self::ROLES, true)) {
                $clean[$key] = $rule[$key];
            }
        }
        foreach (['title', 'text_size'] as $key) {
            if (($value = self::scale($rule[$key] ?? null)) !== null) {
                $clean[$key] = $value;
            }
        }
        foreach (['image' => self::IMAGES, 'video' => self::VIDEOS] as $key => $extensions) {
            if ($path = self::mediaPath($rule[$key] ?? null, $extensions)) {
                $clean[$key] = $path;
            }
        }
        if (in_array($rule['imageFit'] ?? null, ['cover', 'contain', 'repeat'], true)) {
            $clean['imageFit'] = $rule['imageFit'];
        }
        foreach (self::RANGES as $key => [$min, $max, $step]) {
            if (is_numeric($rule[$key] ?? null)) {
                $value = round(max($min, min($max, (float) $rule[$key])) / $step) * $step;
                $clean[$key] = is_int($step) ? (int) $value : round($value, 3);
            }
        }
        foreach (['fixed', 'titleUpper', 'titleItalic', 'hidden'] as $key) {
            if (($rule[$key] ?? false) === true) {
                $clean[$key] = true;
            }
        }

        return $clean;
    }

    /** Every library file a design paints as a background. */
    public static function files(array $design): array
    {
        $files = [];
        foreach ($design['pages'] ?? [] as $page) {
            foreach ([$page, ...array_values($page['sections'] ?? [])] as $rule) {
                foreach (['image', 'video'] as $key) {
                    if (is_string($rule[$key] ?? null)) {
                        $files[] = $rule[$key];
                    }
                }
            }
        }

        return array_values(array_unique($files));
    }

    private static function mediaPath(mixed $value, array $extensions): string
    {
        $key = is_string($value) ? MediaLibrary::keyOf($value) : null;

        return $key && in_array(strtolower(pathinfo($key, PATHINFO_EXTENSION)), $extensions, true) ? $value : '';
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
