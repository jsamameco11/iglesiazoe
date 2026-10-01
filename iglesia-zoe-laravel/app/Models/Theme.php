<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class Theme extends UuidModel
{
    protected $fillable = ['title', 'audience', 'theme_date', 'file_path', 'active'];

    protected function casts(): array
    {
        return [
            'theme_date' => 'date',
            'active' => 'boolean',
        ];
    }
}
