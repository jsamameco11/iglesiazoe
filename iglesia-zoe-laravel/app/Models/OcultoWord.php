<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A secret word of El Cristiano Oculto, with what the faithful players see about it. */
class OcultoWord extends UuidModel
{
    protected $fillable = ['oculto_category_id', 'word', 'description', 'reference', 'clues', 'active'];

    protected function casts(): array
    {
        return ['clues' => 'array', 'active' => 'boolean'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(OcultoCategory::class, 'oculto_category_id');
    }

    /** The card a faithful player opens. */
    public function card(): array
    {
        return [
            'word' => $this->word,
            'description' => $this->description,
            'reference' => $this->reference,
            'clues' => array_values($this->clues ?? []),
            'category' => $this->category?->name,
        ];
    }

    /** @return array<string, mixed> */
    public function full(): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->oculto_category_id,
            'word' => $this->word,
            'description' => $this->description,
            'reference' => $this->reference,
            'clues' => array_values($this->clues ?? []),
            'active' => $this->active,
        ];
    }
}
