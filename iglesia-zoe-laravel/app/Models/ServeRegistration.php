<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class ServeRegistration extends UuidModel
{
    protected $fillable = ['serve_area_id', 'area_name', 'team', 'first_name', 'last_name', 'full_name', 'age', 'marital_status', 'phone', 'email', 'notes'];

    protected function casts(): array
    {
        return ['age' => 'integer'];
    }
}
