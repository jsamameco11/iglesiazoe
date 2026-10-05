<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Radio\Editor\AudioEditor;
use App\Domain\Radio\Editor\EditRecipe;
use App\Domain\Radio\Editor\FilterGraph;
use App\Domain\Radio\Editor\RenderAudioEdit;
use App\Models\RadioTrack;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

use function Illuminate\Support\defer;

/**
 * The audio editor: cuts, fades and sound treatment of any audio of the library (songs, announcements,
 * effects, programs and episodes). The admin hears every change live and the final file is rendered on
 * the server, keeping the original so the edit can be reopened or undone.
 */
class RadioEditorController extends RadioController
{
    public function index(Request $request): Response
    {
        $current = $this->track($request, $request->query('audio'));

        return Inertia::render('Admin/Radio/Editor', [
            'tracks' => $this->editable($request)->orderBy('kind')->orderBy('title')->get()->map(fn (RadioTrack $track) => [
                'id' => $track->id,
                'title' => $track->title,
                'credit' => $track->credit(),
                'kind' => $track->kind,
                'cover' => $track->cover_path,
                'duration' => (float) $track->duration,
                'edited' => $track->original_path !== null,
                'editing' => $track->edit_status === 'processing',
            ]),
            'kinds' => RadioTrack::KINDS,
            'current' => $current ? $this->workspace($current) : null,
            'limits' => [
                'maxCuts' => EditRecipe::MAX_CUTS,
                'maxFade' => EditRecipe::MAX_FADE,
                'maxJoin' => EditRecipe::MAX_JOIN,
                'maxGain' => EditRecipe::MAX_GAIN,
                'minLength' => EditRecipe::MIN_LENGTH,
                'previewSeconds' => AudioEditor::PREVIEW_SECONDS,
                'targetLufs' => FilterGraph::TARGET_LUFS,
            ],
        ]);
    }

    /** Waveform and loudness of the audio being edited. */
    public function analysis(Request $request): JsonResponse
    {
        $track = $this->track($request, $request->query('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        $analysis = AudioEditor::analysis($track);
        if ($analysis === null) {
            return $this->fail('No pudimos leer este audio para dibujar su onda. Revisa que el archivo siga en la biblioteca.');
        }

        return response()->json(['ok' => true, ...$analysis]);
    }

    /** Saves an edit: the audio is rendered right after this answer and the editor follows its progress. */
    public function save(Request $request): JsonResponse
    {
        $track = $this->track($request, $request->input('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        if ($track->edit_status === 'processing' && ! AudioEditor::isStale($track)) {
            return $this->fail('Este audio todavía se está procesando. Espera a que termine.', 409);
        }
        $recipe = EditRecipe::from($request->input('recipe'), $track->sourceDuration());
        if ($recipe === null) {
            return $this->fail('La edición dejaría menos de '.(int) EditRecipe::MIN_LENGTH.' segundo de audio. Revisa los cortes.');
        }
        if (EditRecipe::isPlain($recipe)) {
            return $this->fail($track->original_path
                ? 'Así quedaría igual al original. Para volver al original usa «Restaurar original».'
                : 'Todavía no hiciste ningún cambio en este audio.');
        }

        $track->update(['edit_status' => 'processing', 'edit_error' => null]);
        defer(fn () => RenderAudioEdit::dispatchSync($track->id, $recipe));

        return response()->json(['ok' => true, 'status' => 'processing', 'message' => 'Procesando «'.$track->title.'» con calidad de estudio…']);
    }

    /** Where the rendering of an edit is. */
    public function status(Request $request): JsonResponse
    {
        $track = $this->track($request, $request->query('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        $this->settle($track);

        return response()->json([
            'ok' => true,
            'status' => $track->edit_status,
            'error' => $track->edit_error,
            'edited' => $track->original_path !== null,
            'duration' => (float) $track->duration,
        ]);
    }

    /** A few seconds of the final result, rendered exactly as saving would, to hear what the browser cannot preview. */
    public function preview(Request $request): JsonResponse|BinaryFileResponse
    {
        $track = $this->track($request, $request->input('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        $recipe = EditRecipe::from($request->input('recipe'), $track->sourceDuration());
        if ($recipe === null) {
            return $this->fail('La edición dejaría menos de '.(int) EditRecipe::MIN_LENGTH.' segundo de audio. Revisa los cortes.');
        }
        try {
            $file = AudioEditor::preview($track, $recipe, max(0, (float) $request->input('at', 0)));
        } catch (RuntimeException $error) {
            return $this->fail($error->getMessage());
        }

        return response()->file($file, ['Content-Type' => 'audio/mpeg', 'Cache-Control' => 'no-store'])->deleteFileAfterSend();
    }

    /** Puts the original audio back. */
    public function restore(Request $request): JsonResponse
    {
        $track = $this->track($request, $request->input('id'));
        if (! $track) {
            return $this->fail('Ese audio ya no existe. Recarga la página.', 404);
        }
        if ($track->edit_status === 'processing' && ! AudioEditor::isStale($track)) {
            return $this->fail('Este audio todavía se está procesando. Espera a que termine.', 409);
        }
        if (! $track->original_path) {
            return $this->fail('Este audio no tiene ediciones: ya es el original.');
        }
        AudioEditor::restore($track);

        return $this->saved('Listo: «'.$track->title.'» volvió a su audio original, en la biblioteca y en todo lo programado.');
    }

    /**
     * Audio the admin may edit: the whole library, or only the audio of the episodes for whom only manages episodes.
     *
     * @return Builder<RadioTrack>
     */
    private function editable(Request $request): Builder
    {
        $query = RadioTrack::query()->whereNotNull('file_path')->where('file_path', '!=', '');

        return Permissions::has($request->user(), 'radio.library') ? $query : $query->whereHas('episodes');
    }

    private function track(Request $request, mixed $id): ?RadioTrack
    {
        return is_string($id) && Str::isUuid($id) ? $this->editable($request)->find($id) : null;
    }

    /** An edit cut off midway is reported as failed instead of processing forever. */
    private function settle(RadioTrack $track): void
    {
        if (AudioEditor::isStale($track)) {
            $track->update(['edit_status' => 'failed', 'edit_error' => 'El procesamiento se interrumpió. Vuelve a guardar la edición.']);
        }
    }

    /** @return array<string, mixed> */
    private function workspace(RadioTrack $track): array
    {
        $this->settle($track);
        $source = $track->sourcePath();
        $key = MediaLibrary::keyOf($source);

        return [
            'id' => $track->id,
            'title' => $track->title,
            'credit' => $track->credit(),
            'kind' => $track->kind,
            'cover' => $track->cover_path,
            'duration' => (float) $track->duration,
            'source' => [
                'src' => $key !== null && MediaLibrary::publicDisk() instanceof AwsS3V3Adapter ? MediaLibrary::publicUrl($key) : $source,
                'duration' => $track->sourceDuration(),
            ],
            'edit' => $track->edit,
            'edited' => $track->original_path !== null,
            'editedAt' => $track->edited_at?->toIso8601String(),
            'status' => $track->edit_status,
            'error' => $track->edit_error,
            'upcoming' => $track->slots()->where('starts_at', '>=', now())->count(),
            'episodes' => $track->episodes()->count(),
        ];
    }
}
