<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyGrade extends UuidModel
{
    protected $fillable = ['study_assessment_id', 'study_student_id', 'score'];

    protected function casts(): array
    {
        return [
            'score' => 'float',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(StudyAssessment::class, 'study_assessment_id');
    }
}
