<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class PrayerRequest extends UuidModel
{
    public const TOPICS = ['Salud', 'Familia', 'Trabajo y finanzas', 'Vida espiritual', 'Estudios', 'Gratitud', 'Otro'];

    protected $fillable = ['full_name', 'phone', 'email', 'topic', 'request'];
}
