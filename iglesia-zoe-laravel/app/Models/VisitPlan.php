<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class VisitPlan extends UuidModel
{
    protected $fillable = [
        'full_name', 'first_name', 'last_name', 'phone_code', 'phone', 'email', 'sex', 'age', 'marital_status',
        'country_code', 'region', 'city', 'district', 'visit_date', 'service', 'adults', 'children', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'age' => 'integer',
            'adults' => 'integer',
            'children' => 'integer',
        ];
    }
}
