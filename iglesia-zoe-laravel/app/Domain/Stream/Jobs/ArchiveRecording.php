<?php

namespace App\Domain\Stream\Jobs;

use App\Domain\Stream\Recordings;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Joins a finished broadcast's recording and stores it on Wasabi for a few days. */
class ArchiveRecording implements ShouldQueue
{
    use Queueable;

    public int $timeout = 5 * 3600;

    public int $tries = 1;

    /** @param  list<string>|null  $files  only these segments; all pending ones when null */
    public function __construct(public string $liveStreamId, public ?array $files = null) {}

    public function handle(): void
    {
        Recordings::archive($this->liveStreamId, $this->files);
    }
}
