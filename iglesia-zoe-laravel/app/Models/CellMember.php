<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class CellMember extends UuidModel
{
    protected $fillable = ['cell_id', 'full_name', 'phone', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
