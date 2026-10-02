<?php

namespace App\Domain\Inbox;

/**
 * Network that receives a person who writes from the web, by age and marital status:
 * RED H under 17, RED K from 17 to 28, RED I singles from 29 and married people
 * from 29 to 43; everyone else goes to the rest of the networks.
 */
final class NetworkRoute
{
    public const SINGLE = 'Soltero(a)';

    public const MARRIED = 'Casado(a)';

    public const ROUTES = [
        'H' => ['label' => 'RED H', 'color' => '#E8711F'],
        'K' => ['label' => 'RED K', 'color' => '#2F9E5B'],
        'I' => ['label' => 'RED I', 'color' => '#E0609A'],
        'resto' => ['label' => 'RESTO DE REDES', 'color' => null],
    ];

    /** Colors drawn for "Resto de redes"; none of them looks like H, K or I. */
    private const DRAW = ['#3F6FD8', '#7A55C7', '#178C99', '#B38A12', '#56657A', '#8C5A3C', '#2E4C8F', '#9A3F5C'];

    public static function key(?int $age, ?string $maritalStatus): string
    {
        if ($age === null) {
            return 'resto';
        }

        return match (true) {
            $age < 17 => 'H',
            $age < 29 => 'K',
            $maritalStatus === self::SINGLE => 'I',
            $maritalStatus === self::MARRIED && $age <= 43 => 'I',
            default => 'resto',
        };
    }

    /**
     * @return array{key: string, label: string, color: string}
     */
    public static function for(?int $age, ?string $maritalStatus, string $seed): array
    {
        $key = self::key($age, $maritalStatus);
        $route = self::ROUTES[$key];

        return [
            'key' => $key,
            'label' => $route['label'],
            'color' => $route['color'] ?? self::DRAW[crc32($seed) % count(self::DRAW)],
        ];
    }

    /**
     * @return list<array{key: string, label: string, color: string|null}>
     */
    public static function catalog(): array
    {
        return collect(self::ROUTES)->map(fn ($route, $key) => ['key' => $key, ...$route])->values()->all();
    }
}
