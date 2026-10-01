<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class ReportPhoto extends UuidModel
{
    protected $fillable = ['report_id', 'file_path'];
}
