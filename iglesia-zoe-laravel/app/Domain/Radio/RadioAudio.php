<?php

namespace App\Domain\Radio;

use App\Domain\Media\Support\MediaLibrary;
use Illuminate\Http\UploadedFile;

/** Audio files the radio accepts, for the library and for episodes. */
final class RadioAudio
{
    public const TYPES = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'flac'];

    public const MAX_MB = 75;

    /** What is wrong with the file, or null when it can be stored. */
    public static function problem(UploadedFile $file): ?string
    {
        $ext = strtolower($file->getClientOriginalExtension());
        $mime = (string) $file->getMimeType();
        if (! $file->isValid() || ! in_array($ext, self::TYPES, true) || ! preg_match('#^(audio/|video/(mp4|webm|ogg)|application/(ogg|octet-stream))#', $mime)) {
            return 'El archivo debe ser de audio: MP3, M4A, AAC, OGG, OPUS, WAV, WEBM o FLAC.';
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
