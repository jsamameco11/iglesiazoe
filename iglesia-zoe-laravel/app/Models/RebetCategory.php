<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A theme of REBET questions (Antiguo Testamento, Jesús, Parábolas…). */
class RebetCategory extends UuidModel
{
    protected $fillable = ['slug', 'name', 'sort_order', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'sort_order' => 'integer'];
    }

    public function questions(): HasMany
    {
        return $this->hasMany(RebetQuestion::class);
    }

    /** @return Builder<self> */
    public static function ordered(): Builder
    {
        return self::query()->orderBy('sort_order')->orderBy('name');
    }
}
