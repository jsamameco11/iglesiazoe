<?php

namespace App\Models;

use App\Domain\Radio\Spotify;
use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;

/**
 * A Christian playlist on Spotify kept in the panel as a reference for choosing the radio's songs.
 * It never plays on the radio: Spotify only allows personal listening, so listeners hear the library.
 */
class RadioSpotifyPlaylist extends UuidModel
{
    protected $fillable = ['spotify_id', 'name', 'description', 'cover_url', 'published', 'sort_order'];

    protected function casts(): array
    {
        return [
            'published' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return Builder<self> */
    public static function ordered(): Builder
    {
        return self::query()->orderBy('sort_order')->orderBy('created_at');
    }

    /** Name, cover and links of a list for the panel. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'cover' => $this->cover_url,
            'url' => Spotify::url($this->spotify_id),
            'embed' => Spotify::embed($this->spotify_id),
        ];
    }

    /** @return array<string, mixed> */
    public function full(): array
    {
        return [...$this->card(), 'spotify_id' => $this->spotify_id];
    }
}
