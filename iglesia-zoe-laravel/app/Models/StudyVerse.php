<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class StudyVerse extends UuidModel
{
    protected $fillable = ['study_level_id', 'reference', 'text', 'active'];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'level_id' => $this->study_level_id,
            'reference' => $this->reference,
            'text' => $this->text,
            'active' => $this->active,
        ];
    }
}
