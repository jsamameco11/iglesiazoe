<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class PrayerRequest extends UuidModel
{
    protected $fillable = ['full_name', 'first_name', 'last_name', 'age', 'marital_status', 'phone', 'email', 'topic', 'request', 'on_air'];

    protected function casts(): array
    {
        return [
            'age' => 'integer',
            'on_air' => 'boolean',
        ];
    }
}
