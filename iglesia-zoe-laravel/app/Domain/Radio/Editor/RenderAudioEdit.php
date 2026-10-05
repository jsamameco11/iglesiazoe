<?php

namespace App\Domain\Radio\Editor;

use App\Models\RadioTrack;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Renders an edit and puts it in the library. It runs right after the editor gets its answer,
 * so the admin follows the progress instead of waiting on a request.
 *
 * @phpstan-import-type Recipe from EditRecipe
 */
class RenderAudioEdit implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3 * 3600;

    public int $tries = 1;

    /** @param  Recipe  $recipe */
    public function __construct(public string $trackId, public array $recipe) {}

    public function handle(): void
    {
        $track = RadioTrack::query()->find($this->trackId);
        if (! $track) {
            return;
        }
        try {
            AudioEditor::render($track, $this->recipe);
        } catch (Throwable $error) {
            Log::warning('No se pudo procesar la edición de «'.$track->title.'»: '.$error->getMessage());
            RadioTrack::query()->whereKey($this->trackId)->update([
                'edit_status' => 'failed',
                'edit_error' => Str::limit($error instanceof \RuntimeException ? $error->getMessage() : 'El procesamiento falló. Inténtalo de nuevo.', 290),
            ]);
        }
    }
}
