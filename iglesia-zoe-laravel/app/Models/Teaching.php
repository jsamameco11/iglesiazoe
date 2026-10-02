<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class Teaching extends UuidModel
{
    public const KINDS = ['predica', 'gc'];

    protected $fillable = ['title', 'kind', 'teaching_date', 'summary', 'file_path', 'youtube_id', 'active'];

    protected function casts(): array
    {
        return [
            'teaching_date' => 'date',
            'active' => 'boolean',
        ];
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'kind' => $this->kind,
            'teaching_date' => $this->teaching_date?->toDateString(),
            'summary' => $this->summary,
            'file_url' => $this->file_path,
            'file_type' => $this->file_path ? strtoupper(pathinfo($this->file_path, PATHINFO_EXTENSION)) : null,
            'youtube_id' => $this->youtube_id,
            'active' => $this->active,
        ];
    }
}
