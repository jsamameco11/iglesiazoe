<?php

namespace App\Domain\Servers;

use App\Domain\Access\Permissions;
use App\Models\Cell;

/**
 * The four tiers of the cell structure, each code prefixing its parent's:
 * the Servidor de Red oversees a network (H), each Servidor Base leads a root
 * cell of it (01H), each Servidor hijo leads a cell under a Servidor Base
 * (0101H) and each Servidor subhijo a cell under a Servidor hijo (020101H).
 * A Servidor de Red who also leads a cell may hold it under the letter alone.
 */
enum ServerLevel: string
{
    case Red = 'red';
    case Servidor = 'servidor';
    case Hijo = 'hijo';
    case Subhijo = 'subhijo';

    public static function ofCell(Cell $cell): self
    {
        return self::tryFrom((string) $cell->level) ?? self::compute($cell);
    }

    /** Level from the place of the cell in the tree. */
    public static function compute(Cell $cell): self
    {
        if ($cell->parent_id === null) {
            return $cell->isNetworkCell() ? self::Red : self::Servidor;
        }
        $parent = Cell::query()->find($cell->parent_id);

        return $parent && $parent->parent_id !== null ? self::Subhijo : self::Hijo;
    }

    public function label(): string
    {
        return match ($this) {
            self::Red => 'Servidor de Red',
            self::Servidor => 'Servidor Base',
            self::Hijo => 'Servidor hijo',
            self::Subhijo => 'Servidor subhijo',
        };
    }

    /** The level of the servers opened under this one, if any. */
    public function child(): ?self
    {
        return match ($this) {
            self::Servidor => self::Hijo,
            self::Hijo => self::Subhijo,
            default => null,
        };
    }

    public function accountTypes(): array
    {
        return $this === self::Red ? ['red'] : ['celula'];
    }

    public function accountPermissions(): array
    {
        return $this === self::Red
            ? Permissions::forTypes(['red'])
            : Permissions::clean(Permissions::SERVER_ACCOUNT);
    }
}
