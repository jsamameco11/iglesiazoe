<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class StudyGrade extends UuidModel
{
    protected $fillable = ['study_assessment_id', 'study_student_id', 'score'];

    protected function casts(): array
    {
        return [
            'score' => 'float',
        ];
    }
}
