<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An audio file of the radio library: a song, an announcement, a sound effect or a recorded program.
 *
 * The library only stores audio: nothing sounds until it is placed on the timeline, chosen for
 * the continuous music or fired from the console.
 */
class RadioTrack extends UuidModel
{
    public const KINDS = [
        'musica' => 'Música',
        'anuncio' => 'Anuncio',
        'efecto' => 'Efecto · cortina',
        'programa' => 'Programa grabado',
    ];

    /** Kinds that lower the music underneath by default when they play on top of it. */
    public const DUCK_BY_DEFAULT = ['anuncio', 'programa'];

    /** Co-authors a song credits besides its main author. */
    public const MAX_FEATURED = 4;

    /** Genres (musical styles) a song carries, in order. */
    public const MAX_GENRES = 4;

    protected $fillable = ['kind', 'title', 'artist', 'featured', 'album', 'year', 'file_path', 'cover_path', 'identity', 'identified_at', 'duration', 'rotation', 'duck', 'active'];

    protected function casts(): array
    {
        return [
            'featured' => 'array',
            'identity' => 'array',
            'identified_at' => 'datetime',
            'year' => 'integer',
            'duration' => 'float',
            'rotation' => 'boolean',
            'duck' => 'boolean',
            'active' => 'boolean',
            'file_checked_at' => 'datetime',
            'file_problem_at' => 'datetime',
        ];
    }

    /** A new file starts with a clean health record (see RadioHealth). */
    protected static function booted(): void
    {
        static::saving(function (RadioTrack $track) {
            if ($track->exists && $track->isDirty('file_path')) {
                $track->forceFill(['file_checked_at' => null, 'file_problem' => null, 'file_problem_at' => null]);
            }
        });
    }

    public function slots(): HasMany
    {
        return $this->hasMany(RadioSlot::class);
    }

    public function episodes(): HasMany
    {
        return $this->hasMany(RadioEpisode::class);
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(RadioGenre::class, 'radio_genre_track')
            ->withPivot('position')
            ->orderByPivot('position');
    }

    /** The author followed by the co-authors, as listeners read it: «Marcos Witt, Danilo Montero». */
    public function credit(): ?string
    {
        $names = array_values(array_filter([$this->artist, ...($this->featured ?? [])]));

        return $names ? implode(', ', $names) : null;
    }

    public function payload(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'artist' => $this->artist,
            'featured' => $this->featured ?? [],
            'album' => $this->album,
            'genres' => $this->relationLoaded('genres') ? $this->genres->map->brief()->values()->all() : [],
            'year' => $this->year,
            'cover' => $this->cover_path,
            'src' => $this->file_path,
            'duration' => $this->duration,
            'rotation' => $this->rotation,
            'duck' => $this->duck,
            'active' => $this->active,
            'problem' => $this->file_problem,
        ];
    }
}
