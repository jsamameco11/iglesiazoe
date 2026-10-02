<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class StudyReading extends UuidModel
{
    protected $fillable = ['study_level_id', 'title', 'summary', 'week', 'file_path', 'active'];

    protected function casts(): array
    {
        return [
            'week' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'level_id' => $this->study_level_id,
            'title' => $this->title,
            'summary' => $this->summary,
            'week' => $this->week,
            'file_url' => $this->file_path,
            'active' => $this->active,
        ];
    }
}
