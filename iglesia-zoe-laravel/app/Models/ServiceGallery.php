<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;

/** Photo album of a Sunday, midweek or special service, published under Recursos · Galería de cultos. */
class ServiceGallery extends UuidModel
{
    public const KINDS = ['dominical', 'media-semana', 'especial'];

    public const MAX_PHOTOS = 150;

    protected $fillable = ['slug', 'title', 'kind', 'service_date', 'summary', 'photos', 'active'];

    protected function casts(): array
    {
        return [
            'service_date' => 'date',
            'photos' => 'array',
            'active' => 'boolean',
        ];
    }

    /** Visible albums, newest service first; callers skip the ones still without photos. */
    public static function published(): Builder
    {
        return self::query()->where('active', true)->orderByDesc('service_date')->orderByDesc('created_at');
    }

    /** @return list<string> */
    public function photoList(): array
    {
        return array_values(array_filter($this->photos ?? [], 'is_string'));
    }

    public function card(): array
    {
        $photos = $this->photoList();

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'kind' => $this->kind,
            'service_date' => $this->service_date?->toDateString(),
            'summary' => $this->summary,
            'cover' => $photos[0] ?? null,
            'count' => count($photos),
            'active' => $this->active,
        ];
    }

    public function full(): array
    {
        return [...$this->card(), 'photos' => $this->photoList()];
    }
}
