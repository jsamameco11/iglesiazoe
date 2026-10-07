<?php

namespace App\Domain\Stream;

use App\Domain\Media\Support\MediaLibrary;
use App\Domain\Stream\Jobs\PublishTeachingVideo;
use App\Domain\Stream\YouTube\VideoOptions;
use App\Domain\Stream\YouTube\YouTubeClient;
use App\Domain\Stream\YouTube\YouTubeError;
use App\Models\LiveRecording;
use App\Models\Teaching;
use Illuminate\Support\Facades\File;
use InvalidArgumentException;

/**
 * Takes a teaching's video to YouTube: the original recording of the broadcast or an
 * edited file from the panel. When YouTube returns the link it is saved and the
 * teaching shows up on the site.
 */
final class TeachingVideos
{
    /**
     * Queues the upload; $uploadName is an edited video already received, otherwise $recording is sent.
     * With $replace the new video takes the place of the current link (the old one stays on the channel).
     */
    public static function publish(Teaching $teaching, array $options, ?string $uploadName, ?LiveRecording $recording, bool $replace = false): void
    {
        if ($teaching->youtube_id && ! $replace) {
            throw new InvalidArgumentException('Esta enseñanza ya tiene su video en YouTube.');
        }
        if ($teaching->youtube_status === 'uploading') {
            throw new InvalidArgumentException('El video de esta enseñanza ya se está subiendo.');
        }
        if (! YouTubeClient::connected()) {
            throw new InvalidArgumentException('Conecta primero la cuenta de YouTube de la iglesia en Transmisión.');
        }
        if ($uploadName === null && (! $recording || ! $recording->downloadable() || $recording->liveStream?->teaching_id !== $teaching->id)) {
            throw new InvalidArgumentException('Elige la grabación original o sube el video editado.');
        }
        if ($uploadName !== null && $teaching->upload_path && $teaching->upload_path !== $uploadName) {
            VideoUploads::discard($teaching->upload_path);
        }

        $teaching->update([
            'youtube_options' => $options,
            'youtube_status' => 'uploading',
            'youtube_progress' => 0,
            'youtube_error' => null,
            'upload_path' => $uploadName ?? $teaching->upload_path,
        ]);
        PublishTeachingVideo::dispatch($teaching->id, $uploadName === null ? $recording?->id : null)->onConnection(config('stream.queue'));
    }

    /** Runs in the queue: sends the file in parts and keeps the link YouTube returns. */
    public static function send(string $teachingId, ?string $recordingId): void
    {
        $teaching = Teaching::query()->find($teachingId);
        if (! $teaching || $teaching->youtube_status !== 'uploading') {
            return;
        }
        $path = null;
        $temporary = false;
        try {
            [$path, $temporary] = self::source($teaching, $recordingId);
            $options = VideoOptions::fill($teaching->youtube_options ?? []);
            $video = self::upload($teaching, $path, $options);
            $warnings = YouTubeClient::finishVideo($video['id'], $teaching->title, $teaching->summary, $options, $teaching->cover_path, snippet: false);
            $teaching->update([
                'youtube_id' => $video['id'],
                'youtube_status' => 'processing',
                'youtube_progress' => 100,
                'youtube_privacy' => VideoOptions::finalPrivacy($options),
                'youtube_error' => $warnings ? 'Aviso: '.implode(' ', $warnings) : null,
                'upload_path' => $temporary ? $teaching->upload_path : null,
            ]);
            if (! $temporary) {
                File::delete($path);
            }
        } catch (YouTubeError $error) {
            $teaching->update($teaching->youtube_id
                ? ['youtube_status' => 'ready', 'youtube_error' => 'No se pudo subir el video editado ('.$error->getMessage().') Sigue publicado el video anterior.']
                : ['youtube_status' => 'failed', 'youtube_error' => $error->getMessage()]);
        } finally {
            if ($temporary && $path) {
                File::delete($path);
            }
        }
    }

    /** Follows the videos YouTube is still processing; run every minute. */
    public static function sync(): void
    {
        if (! YouTubeClient::connected()) {
            return;
        }
        $pending = Teaching::query()->where('youtube_status', 'processing')->whereNotNull('youtube_id')->orderBy('updated_at')->limit(25)->get();
        foreach ($pending as $teaching) {
            try {
                $video = YouTubeClient::video($teaching->youtube_id);
            } catch (YouTubeError) {
                return;
            }
            if ($video === null) {
                $teaching->update(['youtube_id' => null, 'youtube_status' => null, 'youtube_error' => 'El video ya no existe en YouTube. Vuelve a publicarlo.']);
            } elseif ($video['failed']) {
                $teaching->update(['youtube_status' => 'failed', 'youtube_error' => 'YouTube no pudo procesar el video. Revisa el archivo y vuelve a publicarlo.']);
            } elseif ($video['ready']) {
                $teaching->update([
                    'youtube_status' => 'ready',
                    'youtube_privacy' => $video['privacy'] ?? $teaching->youtube_privacy,
                    'duration_seconds' => $video['duration'] ?: $teaching->duration_seconds,
                ]);
            } else {
                $teaching->touch();
            }
        }
    }

    /**
     * Local file to send: the edited upload, or the recording brought back from Wasabi.
     *
     * @return array{0: string, 1: bool}
     */
    private static function source(Teaching $teaching, ?string $recordingId): array
    {
        if ($recordingId === null) {
            $path = VideoUploads::path($teaching->upload_path);
            if (! $path) {
                throw new YouTubeError('El video editado ya no está en el servidor. Vuelve a subirlo.', 'missingFile');
            }

            return [$path, false];
        }

        $recording = LiveRecording::query()->find($recordingId);
        if (! $recording || ! $recording->downloadable()) {
            throw new YouTubeError('La grabación ya no está disponible (se guarda solo '.intdiv((int) config('stream.retention_hours'), 24).' días).', 'missingFile');
        }
        $path = VideoUploads::folder().'/'.$teaching->id.'-original.'.(pathinfo($recording->name, PATHINFO_EXTENSION) ?: 'mp4');
        $source = rescue(fn () => MediaLibrary::privateDisk()->readStream($recording->path), null, false);
        if (! is_resource($source)) {
            throw new YouTubeError('No pudimos leer la grabación desde Wasabi. Vuelve a intentarlo.', 'missingFile');
        }
        $target = fopen($path, 'wb');
        try {
            stream_copy_to_stream($source, $target);
        } finally {
            fclose($target);
            if (is_resource($source)) {
                fclose($source);
            }
        }

        return [$path, true];
    }

    /** @return array{id: string} */
    private static function upload(Teaching $teaching, string $path, array $options): array
    {
        clearstatcache(true, $path);
        $size = (int) filesize($path);
        $mime = VideoUploads::mime($path);
        $session = YouTubeClient::startUpload($teaching->title, $teaching->summary, $options, $size, $mime);
        $chunk = VideoUploads::chunkBytes();
        $handle = fopen($path, 'rb');
        $offset = 0;
        $failures = 0;
        $lastProgress = -1;

        try {
            while (true) {
                fseek($handle, $offset);
                $bytes = self::read($handle, $chunk);
                try {
                    $state = YouTubeClient::sendChunk($session, $bytes, $offset, $size, $mime);
                    $failures = 0;
                } catch (YouTubeError $error) {
                    if (! $error->isTemporary() || ++$failures > 6) {
                        throw $error;
                    }
                    sleep(min(64, 2 ** $failures));
                    $state = rescue(fn () => YouTubeClient::uploadState($session, 0, $size), ['done' => false, 'offset' => $offset, 'video' => null], false);
                }
                if ($state['done']) {
                    $video = $state['video'];
                    if (! is_array($video) || empty($video['id'])) {
                        throw new YouTubeError('YouTube recibió el video pero no devolvió su enlace. Revisa YouTube Studio.', 'noVideoId');
                    }

                    return $video;
                }
                $offset = $state['offset'];
                $progress = min(99, intdiv($offset * 100, max(1, $size)));
                if ($progress !== $lastProgress) {
                    $teaching->update(['youtube_progress' => $progress]);
                    $lastProgress = $progress;
                }
            }
        } finally {
            fclose($handle);
        }
    }

    /** @param  resource  $handle */
    private static function read($handle, int $length): string
    {
        $bytes = '';
        while (strlen($bytes) < $length && ! feof($handle)) {
            $piece = fread($handle, $length - strlen($bytes));
            if ($piece === false || $piece === '') {
                break;
            }
            $bytes .= $piece;
        }

        return $bytes;
    }
}
