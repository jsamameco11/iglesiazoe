<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Permissions;
use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Site\Support\YouTube;
use App\Domain\Stream\TeachingVideos;
use App\Domain\Stream\VideoUploads;
use App\Domain\Stream\YouTube\ThumbnailSource;
use App\Domain\Stream\YouTube\VideoOptions;
use App\Domain\Stream\YouTube\YouTubeClient;
use App\Domain\Stream\YouTube\YouTubeError;
use App\Http\Controllers\Controller;
use App\Models\LiveRecording;
use App\Models\Teaching;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

/**
 * Enseñanzas: every message of the church. Broadcasts arrive here on their own when they
 * end; a video teaching reaches the site once it has its YouTube link.
 */
class TeachingsController extends Controller
{
    private const FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];

    private const COVER_TYPES = ['jpg', 'jpeg', 'png'];

    private const MESSAGES = [
        'required' => 'Completa el campo :attribute.',
        'date' => 'Elige una fecha válida en :attribute.',
        'max' => 'El campo :attribute es demasiado largo.',
        'min' => 'Revisa el campo :attribute.',
        'in' => 'Elige una opción válida en :attribute.',
    ];

    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Recursos', [
            'teachings' => Teaching::query()->with('liveStream.recordings')->orderByDesc('teaching_date')->orderByDesc('created_at')->get()->map->adminPayload(),
            'accept' => '.'.implode(',.', self::FILE_TYPES),
            'video' => [
                'canPublish' => Permissions::has($request->user(), 'live.manage'),
                'connected' => YouTubeClient::connected(),
                'accept' => '.'.implode(',.', VideoUploads::TYPES),
                'maxGb' => (int) config('stream.upload_max_gb'),
                'retentionHours' => (int) config('stream.retention_hours'),
            ],
            'catalog' => VideoOptions::catalog(),
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $existing = $this->find(Teaching::class, $request->input('id'));
        if ($request->filled('id') && ! $existing) {
            return $this->fail('Esa enseñanza ya no existe. Recarga la página.', 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:3|max:160',
            'kind' => ['required', Rule::in(Teaching::KINDS)],
            'teaching_date' => 'required|date',
            'preacher' => 'nullable|string|max:120',
            'summary' => 'nullable|string|max:5000',
            'youtube' => 'nullable|string|max:200',
            'privacy' => ['nullable', Rule::in(array_keys(VideoOptions::PRIVACY))],
        ], self::MESSAGES, [
            'title' => 'título',
            'kind' => 'tipo',
            'teaching_date' => 'fecha',
            'preacher' => 'predicador',
            'summary' => 'descripción',
            'youtube' => 'video',
            'privacy' => 'visibilidad',
        ]);
        if ($validator->fails()) {
            return $this->fail($validator->errors()->first());
        }

        $data = [
            'title' => trim((string) $request->input('title')),
            'kind' => $request->input('kind'),
            'teaching_date' => $request->input('teaching_date'),
            'preacher' => trim((string) $request->input('preacher')) ?: null,
            'summary' => trim((string) $request->input('summary')) ?: null,
            'show_summary' => $request->boolean('show_summary'),
            'active' => $request->boolean('active'),
        ];

        $video = trim((string) $request->input('youtube'));
        $youtubeId = $video === '' ? null : YouTube::id($video);
        if ($video !== '' && ! $youtubeId) {
            return $this->fail('No reconocemos ese enlace de YouTube. Pega el enlace del video o su ID.');
        }
        if ($youtubeId !== $existing?->youtube_id) {
            $data += ['youtube_id' => $youtubeId, 'youtube_privacy' => null, 'youtube_status' => null, 'youtube_error' => null, 'youtube_progress' => 0];
        }

        $file = $request->file('file');
        if ($file instanceof UploadedFile) {
            $extension = MediaLibrary::extension($file, self::FILE_TYPES);
            if (! $extension || $file->getSize() > 25 * 1024 * 1024) {
                return $this->fail('El archivo debe ser PDF, Word, PowerPoint o una imagen de hasta 25 MB.');
            }
            $data['file_path'] = MediaLibrary::storePublic($file, 'recursos/'.substr($data['teaching_date'], 0, 4), $extension);
            MediaLibrary::deletePublic($existing?->file_path);
        } elseif ($existing && $request->boolean('remove_file')) {
            MediaLibrary::deletePublic($existing->file_path);
            $data['file_path'] = null;
        }

        $cover = $request->file('cover');
        if ($cover instanceof UploadedFile) {
            $extension = MediaLibrary::extension($cover, self::COVER_TYPES);
            if (! $extension || $cover->getSize() > ThumbnailSource::MAX_BYTES) {
                return $this->fail('La miniatura debe ser JPG o PNG de hasta 2 MB (1280 × 720 se ve mejor).');
            }
            $data['cover_path'] = MediaLibrary::storePublic($cover, 'recursos/miniaturas', $extension);
        } elseif ($existing && $request->boolean('remove_cover')) {
            $data['cover_path'] = null;
        }

        $teaching = $existing ?? new Teaching(['source' => 'manual']);
        $warning = $this->syncYouTube($request, $teaching, $data);
        $teaching->fill($data)->save();

        $message = $existing ? 'Enseñanza actualizada.' : 'Enseñanza guardada.';
        if (! $teaching->isOnSite()) {
            $message .= $teaching->active ? ' No se mostrará en la web hasta que tenga su video de YouTube (no privado) o un archivo.' : ' Está oculta en la web.';
        }

        return $this->saved(trim($message.' '.($warning ?? '')));
    }

    public function destroy(Request $request): JsonResponse
    {
        $teaching = $this->find(Teaching::class, $request->input('id'));
        if ($teaching) {
            if ($teaching->youtube_status === 'uploading') {
                return $this->fail('Espera a que termine la subida a YouTube para eliminarla.');
            }
            MediaLibrary::deletePublic($teaching->file_path);
            VideoUploads::discard($teaching->upload_path);
            $teaching->liveStream?->update(['teaching_id' => null]);
            $teaching->delete();
        }

        return $this->saved('Enseñanza eliminada. Si tenía video en YouTube, sigue en el canal.');
    }

    public function uploadBegin(Request $request): JsonResponse
    {
        try {
            return response()->json(VideoUploads::begin((string) $request->input('name'), (int) $request->input('size'), (string) $request->user()->id));
        } catch (InvalidArgumentException $error) {
            return $this->fail($error->getMessage());
        }
    }

    public function uploadChunk(Request $request): JsonResponse
    {
        $chunk = $request->file('chunk');
        if (! $chunk instanceof UploadedFile || ! $chunk->isValid()) {
            return $this->fail('Una parte del video no llegó. Reintentando…');
        }
        try {
            return response()->json(['offset' => VideoUploads::append((string) $request->input('upload'), (int) $request->input('offset'), $chunk, (string) $request->user()->id)]);
        } catch (InvalidArgumentException $error) {
            return $this->fail($error->getMessage());
        }
    }

    public function publish(Request $request): JsonResponse
    {
        $teaching = $this->find(Teaching::class, $request->input('id'));
        if (! $teaching) {
            return $this->fail('Esa enseñanza ya no existe. Recarga la página.', 404);
        }
        try {
            $options = VideoOptions::fromInput($request->all());
            $uploadName = null;
            $recording = null;
            if ($request->input('source') === 'upload') {
                $uploadName = VideoUploads::complete((string) $request->input('upload'), (string) $request->user()->id);
            } else {
                $recording = $this->find(LiveRecording::class, $request->input('recording'));
            }
            TeachingVideos::publish($teaching, $options, $uploadName, $recording, $request->boolean('replace'));
        } catch (ValidationException $error) {
            return $this->fail($error->validator->errors()->first());
        } catch (InvalidArgumentException $error) {
            return $this->fail($error->getMessage());
        }

        return $this->saved('Subiendo a YouTube. Cuando YouTube entregue el enlace, la enseñanza aparecerá en la web.');
    }

    /** Sends edited details of a video on the church channel to YouTube when asked to. */
    private function syncYouTube(Request $request, Teaching $teaching, array &$data): ?string
    {
        $privacy = $request->input('privacy');
        if (! $teaching->exists || ! $teaching->youtube_id || ! $teaching->youtube_options || ! $request->boolean('sync_youtube') || array_key_exists('youtube_id', $data)) {
            return null;
        }
        $options = VideoOptions::fill([...$teaching->youtube_options, 'privacy' => $privacy ?: $teaching->youtube_privacy ?: 'public', 'publish_at' => null]);
        try {
            YouTubeClient::updateVideo($teaching->youtube_id, $data['title'], $data['summary'], $options);
            if (array_key_exists('cover_path', $data) && $data['cover_path']) {
                YouTubeClient::setThumbnail($teaching->youtube_id, $data['cover_path']);
            }
        } catch (YouTubeError $error) {
            return 'No se pudo actualizar en YouTube: '.$error->getMessage();
        }
        $data['youtube_options'] = $options;
        $data['youtube_privacy'] = $options['privacy'];

        return 'También se actualizó en YouTube.';
    }
}
