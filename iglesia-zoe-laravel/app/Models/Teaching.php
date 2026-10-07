<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A message of the church: the recorded sermon (its YouTube video) or a downloadable
 * file. A video teaching only reaches the site once it has a YouTube link that is not private.
 */
class Teaching extends UuidModel
{
    public const KINDS = ['predica', 'gc'];

    protected $fillable = [
        'title', 'kind', 'teaching_date', 'summary', 'file_path', 'youtube_id', 'active',
        'preacher', 'show_summary', 'source', 'youtube_privacy', 'youtube_status', 'youtube_progress', 'youtube_error',
        'youtube_options', 'upload_path', 'cover_path', 'duration_seconds', 'live_stream_id',
    ];

    protected function casts(): array
    {
        return [
            'teaching_date' => 'date',
            'active' => 'boolean',
            'show_summary' => 'boolean',
            'youtube_progress' => 'integer',
            'youtube_options' => 'array',
            'duration_seconds' => 'integer',
        ];
    }

    public function liveStream(): BelongsTo
    {
        return $this->belongsTo(LiveStream::class);
    }

    /** @param  Builder<Teaching>  $query */
    public function scopeOnSite(Builder $query): void
    {
        $query->where('active', true)->where(function (Builder $query) {
            $query->whereNotNull('file_path')->orWhere(function (Builder $query) {
                $query->whereNotNull('youtube_id')
                    ->where(fn (Builder $query) => $query->whereNull('youtube_privacy')->orWhere('youtube_privacy', '!=', 'private'))
                    ->where(fn (Builder $query) => $query->whereNull('youtube_status')->orWhere('youtube_status', '!=', 'failed'));
            });
        });
    }

    public function hasPublicVideo(): bool
    {
        return $this->youtube_id !== null && $this->youtube_privacy !== 'private' && $this->youtube_status !== 'failed';
    }

    public function isOnSite(): bool
    {
        return $this->active && ($this->file_path !== null || $this->hasPublicVideo());
    }

    /** What the public Enseñanzas page shows. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'kind' => $this->kind,
            'teaching_date' => $this->teaching_date?->toDateString(),
            'summary' => $this->show_summary ? $this->summary : null,
            'preacher' => $this->preacher,
            'file_url' => $this->file_path,
            'file_type' => $this->file_path ? strtoupper(pathinfo($this->file_path, PATHINFO_EXTENSION)) : null,
            'youtube_id' => $this->hasPublicVideo() ? $this->youtube_id : null,
            'cover' => $this->cover_path,
            'duration' => $this->duration_seconds,
            'from_live' => $this->source === 'live',
        ];
    }

    /** Everything the panel needs, including why a teaching is not on the site yet. */
    public function adminPayload(): array
    {
        $recordings = $this->liveStream?->recordings ?? collect();

        return [
            ...$this->card(),
            'summary' => (string) $this->summary,
            'show_summary' => $this->show_summary,
            'youtube_id' => $this->youtube_id,
            'youtube_privacy' => $this->youtube_privacy,
            'youtube_status' => $this->youtube_status,
            'youtube_progress' => $this->youtube_progress,
            'youtube_error' => $this->youtube_error,
            'youtube_options' => $this->youtube_options,
            'active' => $this->active,
            'on_site' => $this->isOnSite(),
            'source' => $this->source,
            'pending_upload' => $this->upload_path !== null,
            'live_stream_id' => $this->live_stream_id,
            'recordings' => $recordings->map->adminPayload()->values()->all(),
        ];
    }
}
