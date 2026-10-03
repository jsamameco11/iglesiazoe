<?php

namespace App\Domain\Servers;

use App\Domain\Access\Permissions;
use App\Models\Cell;

/**
 * The three tiers of the cell structure: the Servidor de Red oversees a
 * network, each servidor leads a root cell of that network (01A) and each
 * servidor hijo leads a cell under a servidor (0101A). A Servidor de Red who
 * also leads a cell may hold it under the network letter alone (A).
 */
enum ServerLevel: string
{
    case Red = 'red';
    case Servidor = 'servidor';
    case Hijo = 'hijo';

    public static function ofCell(Cell $cell): self
    {
        return match (true) {
            $cell->parent_id !== null => self::Hijo,
            $cell->isNetworkCell() => self::Red,
            default => self::Servidor,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Red => 'Servidor de Red',
            self::Servidor => 'Servidor',
            self::Hijo => 'Servidor hijo',
        };
    }

    public function accountTypes(): array
    {
        return $this === self::Red ? ['red'] : ['celula'];
    }

    public function accountPermissions(): array
    {
        return match ($this) {
            self::Red => Permissions::forTypes(['red']),
            self::Servidor => Permissions::clean(Permissions::SERVER_ACCOUNT),
            self::Hijo => Permissions::clean(Permissions::CHILD_SERVER_ACCOUNT),
        };
    }
}
