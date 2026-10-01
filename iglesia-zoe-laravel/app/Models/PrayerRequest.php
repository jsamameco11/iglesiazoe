<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class PrayerRequest extends UuidModel
{
    protected $fillable = ['full_name', 'phone', 'email', 'topic', 'request'];
}
