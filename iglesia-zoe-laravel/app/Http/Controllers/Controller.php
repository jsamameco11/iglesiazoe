<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

abstract class Controller
{
    /** Reply of a panel action that worked; the page reloads its data and shows the message. */
    protected function saved(?string $message = null): JsonResponse
    {
        return response()->json(['ok' => true, 'reload' => true] + ($message === null ? [] : ['message' => $message]));
    }

    protected function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['error' => $message], $status);
    }

    /**
     * Looks a record up by the UUID a form sent; anything else finds nothing.
     *
     * @template T of Model
     *
     * @param  class-string<T>  $model
     * @return T|null
     */
    protected function find(string $model, mixed $id): ?Model
    {
        return is_string($id) && Str::isUuid($id) ? $model::query()->find($id) : null;
    }

    /** The UUIDs of a list a form sent, in their order; anything else is dropped. */
    protected function uuids(mixed $values): Collection
    {
        return collect((array) $values)->filter(fn ($id) => is_string($id) && Str::isUuid($id))->values();
    }
}
