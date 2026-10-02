<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One block of the radio timeline: a library track or a live segment, at an exact time (stored in UTC). */
class RadioSlot extends UuidModel
{
    public const LIVE = 'vivo';

    /** Blocks chain one after another, so start times keep their milliseconds. */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected $fillable = ['starts_at', 'duration', 'kind', 'radio_track_id', 'title', 'note', 'bed'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'duration' => 'float',
            'bed' => 'boolean',
        ];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(RadioTrack::class, 'radio_track_id');
    }

    public function endsAt(): CarbonImmutable
    {
        return $this->starts_at->addMilliseconds((int) round($this->duration * 1000));
    }
}
