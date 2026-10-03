<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A theme of secret words for El Cristiano Oculto. */
class OcultoCategory extends UuidModel
{
    protected $fillable = ['slug', 'name', 'sort_order', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'sort_order' => 'integer'];
    }

    public function words(): HasMany
    {
        return $this->hasMany(OcultoWord::class);
    }

    /** @return Builder<self> */
    public static function ordered(): Builder
    {
        return self::query()->orderBy('sort_order')->orderBy('name');
    }
}
