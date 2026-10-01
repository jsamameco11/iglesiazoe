<?php

namespace App\Domain\Access;

use App\Models\Cell;
use App\Models\Network;
use App\Models\User;

class CellScope
{
    public const NONE = '00000000-0000-0000-0000-000000000000';

    private ?array $networkCells = null;

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

    /** Cells whose reports the user can read; null means every cell. */
    public function viewCellIds(): ?array
    {
        if ($this->seesAll()) {
            return null;
        }

        return array_values(array_unique([...$this->networkCellIds(), ...$this->own]));
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

    /** Networks where the user may open cells; null means every network. */
    public function manageNetworkIds(): ?array
    {
        if (Permissions::isSuperadmin($this->user) || ! $this->network) {
            return null;
        }

        return [$this->network->id];
    }

    private function networkCellIds(): array
    {
        if (! $this->network) {
            return [];
        }

        return $this->networkCells ??= Cell::query()->where('network_id', $this->network->id)->pluck('id')->all();
    }
}
