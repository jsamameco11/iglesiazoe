<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Database\Factories\SermonFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Sermon extends UuidModel
{
    /** @use HasFactory<SermonFactory> */
    use HasFactory;

    protected $fillable = [
        'title', 'preacher', 'series', 'sermon_date', 'youtube_id', 'published',
        'description', 'duration', 'views', 'aired_at', 'thumbnail', 'channel',
        'youtube_title', 'title_locked', 'source', 'pending', 'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'published' => 'boolean',
            'sermon_date' => 'date',
            'duration' => 'integer',
            'views' => 'integer',
            'aired_at' => 'datetime',
            'title_locked' => 'boolean',
            'pending' => 'boolean',
            'synced_at' => 'datetime',
        ];
    }

    /** @param  Builder<Sermon>  $query */
    public function scopeOnSite(Builder $query): void
    {
        $query->where('published', true)->where('pending', false)
            ->orderByDesc('sermon_date')->orderByDesc('aired_at')->orderByDesc('created_at');
    }

    public function fromChannel(): bool
    {
        return $this->source === 'youtube';
    }

    /** What the public site shows: the video the way YouTube presents it. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'preacher' => $this->preacher,
            'series' => $this->series,
            'sermon_date' => $this->sermon_date?->toDateString(),
            'youtube_id' => $this->youtube_id,
            'description' => $this->description,
            'duration' => $this->duration,
            'views' => $this->views,
            'aired_at' => $this->aired_at?->toIso8601String(),
            'thumbnail' => $this->thumbnail,
            'channel' => $this->channel,
        ];
    }

    /** Everything the panel edits, plus where the sermon came from. */
    public function adminPayload(): array
    {
        return [
            ...$this->card(),
            'published' => $this->published,
            'pending' => $this->pending,
            'source' => $this->source,
            'youtube_title' => $this->youtube_title,
            'title_locked' => $this->title_locked,
            'synced_at' => $this->synced_at?->toIso8601String(),
        ];
    }
}
