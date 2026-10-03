<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A LINGOBIBLE path (La salvación, Jesús, Pablo…) made of units and lessons. */
class LingoPath extends UuidModel
{
    protected $fillable = ['slug', 'title', 'description', 'sort_order', 'published'];

    protected function casts(): array
    {
        return ['published' => 'boolean', 'sort_order' => 'integer'];
    }

    public function units(): HasMany
    {
        return $this->hasMany(LingoUnit::class)->orderBy('sort_order');
    }

    /** @return Builder<self> */
    public static function ordered(): Builder
    {
        return self::query()->orderBy('sort_order')->orderBy('title');
    }
}
