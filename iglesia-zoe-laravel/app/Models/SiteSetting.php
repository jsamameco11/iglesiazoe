<?php

namespace App\Models;

use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected static function booted(): void
    {
        static::saved(fn () => LoadPublicSite::flush());
        static::deleted(fn () => LoadPublicSite::flush());
    }

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = ['key', 'value', 'updated_at'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
            'updated_at' => 'datetime',
        ];
    }
}
