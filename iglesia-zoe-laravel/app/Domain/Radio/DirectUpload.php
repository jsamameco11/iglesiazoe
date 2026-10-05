<?php

namespace App\Domain\Radio;

use App\Domain\Media\Support\MediaLibrary;
use App\Models\RadioTrack;
use App\Models\User;
use Aws\S3\Exception\S3Exception;
use DateTimeInterface;
use finfo;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * Audio travels from the browser straight to Wasabi in parts (S3 multipart upload): a two-hour program
 * never passes through the web server and a dropped connection only repeats one part.
 * The server opens the upload and signs its parts; when the form is saved it closes the upload,
 * checks that the whole file arrived and that it is audio, and only then the audio enters the library.
 */
final class DirectUpload
{
    /** S3 asks at least 5 MB for every part but the last one. */
    public const PART_BYTES = 8 * 1024 * 1024;

    private const MAX_PARTS = 10000;

    /** Hours the signed parts and the open upload stay valid. */
    private const HOURS = 12;

    /** Bytes read from the start of the file to tell that it is audio. */
    private const SNIFF_BYTES = 4096;

    private const EXPIRED = 'La subida del audio venció o no llegó completa. Vuelve a subirlo.';

    private const UNREACHABLE = 'No pudimos conectar con el almacenamiento de audios. Revisa tu conexión e inténtalo de nuevo.';

    public static function available(): bool
    {
        return MediaLibrary::publicDisk() instanceof AwsS3V3Adapter;
    }

    /**
     * Opens the upload of an audio and signs the address of each part.
     *
     * @return array{token: string, partSize: int, urls: list<string>}
     *
     * @throws AudioRejected
     */
    public static function begin(User $user, string $name, int $size, string $kind): array
    {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (! in_array($extension, RadioAudio::TYPES, true)) {
            throw new AudioRejected(RadioAudio::WRONG_TYPE);
        }
        if (! array_key_exists($kind, RadioTrack::KINDS)) {
            throw new AudioRejected('Elige un tipo válido.');
        }
        if ($size < 1) {
            throw new AudioRejected('El archivo está vacío. Prueba con otro.');
        }
        if ($size > RadioAudio::maxMb() * 1024 * 1024) {
            throw new AudioRejected('El audio pesa más de '.RadioAudio::maxMb().' MB. Expórtalo en MP3 (128–192 kbps).');
        }

        $disk = self::disk();
        self::sweep($disk);
        $client = $disk->getClient();
        $bucket = $disk->getConfig()['bucket'];
        $key = 'radio/'.$kind.'/'.now()->format('Ymd-His').'-'.Str::lower(Str::random(10)).'.'.$extension;

        try {
            $uploadId = (string) $client->createMultipartUpload([
                'Bucket' => $bucket,
                'Key' => $disk->path($key),
                'ContentType' => RadioAudio::contentType($extension),
                'CacheControl' => 'public, max-age=31536000, immutable',
                'ACL' => 'public-read',
            ])->get('UploadId');
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }

        $partSize = max(self::PART_BYTES, (int) ceil($size / self::MAX_PARTS));
        $count = (int) ceil($size / $partSize);
        $expires = now()->addHours(self::HOURS);
        $urls = [];
        for ($part = 1; $part <= $count; $part++) {
            $command = $client->getCommand('UploadPart', ['Bucket' => $bucket, 'Key' => $disk->path($key), 'UploadId' => $uploadId, 'PartNumber' => $part]);
            $urls[] = (string) $client->createPresignedRequest($command, $expires)->getUri();
        }

        $token = Str::random(40);
        Cache::put(self::cacheKey($token), [
            'user' => (string) $user->getKey(),
            'key' => $key,
            'upload' => $uploadId,
            'size' => $size,
            'parts' => $count,
            'done' => false,
        ], $expires);

        return ['token' => $token, 'partSize' => $partSize, 'urls' => $urls];
    }

    /**
     * Closes the upload a form brings and returns the site path of the audio.
     * The upload is spent: the same file can never end up behind two audios.
     *
     * @param  mixed  $parts  the parts the browser sent: [{n, etag}], as a list or as JSON
     *
     * @throws AudioRejected
     */
    public static function finish(string $token, mixed $parts, User $user): string
    {
        $lock = Cache::lock('radio.upload.lock.'.$token, 120);
        if (! $lock->get()) {
            throw new AudioRejected('Este audio ya se está guardando. Espera un momento.', 409);
        }

        try {
            $upload = Cache::get(self::cacheKey($token));
            if (! is_array($upload) || $upload['user'] !== (string) $user->getKey()) {
                throw new AudioRejected(self::EXPIRED, 410);
            }
            $disk = self::disk();
            if (! $upload['done']) {
                self::complete($disk, $token, $upload, $parts);
                $upload['done'] = true;
                Cache::put(self::cacheKey($token), $upload, now()->addHours(self::HOURS));
            }
            self::check($disk, $token, $upload);
            Cache::forget(self::cacheKey($token));

            return MediaLibrary::PUBLIC_PREFIX.$upload['key'];
        } finally {
            $lock->release();
        }
    }

    /** Drops an upload the browser could not finish, so its parts do not stay stored. */
    public static function cancel(string $token, User $user): void
    {
        $upload = Cache::get(self::cacheKey($token));
        if (! is_array($upload) || $upload['user'] !== (string) $user->getKey() || $upload['done']) {
            return;
        }
        self::abort(self::disk(), $token, $upload);
    }

    /**
     * @param  array{user: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload
     */
    private static function complete(AwsS3V3Adapter $disk, string $token, array $upload, mixed $parts): void
    {
        $list = self::parts($parts, $upload['parts']);
        if ($list === null) {
            self::abort($disk, $token, $upload);

            throw new AudioRejected(self::EXPIRED, 410);
        }

        try {
            $disk->getClient()->completeMultipartUpload([
                'Bucket' => $disk->getConfig()['bucket'],
                'Key' => $disk->path($upload['key']),
                'UploadId' => $upload['upload'],
                'MultipartUpload' => ['Parts' => $list],
            ]);
        } catch (S3Exception $exception) {
            $code = $exception->getAwsErrorCode();
            if ($code === 'NoSuchUpload') {
                return;
            }
            if (in_array($code, ['InvalidPart', 'InvalidPartOrder', 'EntityTooSmall'], true)) {
                self::abort($disk, $token, $upload);

                throw new AudioRejected(self::EXPIRED, 410);
            }
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }
    }

    /**
     * Makes sure the whole file arrived and that it is audio; otherwise it is deleted.
     *
     * @param  array{user: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload
     */
    private static function check(AwsS3V3Adapter $disk, string $token, array $upload): void
    {
        $client = $disk->getClient();
        $object = ['Bucket' => $disk->getConfig()['bucket'], 'Key' => $disk->path($upload['key'])];

        try {
            $size = (int) $client->headObject($object)->get('ContentLength');
            $head = (string) $client->getObject($object + ['Range' => 'bytes=0-'.(self::SNIFF_BYTES - 1)])->get('Body');
        } catch (S3Exception $exception) {
            if ($exception->getStatusCode() === 404) {
                Cache::forget(self::cacheKey($token));

                throw new AudioRejected(self::EXPIRED, 410);
            }
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }

        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->buffer($head);
        $problem = match (true) {
            $size !== $upload['size'] => new AudioRejected(self::EXPIRED, 410),
            ! RadioAudio::looksLikeAudio($mime) => new AudioRejected(RadioAudio::WRONG_TYPE),
            default => null,
        };
        if ($problem) {
            $disk->delete($upload['key']);
            Cache::forget(self::cacheKey($token));

            throw $problem;
        }
    }

    /**
     * The parts in order, ready for S3, or null when they do not match the upload.
     *
     * @return list<array{PartNumber: int, ETag: string}>|null
     */
    private static function parts(mixed $parts, int $count): ?array
    {
        if (is_string($parts)) {
            $parts = json_decode($parts, true);
        }
        if (! is_array($parts) || count($parts) !== $count) {
            return null;
        }
        $list = [];
        foreach ($parts as $part) {
            $number = is_array($part) ? filter_var($part['n'] ?? null, FILTER_VALIDATE_INT) : false;
            $etag = is_array($part) ? trim((string) ($part['etag'] ?? ''), '"') : '';
            if ($number === false || $number < 1 || $number > $count || isset($list[$number]) || ! preg_match('/^[A-Za-z0-9-]{8,80}$/', $etag)) {
                return null;
            }
            $list[$number] = ['PartNumber' => $number, 'ETag' => '"'.$etag.'"'];
        }
        ksort($list);

        return array_values($list);
    }

    /**
     * @param  array{user: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload
     */
    private static function abort(AwsS3V3Adapter $disk, string $token, array $upload): void
    {
        Cache::forget(self::cacheKey($token));
        try {
            $disk->getClient()->abortMultipartUpload([
                'Bucket' => $disk->getConfig()['bucket'],
                'Key' => $disk->path($upload['key']),
                'UploadId' => $upload['upload'],
            ]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    /** Uploads left open for a day (a closed tab, a lost connection) are dropped, at most every few hours. */
    private static function sweep(AwsS3V3Adapter $disk): void
    {
        if (! Cache::add('radio.upload.sweep', true, now()->addHours(6))) {
            return;
        }
        $client = $disk->getClient();
        $bucket = $disk->getConfig()['bucket'];
        $cutoff = now()->subDay()->getTimestamp();

        try {
            $open = $client->listMultipartUploads(['Bucket' => $bucket, 'Prefix' => $disk->path('radio/')])->get('Uploads') ?? [];
            foreach ($open as $upload) {
                $started = $upload['Initiated'] ?? null;
                if ($started instanceof DateTimeInterface && $started->getTimestamp() < $cutoff) {
                    $client->abortMultipartUpload(['Bucket' => $bucket, 'Key' => $upload['Key'], 'UploadId' => $upload['UploadId']]);
                }
            }
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private static function disk(): AwsS3V3Adapter
    {
        $disk = MediaLibrary::publicDisk();
        if (! $disk instanceof AwsS3V3Adapter) {
            throw new AudioRejected('La subida directa no está disponible en este servidor.', 409);
        }

        return $disk;
    }

    private static function cacheKey(string $token): string
    {
        return 'radio.upload.'.$token;
    }
}
