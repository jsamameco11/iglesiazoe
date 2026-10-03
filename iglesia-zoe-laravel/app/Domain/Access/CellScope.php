<?php

namespace App\Domain\Access;

use App\Domain\Servers\ServerLevel;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;

/**
 * What part of the cell structure an account reaches. A Servidor de Red works
 * on its whole network; a Servidor Base, hijo or subhijo works on its own cell
 * and follows the cells below it.
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
        $types = Permissions::typesOf($this->user);

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

    /**
     * Cells the user can file reports for; null means every cell. Everyone
     * files for their own cells; filing for the servidores below them needs
     * «reports.delegate», which the superadmin grants account by account.
     */
    public function submitCellIds(): ?array
    {
        if (Permissions::isSuperadmin($this->user)) {
            return null;
        }
        if (! Permissions::has($this->user, 'reports.delegate')) {
            return $this->own;
        }
        if (! $this->leadsNetwork()) {
            return $this->ownTree();
        }

        return $this->network ? array_values(array_unique([...$this->networkCellIds(), ...$this->own])) : null;
    }

    /** Networks the user oversees; null means every network. */
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

    public function managesNetwork(string $networkId): bool
    {
        $allowed = $this->manageNetworkIds();

        return $allowed === null || in_array($networkId, $allowed, true);
    }

    public function canOpenServerIn(string $networkId): bool
    {
        return Permissions::has($this->user, 'servers.create') && $this->managesNetwork($networkId);
    }

    /** The cell the Servidor de Red leads himself, if he opened one in his network. */
    public function ownCell(): ?Cell
    {
        if (! $this->network || ! $this->own) {
            return null;
        }

        return Cell::query()->whereIn('id', $this->own)->where('network_id', $this->network->id)->whereNull('parent_id')->orderBy('number')->first();
    }

    /** A Servidor de Red who leads a cell opens it himself, once, inside his network. */
    public function canOpenOwnCell(): bool
    {
        return ! Permissions::isSuperadmin($this->user)
            && Permissions::has($this->user, 'cells.own')
            && $this->leadsNetwork()
            && $this->network !== null
            && $this->ownCell() === null;
    }

    /**
     * Only network-level accounts (Servidor de Red, administrators, the
     * superadmin) work on servers; cell servers never open nor manage them.
     */
    public function oversees(Cell $cell): bool
    {
        return $this->leadsNetwork() && $this->managesNetwork($cell->network_id);
    }

    /**
     * Servidores hijo hang from a Servidor Base and servidores subhijo from a
     * servidor hijo; a subhijo and the Servidor de Red's own cell (A) have none.
     */
    public function canAddChildTo(Cell $parent): bool
    {
        return Permissions::has($this->user, 'servers.children')
            && ServerLevel::ofCell($parent)->child() !== null
            && $this->oversees($parent);
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

    /** The user's own cells and every cell below them: hijos and subhijos. */
    private function ownTree(): array
    {
        if ($this->ownTree !== null) {
            return $this->ownTree;
        }
        $tree = $this->own;
        $level = $this->own;
        for ($depth = 0; $level && $depth < 3; $depth++) {
            $level = array_values(array_diff(Cell::query()->whereIn('parent_id', $level)->pluck('id')->all(), $tree));
            $tree = [...$tree, ...$level];
        }

        return $this->ownTree = array_values(array_unique($tree));
    }
}
