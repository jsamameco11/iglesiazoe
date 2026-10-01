<?php

namespace App\Domain\Site\Actions;

use Illuminate\Http\Request;

class ResolveSiteSkin
{
    public static function fromRequest(Request $request, bool $forceMarea = false): string
    {
        if ($forceMarea || $request->is('marea') || $request->is('marea/*')) {
            return 'marea';
        }

        $hosts = collect([
            $request->header('x-forwarded-host'),
            $request->getHost(),
        ])->flatMap(fn ($value) => explode(',', (string) $value))
            ->map(fn ($value) => strtolower(trim($value)))
            ->filter();

        return $hosts->contains(fn ($host) => str_starts_with($host, 'iglesiacristianazoe2.') || str_contains($host, 'iglesiacristianazoe2.'))
            ? 'marea'
            : 'aire';
    }
}
