<?php

namespace App\Domain\Servers\Actions;

use App\Domain\Cells\Support\CellCodes;
use App\Models\Cell;
use App\Models\Network;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The cell a Servidor de Red leads himself. He chooses how to hold it:
 * under the network letter alone (H), as the next numbered cell (01H) or by
 * taking a cell of his network that has no account yet.
 */
final class OpenOwnCell
{
    public const NETWORK = 'network';

    public const NUMBERED = 'numbered';

    public const EXISTING = 'existing';

    public const KINDS = [self::NETWORK, self::NUMBERED, self::EXISTING];

    public function handle(User $user, Network $network, string $kind, ?Cell $existing, array $schedule): Cell
    {
        return DB::transaction(function () use ($user, $network, $kind, $existing, $schedule) {
            $cell = match ($kind) {
                self::NETWORK => $this->networkCell($network, $user, $schedule),
                self::NUMBERED => $this->numberedCell($network, $user, $schedule),
                self::EXISTING => $this->take($network, $existing, $user),
            };
            $user->cells()->syncWithoutDetaching([$cell->id]);

            return $cell;
        });
    }

    /** What the «Mi célula» form offers. */
    public static function choices(Network $network): array
    {
        return [
            'network' => self::networkCellTaken($network) ? null : CellCodes::network($network->code),
            'numbered' => CellCodes::root($network->code, OpenServer::nextNumber($network, null)),
            'free' => self::freeCells($network)->map(fn (Cell $cell) => [
                'id' => $cell->id,
                'code' => $cell->code,
                'leader_name' => $cell->leader_name,
            ])->values()->all(),
        ];
    }

    /** Servidor cells of the network nobody signs in for yet. */
    public static function freeCells(Network $network): Collection
    {
        return Cell::query()
            ->where('network_id', $network->id)
            ->whereNull('parent_id')
            ->where('number', '>', Cell::NETWORK_NUMBER)
            ->where('active', true)
            ->whereDoesntHave('users')
            ->orderBy('number')
            ->get();
    }

    private static function networkCellTaken(Network $network): bool
    {
        return Cell::query()->where('network_id', $network->id)->whereNull('parent_id')->where('number', Cell::NETWORK_NUMBER)->exists();
    }

    private function networkCell(Network $network, User $user, array $schedule): Cell
    {
        if (self::networkCellTaken($network)) {
            throw ValidationException::withMessages(['kind' => 'La célula '.CellCodes::network($network->code).' ya existe. Elige otra opción.']);
        }

        return Cell::query()->create([
            'network_id' => $network->id,
            'parent_id' => null,
            'number' => Cell::NETWORK_NUMBER,
            'code' => CellCodes::network($network->code),
            'leader_name' => $user->name,
            ...$schedule,
            'active' => true,
        ]);
    }

    private function numberedCell(Network $network, User $user, array $schedule): Cell
    {
        $number = OpenServer::nextNumber($network, null);

        return Cell::query()->create([
            'network_id' => $network->id,
            'parent_id' => null,
            'number' => $number,
            'code' => CellCodes::root($network->code, $number),
            'leader_name' => $user->name,
            ...$schedule,
            'active' => true,
        ]);
    }

    private function take(Network $network, ?Cell $cell, User $user): Cell
    {
        if (! $cell || ! self::freeCells($network)->contains('id', $cell->id)) {
            throw ValidationException::withMessages(['cell_id' => 'Elige una célula de tu red que todavía no tenga cuenta.']);
        }
        $cell->update(['leader_name' => $user->name]);

        return $cell;
    }
}
