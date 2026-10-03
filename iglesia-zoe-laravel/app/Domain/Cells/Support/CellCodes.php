<?php

namespace App\Domain\Cells\Support;

class CellCodes
{
    public static function network(string $network): string
    {
        return strtoupper($network);
    }

    public static function root(string $network, int $number): string
    {
        return str_pad((string) $number, 2, '0', STR_PAD_LEFT).strtoupper($network);
    }

    public static function daughter(string $parentCode, int $daughterNumber): string
    {
        return str_pad((string) $daughterNumber, 2, '0', STR_PAD_LEFT).strtoupper($parentCode);
    }
}
