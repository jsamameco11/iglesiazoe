<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Original-quality copy of a broadcast on Wasabi, kept a few days only to download it for editing. */
class LiveRecording extends UuidModel
{
    protected $fillable = ['live_stream_id', 'part', 'path', 'name', 'size', 'duration_seconds', 'status', 'error', 'expires_at'];

    protected function casts(): array
    {
        return [
            'part' => 'integer',
            'size' => 'integer',
            'duration_seconds' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function liveStream(): BelongsTo
    {
        return $this->belongsTo(LiveStream::class);
    }

    public function downloadable(): bool
    {
        return $this->status === 'ready' && $this->path !== null && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function adminPayload(): array
    {
        return [
            'id' => $this->id,
            'part' => $this->part,
            'name' => $this->name,
            'size' => $this->size,
            'duration' => $this->duration_seconds,
            'status' => $this->downloadable() || $this->status !== 'ready' ? $this->status : 'expired',
            'error' => $this->error,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'download' => $this->downloadable() ? '/admin/transmision/grabacion/'.$this->id : null,
        ];
    }
}
