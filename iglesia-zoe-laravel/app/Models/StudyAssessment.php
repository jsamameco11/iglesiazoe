<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyAssessment extends UuidModel
{
    protected $fillable = ['study_level_id', 'title', 'week', 'sort_order'];

    protected function casts(): array
    {
        return [
            'week' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(StudyLevel::class, 'study_level_id');
    }

    public function grades(): HasMany
    {
        return $this->hasMany(StudyGrade::class);
    }
}
