<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class BaptismRegistration extends UuidModel
{
    protected $fillable = [
        'full_name', 'first_name', 'last_name', 'phone_code', 'phone', 'email',
        'sex', 'age', 'country_code', 'event_id', 'notes',
    ];
}
