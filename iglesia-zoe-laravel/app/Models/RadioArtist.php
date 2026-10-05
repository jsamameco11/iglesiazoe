<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A singer or group the radio library knows: its other spellings, whether it is a soloist or a
 * group, its country and the genres it is known for, which classify its songs when they are uploaded.
 *
 * It comes from the starting catalog, is learned when a song of it is saved, or is added by hand.
 */
class RadioArtist extends UuidModel
{
    public const SOURCES = ['catalogo' => 'Catálogo inicial', 'aprendido' => 'Aprendido al subir', 'manual' => 'Agregado a mano'];

    protected $fillable = ['name', 'slug', 'aliases', 'kind', 'country', 'convert', 'source', 'musicbrainz_id'];

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'convert' => 'boolean',
        ];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(RadioGenre::class, 'radio_artist_genre')
            ->withPivot('position')
            ->orderByPivot('position');
    }
}
