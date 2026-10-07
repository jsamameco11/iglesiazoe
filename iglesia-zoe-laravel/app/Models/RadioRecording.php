<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One live transmission captured from the console, until it becomes a library audio or is discarded. */
class RadioRecording extends UuidModel
{
    protected $fillable = [
        'user_id', 'session', 'status', 'path', 'extension', 'mime', 'bytes', 'parts', 'duration', 'started_at', 'finished_at', 'radio_track_id',
    ];

    protected function casts(): array
    {
        return [
            'bytes' => 'integer',
            'parts' => 'integer',
            'duration' => 'float',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(RadioTrack::class, 'radio_track_id');
    }

    public function brief(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'bytes' => $this->bytes,
            'duration' => $this->duration,
            'parts' => $this->parts,
        ];
    }
}
