<?php

namespace App\Domain\Stream\Jobs;

use App\Domain\Stream\TeachingVideos;
use App\Models\Teaching;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/** Uploads a teaching's video to the church channel and saves the link it gets. */
class PublishTeachingVideo implements ShouldQueue
{
    use Queueable;

    public int $timeout = 5 * 3600;

    public int $tries = 1;

    public function __construct(public string $teachingId, public ?string $recordingId = null) {}

    public function handle(): void
    {
        TeachingVideos::send($this->teachingId, $this->recordingId);
    }

    public function failed(?Throwable $error): void
    {
        $teaching = Teaching::query()->whereKey($this->teachingId)->where('youtube_status', 'uploading')->first();
        $teaching?->update($teaching->youtube_id
            ? ['youtube_status' => 'ready', 'youtube_error' => 'La subida del video editado se interrumpió. Sigue publicado el video anterior.']
            : ['youtube_status' => 'failed', 'youtube_error' => 'La subida a YouTube se interrumpió. Vuelve a publicarla.']);
    }
}
