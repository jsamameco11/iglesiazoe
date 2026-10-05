<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A music genre (musical style) of the radio library. A song carries up to four, in order;
 * the aliases are the names music databases give it, so tags found on the internet land here.
 */
class RadioGenre extends UuidModel
{
    protected $fillable = ['name', 'slug', 'family', 'aliases', 'sort_order', 'custom'];

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'sort_order' => 'integer',
            'custom' => 'boolean',
        ];
    }

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(RadioTrack::class, 'radio_genre_track');
    }

    public function artists(): BelongsToMany
    {
        return $this->belongsToMany(RadioArtist::class, 'radio_artist_genre');
    }

    /** @return array{id: string, name: string, family: string} */
    public function brief(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'family' => $this->family];
    }
}
