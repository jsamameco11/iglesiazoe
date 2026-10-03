<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LingoLesson extends UuidModel
{
    protected $fillable = ['lingo_unit_id', 'title', 'xp', 'sort_order', 'published'];

    protected function casts(): array
    {
        return ['xp' => 'integer', 'sort_order' => 'integer', 'published' => 'boolean'];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(LingoUnit::class, 'lingo_unit_id');
    }

    public function exercises(): HasMany
    {
        return $this->hasMany(LingoExercise::class)->orderBy('sort_order');
    }
}
