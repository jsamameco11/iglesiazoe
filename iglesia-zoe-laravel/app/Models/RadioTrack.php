<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
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

    protected $fillable = ['kind', 'title', 'artist', 'file_path', 'duration', 'rotation', 'duck', 'active'];

    protected function casts(): array
    {
        return [
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

    public function payload(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'artist' => $this->artist,
            'src' => $this->file_path,
            'duration' => $this->duration,
            'rotation' => $this->rotation,
            'duck' => $this->duck,
            'active' => $this->active,
            'problem' => $this->file_problem,
        ];
    }
}
