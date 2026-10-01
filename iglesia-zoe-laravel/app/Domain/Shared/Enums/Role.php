<?php

namespace App\Domain\Shared\Enums;

enum Role: string
{
    case Superadmin = 'superadmin';
    case Admin = 'admin';
    case RedLeader = 'red_leader';
    case CellLeader = 'cell_leader';

    public function isSuperadmin(): bool
    {
        return $this === self::Superadmin;
    }
}
