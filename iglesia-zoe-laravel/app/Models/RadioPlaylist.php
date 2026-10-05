<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A playlist of the radio: songs in the order the programmer chose. The automatic music
 * plays one list, or all of them together, in that order or shuffled.
 */
class RadioPlaylist extends UuidModel
{
    protected $fillable = ['name', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(RadioTrack::class, 'radio_playlist_track')
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function payload(): array
    {
        $tracks = $this->relationLoaded('tracks') ? $this->tracks : $this->tracks()->get();
        $playable = $tracks->filter(fn (RadioTrack $track) => $track->active && $track->kind === 'musica');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'tracks' => $tracks->pluck('id')->values(),
            'count' => $playable->count(),
            'seconds' => (int) round($playable->sum('duration')),
        ];
    }
}
