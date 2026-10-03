<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LingoUnit extends UuidModel
{
    protected $fillable = ['lingo_path_id', 'title', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function path(): BelongsTo
    {
        return $this->belongsTo(LingoPath::class, 'lingo_path_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(LingoLesson::class)->orderBy('sort_order');
    }
}
