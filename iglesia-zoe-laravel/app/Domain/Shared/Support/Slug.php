<?php

namespace App\Domain\Shared\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

final class Slug
{
    /**
     * Web address of a record built from its text, numbered (-2, -3…) when another record already uses it.
     *
     * @param  class-string<Model>  $model
     */
    public static function unique(string $model, string $text, string $fallback, int $length = 120, ?string $ignore = null): string
    {
        $base = Str::limit(Str::slug($text), $length, '') ?: $fallback;
        $slug = $base;
        for ($n = 2; $model::query()->where('slug', $slug)->when($ignore, fn ($query) => $query->whereKeyNot($ignore))->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }
}
