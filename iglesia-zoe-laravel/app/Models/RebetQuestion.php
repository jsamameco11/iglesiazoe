<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A REBET question with four options; only the server knows which one is right. */
class RebetQuestion extends UuidModel
{
    public const DIFFICULTIES = ['easy' => 'Fácil', 'medium' => 'Intermedio', 'hard' => 'Difícil', 'expert' => 'Experto'];

    protected $fillable = ['rebet_category_id', 'difficulty', 'question', 'options', 'correct', 'explanation', 'reference', 'time_limit', 'base_points', 'active'];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct' => 'integer',
            'time_limit' => 'integer',
            'base_points' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(RebetCategory::class, 'rebet_category_id');
    }

    /** What a player sees before answering. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'question' => $this->question,
            'options' => array_values($this->options ?? []),
            'difficulty' => $this->difficulty,
            'category' => $this->category?->name,
            'time_limit' => $this->time_limit,
        ];
    }

    /** @return array<string, mixed> */
    public function full(): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->rebet_category_id,
            'difficulty' => $this->difficulty,
            'question' => $this->question,
            'options' => array_values($this->options ?? []),
            'correct' => $this->correct,
            'explanation' => $this->explanation,
            'reference' => $this->reference,
            'time_limit' => $this->time_limit,
            'active' => $this->active,
        ];
    }
}
