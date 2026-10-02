<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

class ServeRegistration extends UuidModel
{
    /** Follow-up of each person, in the order the coordinator moves them. */
    public const STATUSES = [
        'pendiente' => 'Pendiente',
        'contactado' => 'Contactado',
        'integrado' => 'Integrado al equipo',
    ];

    protected $fillable = ['serve_area_id', 'area_name', 'team', 'first_name', 'last_name', 'full_name', 'age', 'marital_status', 'phone', 'email', 'notes', 'status', 'status_at', 'status_by'];

    protected function casts(): array
    {
        return ['age' => 'integer', 'status_at' => 'datetime'];
    }
}
