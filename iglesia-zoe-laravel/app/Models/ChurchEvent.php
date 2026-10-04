<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Database\Factories\ChurchEventFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChurchEvent extends UuidModel
{
    /** @use HasFactory<ChurchEventFactory> */
    use HasFactory;

    protected $fillable = ['title', 'starts_on', 'ends_on', 'time_label', 'location', 'summary', 'body', 'image_path', 'cta_label', 'cta_url', 'active'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'active' => 'boolean',
        ];
    }

    /** Published events that have not finished yet (Lima time), soonest first. */
    public static function upcoming(): Builder
    {
        $today = now('America/Lima')->toDateString();

        return self::query()->where('active', true)
            ->where(fn ($query) => $query->whereDate('starts_on', '>=', $today)->orWhereDate('ends_on', '>=', $today))
            ->orderBy('starts_on');
    }

    /** Published events of this month onward (Lima time), for the calendar of /eventos. */
    public static function calendar(): Builder
    {
        $monthStart = now('America/Lima')->startOfMonth()->toDateString();

        return self::query()->where('active', true)
            ->where(fn ($query) => $query->whereDate('starts_on', '>=', $monthStart)->orWhereDate('ends_on', '>=', $monthStart))
            ->orderBy('starts_on');
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
            'time_label' => $this->time_label,
            'location' => $this->location,
            'summary' => $this->summary,
            'body' => $this->body,
            'image' => $this->image_path,
            'cta_label' => $this->cta_label,
            'cta_url' => $this->cta_url,
            'active' => $this->active,
        ];
    }
}
