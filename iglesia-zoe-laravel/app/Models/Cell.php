<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cell extends UuidModel
{
    public const MEETING_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    protected $fillable = [
        'network_id', 'parent_id', 'number', 'code', 'leader_name', 'assistant_name',
        'host_name', 'address', 'meeting_day', 'meeting_time', 'active',
    ];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_cells');
    }

    public function members(): HasMany
    {
        return $this->hasMany(CellMember::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
