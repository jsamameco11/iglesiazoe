<?php

namespace App\Domain\Stream\YouTube;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The details YouTube Studio asks for when a video or a live stream goes out,
 * normalised once so the panel, the broadcast and the upload all agree.
 */
final class VideoOptions
{
    public const PRIVACY = ['public' => 'Público', 'unlisted' => 'No listado', 'private' => 'Privado'];

    public const CATEGORIES = [
        '29' => 'Organizaciones sin fines de lucro y activismo',
        '22' => 'Personas y blogs',
        '27' => 'Educación',
        '24' => 'Entretenimiento',
        '10' => 'Música',
        '19' => 'Viajes y eventos',
        '25' => 'Noticias y política',
        '26' => 'Consejos y estilo',
    ];

    public const LATENCY = ['normal' => 'Normal · mejor calidad', 'low' => 'Baja', 'ultraLow' => 'Ultrabaja · hasta 1440p'];

    public const LANGUAGES = ['es' => 'Español', 'es-419' => 'Español (Latinoamérica)', 'en' => 'Inglés', 'pt' => 'Portugués'];

    public const LICENSES = ['youtube' => 'Licencia estándar de YouTube', 'creativeCommon' => 'Creative Commons · Atribución'];

    public const DEFAULTS = [
        'privacy' => 'public',
        'category' => '29',
        'tags' => [],
        'kids' => false,
        'language' => 'es',
        'playlist' => '',
        'latency' => 'normal',
        'dvr' => true,
        'embeddable' => true,
        'license' => 'youtube',
        'notify' => true,
        'scheduled_at' => null,
        'publish_at' => null,
    ];

    private const TAGS_LIMIT = 500;

    /** Stored options completed with the defaults, always with the same types. */
    public static function fill(array $options): array
    {
        $options = array_replace(self::DEFAULTS, array_intersect_key($options, self::DEFAULTS));

        return [
            'privacy' => array_key_exists($options['privacy'], self::PRIVACY) ? $options['privacy'] : 'public',
            'category' => array_key_exists((string) $options['category'], self::CATEGORIES) ? (string) $options['category'] : '29',
            'tags' => self::tags($options['tags']),
            'kids' => (bool) $options['kids'],
            'language' => array_key_exists($options['language'], self::LANGUAGES) ? $options['language'] : 'es',
            'playlist' => is_string($options['playlist']) && preg_match('/^[A-Za-z0-9_-]{10,64}$/', $options['playlist']) ? $options['playlist'] : '',
            'latency' => array_key_exists($options['latency'], self::LATENCY) ? $options['latency'] : 'normal',
            'dvr' => (bool) $options['dvr'],
            'embeddable' => (bool) $options['embeddable'],
            'license' => array_key_exists($options['license'], self::LICENSES) ? $options['license'] : 'youtube',
            'notify' => (bool) $options['notify'],
            'scheduled_at' => self::moment($options['scheduled_at']),
            'publish_at' => self::moment($options['publish_at']),
        ];
    }

    /**
     * Options sent by a panel form.
     *
     * @throws ValidationException
     */
    public static function fromInput(array $input): array
    {
        $validator = Validator::make($input, [
            'privacy' => ['required', Rule::in(array_keys(self::PRIVACY))],
            'category' => ['nullable', Rule::in(array_keys(self::CATEGORIES))],
            'tags' => 'nullable|string|max:'.self::TAGS_LIMIT,
            'language' => ['nullable', Rule::in(array_keys(self::LANGUAGES))],
            'playlist' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{10,64}$/'],
            'latency' => ['nullable', Rule::in(array_keys(self::LATENCY))],
            'license' => ['nullable', Rule::in(array_keys(self::LICENSES))],
            'scheduled_at' => 'nullable|date',
            'publish_at' => 'nullable|date|after:now',
        ], [
            'required' => 'Elige la visibilidad del video.',
            'in' => 'Elige una opción válida en :attribute.',
            'max' => 'Las etiquetas no pueden pasar de 500 caracteres en total.',
            'regex' => 'La lista de reproducción elegida no es válida.',
            'date' => 'Elige una fecha y hora válidas.',
            'after' => 'La publicación programada debe ser en el futuro.',
        ], [
            'privacy' => 'visibilidad',
            'category' => 'categoría',
            'language' => 'idioma',
            'latency' => 'latencia',
            'license' => 'licencia',
        ]);
        $validator->validate();

        return self::fill([
            ...array_intersect_key($input, self::DEFAULTS),
            'kids' => filter_var($input['kids'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'dvr' => filter_var($input['dvr'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'embeddable' => filter_var($input['embeddable'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'notify' => filter_var($input['notify'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'playlist' => (string) ($input['playlist'] ?? ''),
        ]);
    }

    /** Lists the panel shows in its selects. */
    public static function catalog(): array
    {
        $pairs = fn (array $list) => collect($list)->map(fn ($label, $value) => ['value' => (string) $value, 'label' => $label])->values()->all();

        return [
            'privacy' => $pairs(self::PRIVACY),
            'categories' => $pairs(self::CATEGORIES),
            'latency' => $pairs(self::LATENCY),
            'languages' => $pairs(self::LANGUAGES),
            'licenses' => $pairs(self::LICENSES),
            'defaults' => self::DEFAULTS,
        ];
    }

    /** "snippet" part of a video or broadcast. */
    public static function snippet(string $title, ?string $description, array $options): array
    {
        $options = self::fill($options);

        return array_filter([
            'title' => self::clean($title, 100) ?: 'Transmisión en vivo',
            'description' => self::clean((string) $description, 5000),
            'tags' => $options['tags'] ?: null,
            'categoryId' => $options['category'],
            'defaultLanguage' => $options['language'],
            'defaultAudioLanguage' => $options['language'],
        ], fn ($value) => $value !== null);
    }

    /** "status" part of an uploaded video; a scheduled publication needs the video to stay private until then. */
    public static function uploadStatus(array $options): array
    {
        $options = self::fill($options);
        $status = [
            'privacyStatus' => $options['publish_at'] ? 'private' : $options['privacy'],
            'selfDeclaredMadeForKids' => $options['kids'],
            'embeddable' => $options['embeddable'],
            'license' => $options['license'],
        ];
        if ($options['publish_at']) {
            $status['publishAt'] = $options['publish_at'];
        }

        return $status;
    }

    /** Privacy the video will end up with once YouTube publishes it. */
    public static function finalPrivacy(array $options): string
    {
        $options = self::fill($options);

        return $options['publish_at'] ? 'public' : $options['privacy'];
    }

    /** Removes what YouTube rejects in titles and descriptions (angle brackets) and trims to its limits. */
    public static function clean(string $text, int $limit): string
    {
        return mb_substr(trim(str_replace(['<', '>'], '', $text)), 0, $limit);
    }

    /** @return list<string> */
    public static function tags(mixed $tags): array
    {
        $list = is_array($tags) ? $tags : explode(',', (string) $tags);
        $clean = [];
        $length = 0;
        foreach ($list as $tag) {
            $tag = trim(str_replace(['<', '>', ','], '', (string) $tag));
            if ($tag === '' || in_array($tag, $clean, true)) {
                continue;
            }
            $length += mb_strlen($tag) + (str_contains($tag, ' ') ? 2 : 0) + ($clean ? 1 : 0);
            if ($length > self::TAGS_LIMIT) {
                break;
            }
            $clean[] = $tag;
        }

        return $clean;
    }

    private static function moment(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return CarbonImmutable::parse($value, 'America/Lima')->utc()->format('Y-m-d\TH:i:s\Z');
        } catch (\Throwable) {
            return null;
        }
    }
}
