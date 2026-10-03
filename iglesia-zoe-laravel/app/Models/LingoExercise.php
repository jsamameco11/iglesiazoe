<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A LINGOBIBLE exercise: "choice" keeps its options and the index of the right one in
 * `answer`; "truefalse" has no options and stores 1 for Verdadero and 0 for Falso.
 */
class LingoExercise extends UuidModel
{
    public const KINDS = ['choice' => 'Opción múltiple', 'truefalse' => 'Verdadero o falso'];

    protected $fillable = ['lingo_lesson_id', 'kind', 'prompt', 'passage_reference', 'passage_text', 'options', 'answer', 'sort_order'];

    protected function casts(): array
    {
        return ['options' => 'array', 'answer' => 'integer', 'sort_order' => 'integer'];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(LingoLesson::class, 'lingo_lesson_id');
    }

    /** What the player sees: the passage and the choices, never the answer. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'prompt' => $this->prompt,
            'passage_reference' => $this->passage_reference,
            'passage_text' => $this->passage_text,
            'options' => $this->kind === 'choice' ? array_values($this->options ?? []) : ['Verdadero', 'Falso'],
        ];
    }

    /** Index of the right choice as the player sees it (Verdadero is 0, Falso is 1). */
    public function rightChoice(): int
    {
        return $this->kind === 'choice' ? $this->answer : ($this->answer === 1 ? 0 : 1);
    }

    /** @return array<string, mixed> */
    public function full(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'prompt' => $this->prompt,
            'passage_reference' => $this->passage_reference,
            'passage_text' => $this->passage_text,
            'options' => array_values($this->options ?? []),
            'answer' => $this->answer,
        ];
    }
}
