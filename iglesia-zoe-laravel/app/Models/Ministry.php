<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class Ministry extends UuidModel
{
    protected $fillable = ['slug', 'name', 'age_range', 'summary', 'body', 'sort_order', 'accent', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
