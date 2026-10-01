<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Network extends UuidModel
{
    protected $fillable = ['code', 'name'];

    public function cells(): HasMany
    {
        return $this->hasMany(Cell::class);
    }
}
