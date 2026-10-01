<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Report extends UuidModel
{
    protected $fillable = [
        'cell_id', 'user_id', 'year', 'week', 'met', 'reason', 'meeting_date', 'start_time',
        'end_time', 'modality', 'theme_id', 'theme_title', 'praise_minutes', 'had_prayer',
        'prayer_notes', 'teaching_minutes', 'salvations', 'spirit_baptisms', 'reconciled',
        'offering', 'offering_minutes', 'families', 'guests', 'testimonies',
    ];

    protected function casts(): array
    {
        return [
            'met' => 'boolean',
            'had_prayer' => 'boolean',
            'meeting_date' => 'date',
            'offering' => 'decimal:2',
        ];
    }

    public function cell(): BelongsTo
    {
        return $this->belongsTo(Cell::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(ReportAttendance::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ReportPhoto::class);
    }
}
