<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Database\Factories\PastEventFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/** An event that already happened, shown in «Conoce más de nuestros eventos anteriores» and linked to its post. */
class PastEvent extends UuidModel
{
    /** @use HasFactory<PastEventFactory> */
    use HasFactory;

    /** Networks a past event may link to, keyed by the hosts of their posts and short links. */
    public const PLATFORMS = [
        'instagram' => ['instagram.com', 'instagr.am'],
        'facebook' => ['facebook.com', 'fb.com', 'fb.watch', 'fb.me'],
        'tiktok' => ['tiktok.com'],
        'youtube' => ['youtube.com', 'youtu.be'],
    ];

    protected $fillable = ['title', 'held_on', 'image_path', 'url', 'active'];

    protected function casts(): array
    {
        return [
            'held_on' => 'date',
            'active' => 'boolean',
        ];
    }

    /** Published past events, most recent first. */
    public static function published(): Builder
    {
        return self::query()->where('active', true)->orderByDesc('held_on')->orderByDesc('created_at');
    }

    /** The network a link belongs to, or null when it is not one of the supported ones. */
    public static function platformOf(?string $url): ?string
    {
        $host = strtolower((string) parse_url((string) $url, PHP_URL_HOST));
        if (! str_starts_with(strtolower((string) $url), 'https://') || $host === '') {
            return null;
        }
        foreach (self::PLATFORMS as $platform => $hosts) {
            foreach ($hosts as $known) {
                if ($host === $known || str_ends_with($host, '.'.$known)) {
                    return $platform;
                }
            }
        }

        return null;
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'held_on' => $this->held_on?->toDateString(),
            'image' => $this->image_path,
            'url' => $this->url,
            'platform' => self::platformOf($this->url),
            'active' => $this->active,
        ];
    }
}
