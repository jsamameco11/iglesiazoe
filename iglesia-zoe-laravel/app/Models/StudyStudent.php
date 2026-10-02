<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyStudent extends UuidModel
{
    public const STATUSES = ['cursando' => 'Cursando', 'pausado' => 'En pausa', 'egresado' => 'Egresado de la ruta'];

    protected $fillable = ['user_id', 'study_level_id', 'status', 'phone', 'network'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
