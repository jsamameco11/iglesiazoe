<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** Shared helpers of the panel pages that edit the Bible games. */
abstract class GameContentController extends Controller
{
    /**
     * Validates a form with Spanish messages; answers the first error when it fails.
     *
     * @param  array<string, mixed>  $rules
     * @param  array<string, string>  $names
     * @return array<string, mixed>|JsonResponse
     */
    protected function check(Request $request, array $rules, array $names): array|JsonResponse
    {
        $validator = Validator::make($request->all(), $rules, [
            'required' => 'Completa el campo :attribute.',
            'min' => 'El campo :attribute es muy corto.',
            'max' => 'El campo :attribute es demasiado largo.',
            'integer' => 'Revisa el campo :attribute.',
            'in' => 'Elige una opción válida en :attribute.',
            'array' => 'Revisa el campo :attribute.',
            'between' => 'Revisa el campo :attribute.',
        ], $names);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        return array_map(fn ($value) => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value, $validator->validated());
    }

    /** Moves a record one place up or down among its siblings and renumbers them. */
    protected function move(Builder $siblings, mixed $id, string $direction): JsonResponse
    {
        $ids = $siblings->orderBy('sort_order')->orderBy('created_at')->pluck('id')->all();
        $from = array_search($id, $ids, true);
        $to = $from === false ? false : $from + ($direction === 'up' ? -1 : 1);
        if ($from !== false && isset($ids[$to])) {
            [$ids[$from], $ids[$to]] = [$ids[$to], $ids[$from]];
        }
        $model = $siblings->getModel();
        foreach ($ids as $order => $key) {
            $model->newQuery()->whereKey($key)->update(['sort_order' => $order + 1]);
        }

        return $this->saved();
    }

    /** Position for a new record: after the last of its siblings. */
    protected function nextOrder(Builder $siblings): int
    {
        return ((int) $siblings->max('sort_order')) + 1;
    }

    /**
     * The non-empty lines of a list field, trimmed.
     *
     * @return list<string>
     */
    protected function lines(mixed $values): array
    {
        return array_values(array_filter(array_map(fn ($value) => is_string($value) ? trim($value) : '', (array) $values), fn (string $value) => $value !== ''));
    }
}
