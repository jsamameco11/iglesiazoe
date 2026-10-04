<?php

namespace App\Models;

use App\Domain\Radio\Spotify;
use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;

/**
 * A Christian playlist on Spotify the admin can choose as the automatic music (when published).
 * Then each listener's page plays it in Spotify's own player, in its order and without letting
 * the listener pick songs (Spotify only allows personal listening, so the station sends no audio).
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

    /** What the radio shows of a list while it plays. */
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
        return [...$this->card(), 'spotify_id' => $this->spotify_id, 'published' => $this->published];
    }
}
