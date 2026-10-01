<?php

namespace App\Domain\Site\Support;

class YouTube
{
    public static function id(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $value)) {
            return $value;
        }
        $patterns = [
            '~youtu\.be/([A-Za-z0-9_-]{11})~',
            '~[?&]v=([A-Za-z0-9_-]{11})~',
            '~youtube(?:-nocookie)?\.com/(?:embed|live|shorts|v)/([A-Za-z0-9_-]{11})~',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value, $match)) {
                return $match[1];
            }
        }

        return null;
    }
}
