<?php

namespace App\Domain\Access;

use App\Models\Cell;
use App\Models\Network;
use App\Models\User;

/**
 * What part of the cell structure an account reaches. A Servidor de Red works
 * on its whole network; a servidor works on its own cell and its servidores
 * hijo; a servidor hijo works on its own cell only.
 */
class CellScope
{
    public const NONE = '00000000-0000-0000-0000-000000000000';

    private ?array $networkCells = null;

    private ?array $ownTree = null;

    private function __construct(
        public readonly User $user,
        public readonly ?Network $network,
        public readonly array $own,
    ) {}

    public static function for(User $user): self
    {
        return new self(
            $user,
            $user->network_id ? Network::query()->find($user->network_id) : null,
            $user->cells()->pluck('cells.id')->all(),
        );
    }

    public function seesAll(): bool
    {
        return Permissions::isSuperadmin($this->user) || Permissions::has($this->user, 'reports.all');
    }

    /**
     * Network-level accounts: the superadmin, Servidor de Red accounts and
     * administrators without cells of their own. Without a network they reach
     * every network.
     */
    public function leadsNetwork(): bool
    {
        if (Permissions::isSuperadmin($this->user)) {
            return true;
        }
        $types = Permissions::cleanTypes(is_array($this->user->admin_types) ? $this->user->admin_types : []);

        return in_array('red', $types, true) || (! $this->own && ! in_array('celula', $types, true));
    }

    /** Cells whose reports the user can read; null means every cell. */
    public function viewCellIds(): ?array
    {
        if ($this->seesAll()) {
            return null;
        }
        if ($this->leadsNetwork()) {
            return array_values(array_unique([...$this->networkCellIds(), ...$this->own]));
        }

        return $this->ownTree();
    }

    /** Cells the user can file reports for; null means every cell. */
    public function submitCellIds(): ?array
    {
        if (Permissions::isSuperadmin($this->user)) {
            return null;
        }
        if (Permissions::has($this->user, 'reports.all')) {
            return $this->network ? array_values(array_unique([...$this->networkCellIds(), ...$this->own])) : null;
        }

        return $this->own;
    }

    /** Networks where the user may open servidores; null means every network. */
    public function manageNetworkIds(): ?array
    {
        if (Permissions::isSuperadmin($this->user)) {
            return null;
        }
        if (! $this->leadsNetwork()) {
            return [];
        }

        return $this->network ? [$this->network->id] : null;
    }

    /** Cells shown in the user's server tree; null means every cell. */
    public function treeCellIds(): ?array
    {
        if (! $this->leadsNetwork()) {
            return $this->ownTree();
        }

        return $this->manageNetworkIds() === null ? null : $this->networkCellIds();
    }

    public function canOpenServerIn(string $networkId): bool
    {
        $allowed = $this->manageNetworkIds();

        return $allowed === null || in_array($networkId, $allowed, true);
    }

    /** The Servidor de Red oversees every cell of its network; a servidor oversees its servidores hijo. */
    public function oversees(Cell $cell): bool
    {
        return $this->leadsNetwork()
            ? $this->canOpenServerIn($cell->network_id)
            : $cell->parent_id !== null && in_array($cell->parent_id, $this->own, true);
    }

    /** Servidores hijo hang from a servidor's cell, never from another servidor hijo. */
    public function canAddChildTo(Cell $parent): bool
    {
        return $parent->parent_id === null
            && ($this->oversees($parent) || in_array($parent->id, $this->own, true));
    }

    public function reaches(Cell $cell): bool
    {
        $ids = $this->treeCellIds();

        return $ids === null || in_array($cell->id, $ids, true);
    }

    private function networkCellIds(): array
    {
        if (! $this->network) {
            return [];
        }

        return $this->networkCells ??= Cell::query()->where('network_id', $this->network->id)->pluck('id')->all();
    }

    private function ownTree(): array
    {
        return $this->ownTree ??= array_values(array_unique([
            ...$this->own,
            ...Cell::query()->whereIn('parent_id', $this->own ?: [self::NONE])->pluck('id')->all(),
        ]));
    }
}
