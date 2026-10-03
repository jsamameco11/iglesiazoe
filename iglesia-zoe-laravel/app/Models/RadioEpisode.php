<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A recorded program published on /radio so people can listen to it whenever they want.
 *
 * The audio lives in the library: deleting it there removes the episode too.
 */
class RadioEpisode extends UuidModel
{
    protected $fillable = ['radio_track_id', 'title', 'program', 'description', 'cover_path', 'aired_on', 'published'];

    protected function casts(): array
    {
        return [
            'aired_on' => 'date',
            'published' => 'boolean',
        ];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(RadioTrack::class, 'radio_track_id');
    }

    /** Visible on /radio, newest first. */
    public static function published(): Builder
    {
        return self::query()->where('published', true)->with('track')->orderByDesc('aired_on')->orderByDesc('created_at');
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'program' => $this->program,
            'description' => $this->description,
            'cover' => $this->cover_path,
            'src' => $this->track?->file_path,
            'duration' => $this->track?->duration ?? 0,
            'aired_on' => $this->aired_on->toDateString(),
        ];
    }

    public function full(): array
    {
        return [
            ...$this->card(),
            'track_id' => $this->radio_track_id,
            'track_title' => $this->track?->title,
            'published' => $this->published,
        ];
    }
}
