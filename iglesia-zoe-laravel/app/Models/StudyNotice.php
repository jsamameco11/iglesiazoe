<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;

class StudyNotice extends UuidModel
{
    public const TONES = ['aviso' => 'Aviso', 'importante' => 'Importante', 'celebracion' => 'Celebración'];

    protected $fillable = ['study_level_id', 'title', 'body', 'tone', 'starts_on', 'ends_on', 'active'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'active' => 'boolean',
        ];
    }

    /** Notices a student sees today (Lima time): published, within their dates, newest first. */
    public static function visible(): Builder
    {
        $today = now(StudyLevel::TIMEZONE)->toDateString();

        return self::query()->where('active', true)
            ->where(fn ($query) => $query->whereNull('starts_on')->orWhereDate('starts_on', '<=', $today))
            ->where(fn ($query) => $query->whereNull('ends_on')->orWhereDate('ends_on', '>=', $today))
            ->orderByDesc('starts_on')
            ->orderByDesc('created_at');
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'level_id' => $this->study_level_id,
            'title' => $this->title,
            'body' => $this->body,
            'tone' => $this->tone,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
            'published_at' => ($this->starts_on ?? $this->created_at)?->toDateString(),
            'active' => $this->active,
        ];
    }
}
