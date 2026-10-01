<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class ReportAttendance extends UuidModel
{
    protected $table = 'report_attendance';

    protected $fillable = ['report_id', 'member_id', 'member_name', 'attended', 'tithe'];

    protected function casts(): array
    {
        return [
            'attended' => 'boolean',
            'tithe' => 'decimal:2',
        ];
    }
}
