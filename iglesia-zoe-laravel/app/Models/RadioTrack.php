<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** An audio file of the radio library: a song, an announcement, a sound effect or a recorded program. */
class RadioTrack extends UuidModel
{
    public const KINDS = [
        'musica' => 'Música',
        'anuncio' => 'Anuncio',
        'efecto' => 'Efecto · cortina',
        'programa' => 'Programa grabado',
    ];

    protected $fillable = ['kind', 'title', 'artist', 'file_path', 'duration', 'rotation', 'active'];

    protected function casts(): array
    {
        return [
            'duration' => 'float',
            'rotation' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function slots(): HasMany
    {
        return $this->hasMany(RadioSlot::class);
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
            'active' => $this->active,
        ];
    }
}
