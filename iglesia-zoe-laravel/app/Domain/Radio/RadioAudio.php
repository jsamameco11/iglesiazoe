<?php

namespace App\Domain\Radio;

use App\Domain\Media\Support\MediaLibrary;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

/** Audio files the radio accepts, for the library and for episodes. */
final class RadioAudio
{
    public const TYPES = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'flac'];

    /** Limit of a file that goes through the web server, when there is no Wasabi to send it to. */
    public const MAX_MB = 75;

    /** Limit of a file sent straight to Wasabi: a long program even in WAV. */
    public const DIRECT_MAX_MB = 2048;

    public const WRONG_TYPE = 'El archivo debe ser de audio: MP3, M4A, AAC, OGG, OPUS, WAV, WEBM o FLAC.';

    private const CONTENT_TYPES = [
        'mp3' => 'audio/mpeg',
        'm4a' => 'audio/mp4',
        'aac' => 'audio/aac',
        'ogg' => 'audio/ogg',
        'oga' => 'audio/ogg',
        'opus' => 'audio/ogg',
        'wav' => 'audio/wav',
        'webm' => 'audio/webm',
        'flac' => 'audio/flac',
    ];

    public static function maxMb(): int
    {
        return DirectUpload::available() ? self::DIRECT_MAX_MB : self::MAX_MB;
    }

    /** The type players need to stream the file as soon as it starts arriving. */
    public static function contentType(string $extension): string
    {
        return self::CONTENT_TYPES[strtolower($extension)] ?? 'application/octet-stream';
    }

    /** Whether a type read from the content of a file is one a browser can play as audio. */
    public static function looksLikeAudio(string $mime): bool
    {
        return preg_match('#^(audio/|video/(mp4|webm|ogg)|application/(ogg|octet-stream))#', $mime) === 1;
    }

    /** Whether the form brings a new audio, sent straight to Wasabi or as a file. */
    public static function sent(Request $request): bool
    {
        return $request->filled('upload') || $request->file('audio') instanceof UploadedFile;
    }

    /**
     * Keeps the new audio of a form and returns its site path, or null when the form brings none.
     *
     * @throws AudioRejected
     */
    public static function receive(Request $request, string $kind): ?string
    {
        if ($request->filled('upload')) {
            return DirectUpload::finish((string) $request->input('upload'), $request->input('parts'), $request->user());
        }
        $file = $request->file('audio');
        if (! $file instanceof UploadedFile) {
            return null;
        }
        if ($problem = self::problem($file)) {
            throw new AudioRejected($problem);
        }

        return self::store($file, $kind);
    }

    /** What is wrong with the file, or null when it can be stored. */
    public static function problem(UploadedFile $file): ?string
    {
        if (! $file->isValid()) {
            return in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'El servidor no aceptó el archivo porque pesa demasiado. Expórtalo en MP3 (128–192 kbps) e inténtalo de nuevo.'
                : 'El archivo no llegó completo. Inténtalo de nuevo.';
        }
        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, self::TYPES, true) || ! self::looksLikeAudio((string) $file->getMimeType())) {
            return self::WRONG_TYPE;
        }
        if ($file->getSize() > self::MAX_MB * 1024 * 1024) {
            return 'El audio pesa más de '.self::MAX_MB.' MB. Expórtalo en MP3 (128–192 kbps).';
        }

        return null;
    }

    /** Stores a file that passed problem() and returns its public path. */
    public static function store(UploadedFile $file, string $kind): string
    {
        return MediaLibrary::storePublic($file, 'radio/'.$kind, strtolower($file->getClientOriginalExtension()));
    }
}
