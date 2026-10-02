<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class Devotional extends UuidModel
{
    protected $fillable = ['slug', 'title', 'verse_ref', 'verse_text', 'body', 'author', 'publish_on', 'image_path', 'active'];

    protected function casts(): array
    {
        return [
            'publish_on' => 'date',
            'active' => 'boolean',
        ];
    }

    /** Visible devotionals whose date has arrived (Lima time), newest first. */
    public static function published(): Builder
    {
        return self::query()->where('active', true)
            ->whereDate('publish_on', '<=', now('America/Lima')->toDateString())
            ->orderByDesc('publish_on')->orderByDesc('created_at');
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'verse_ref' => $this->verse_ref,
            'verse_text' => $this->verse_text,
            'excerpt' => Str::limit(trim(preg_replace('/\s+/', ' ', $this->body)), 180),
            'author' => $this->author,
            'publish_on' => $this->publish_on?->toDateString(),
            'image' => $this->image_path,
            'minutes' => max(1, (int) ceil(count(preg_split('/\s+/u', trim($this->body), -1, PREG_SPLIT_NO_EMPTY)) / 200)),
            'active' => $this->active,
        ];
    }

    public function full(): array
    {
        return [...$this->card(), 'body' => $this->body];
    }
}
