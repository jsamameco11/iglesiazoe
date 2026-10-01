<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class Sermon extends UuidModel
{
    protected $fillable = ['title', 'preacher', 'series', 'sermon_date', 'youtube_id', 'is_live', 'published'];

    protected function casts(): array
    {
        return [
            'is_live' => 'boolean',
            'published' => 'boolean',
            'sermon_date' => 'date',
        ];
    }
}
