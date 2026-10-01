<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BaptismEvent extends UuidModel
{
    protected $fillable = ['event_date', 'location', 'notes', 'active'];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'active' => 'boolean',
        ];
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(BaptismRegistration::class, 'event_id');
    }
}
