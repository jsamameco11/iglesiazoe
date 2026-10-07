<?php

namespace App\Models;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Shared\Models\UuidModel;
use App\Domain\Stream\YouTube\VideoOptions;
use Database\Factories\LiveStreamFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One church broadcast: prepared in the panel (or opened by the signal itself),
 * live while OBS sends, and turned into a teaching when it ends.
 */
class LiveStream extends UuidModel
{
    /** @use HasFactory<LiveStreamFactory> */
    use HasFactory;

    public const OPEN = ['ready', 'live'];

    protected $fillable = [
        'title', 'description', 'preacher', 'kind', 'show_summary', 'to_youtube', 'options', 'cover_path',
        'status', 'quick', 'youtube_id', 'youtube_mode', 'youtube_error', 'segments',
        'signal_at', 'signal_lost_at', 'started_at', 'ended_at', 'end_reason', 'teaching_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'show_summary' => 'boolean',
            'to_youtube' => 'boolean',
            'quick' => 'boolean',
            'options' => 'array',
            'segments' => 'array',
            'signal_at' => 'datetime',
            'signal_lost_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function teaching(): BelongsTo
    {
        return $this->belongsTo(Teaching::class);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(LiveRecording::class)->orderBy('part');
    }

    /** The broadcast the next signal belongs to: the one on air, otherwise the latest prepared one. */
    public static function current(): ?self
    {
        return self::query()->where('status', 'live')->latest('started_at')->first()
            ?? self::query()->where('status', 'ready')->latest('created_at')->first();
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN, true);
    }

    /** The signal is arriving right now. */
    public function hasSignal(): bool
    {
        return $this->status === 'live' && $this->signal_at !== null && $this->signal_lost_at === null;
    }

    public function option(string $key): mixed
    {
        return ($this->options ?? [])[$key] ?? VideoOptions::DEFAULTS[$key] ?? null;
    }

    /** YouTube video viewers can watch: only when the broadcast went out on the church channel and is not private. */
    public function publicYoutubeId(): ?string
    {
        return $this->to_youtube && $this->youtube_id && $this->option('privacy') !== 'private' ? $this->youtube_id : null;
    }

    public function coverUrl(): ?string
    {
        return $this->cover_path ?: null;
    }

    /** Segments the media server wrote, in recording order. */
    public function segmentFiles(): array
    {
        return array_values(array_filter((array) ($this->segments ?? []), 'is_string'));
    }

    public function adminPayload(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => (string) $this->description,
            'preacher' => (string) $this->preacher,
            'kind' => $this->kind,
            'show_summary' => $this->show_summary,
            'to_youtube' => $this->to_youtube,
            'options' => VideoOptions::fill($this->options ?? []),
            'cover' => $this->coverUrl(),
            'status' => $this->status,
            'quick' => $this->quick,
            'youtube_id' => $this->youtube_id,
            'youtube_mode' => $this->youtube_mode,
            'youtube_error' => $this->youtube_error,
            'signal' => $this->hasSignal(),
            'signal_at' => $this->signal_at?->toIso8601String(),
            'signal_lost_at' => $this->signal_lost_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'end_reason' => $this->end_reason,
            'teaching_id' => $this->teaching_id,
            'segments' => count($this->segmentFiles()),
            'recordings' => $this->relationLoaded('recordings') ? $this->recordings->map->adminPayload()->values()->all() : [],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    public function deleteCover(): void
    {
        MediaLibrary::deletePublic($this->cover_path);
    }
}
