<?php

namespace App\Domain\Servers\Actions;

use App\Domain\Cells\Support\CellCodes;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Opens the cell a server leads: without a parent it is a Servidor Base of the
 * network (01A), under a Servidor Base a servidor hijo (0101A) and under a
 * servidor hijo a servidor subhijo (020101A).
 */
final class OpenServer
{
    public function __construct(private readonly CreateServerAccount $accounts) {}

    /** @return array{0: Cell, 1: ?User} */
    public function handle(Network $network, ?Cell $parent, array $data, User $creator): array
    {
        return DB::transaction(function () use ($network, $parent, $data, $creator) {
            $number = self::nextNumber($network, $parent);
            $cell = Cell::query()->create([
                'network_id' => $network->id,
                'parent_id' => $parent?->id,
                'number' => $number,
                'code' => $parent ? CellCodes::daughter($parent->code, $number) : CellCodes::root($network->code, $number),
                'leader_name' => $data['leader_name'],
                'meeting_day' => $data['meeting_day'] ?? null,
                'meeting_time' => $data['meeting_time'] ?? null,
                'active' => true,
            ]);
            $account = filled($data['username'] ?? null) ? $this->accounts->forCell($cell, $data, $creator) : null;

            return [$cell, $account];
        });
    }

    public static function nextNumber(Network $network, ?Cell $parent): int
    {
        return (int) Cell::query()
            ->where('network_id', $network->id)
            ->when($parent, fn ($query) => $query->where('parent_id', $parent->id), fn ($query) => $query->whereNull('parent_id'))
            ->max('number') + 1;
    }
}
