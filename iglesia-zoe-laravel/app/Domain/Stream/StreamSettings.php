<?php

namespace App\Domain\Stream;

use App\Domain\Stream\YouTube\VideoOptions;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * Secrets and defaults of the live stream: the key OBS uses, the YouTube connection
 * and the details a new broadcast starts with. Secrets are stored encrypted.
 */
final class StreamSettings
{
    private const KEY = 'stream';

    private const SECRETS = ['key', 'manual_key', 'refresh', 'access', 'ingest_name'];

    public const BROADCAST_DEFAULTS = [
        'title' => 'Reunión en vivo · Iglesia Cristiana Zoe',
        'description' => '',
        'preacher' => '',
        'kind' => 'predica',
        'show_summary' => true,
        'to_youtube' => true,
    ];

    /** Key OBS sends with the stream; created the first time it is needed. */
    public static function streamKey(): string
    {
        $key = self::secret('key');

        return $key ?: self::regenerateKey();
    }

    public static function regenerateKey(): string
    {
        $key = implode('-', array_map(fn () => Str::lower(Str::random(6)), range(1, 3)));
        self::put(['key' => $key]);

        return $key;
    }

    /** The media server asks before accepting a publisher: only OBS with the current key gets in. */
    public static function allowsPublisher(?string $user, ?string $password): bool
    {
        $key = self::secret('key');

        return $key !== null && $user === config('stream.user') && is_string($password) && hash_equals($key, $password);
    }

    /** Server and key to paste in OBS, plus the SRT alternative. */
    public static function encoder(): array
    {
        $host = (string) config('stream.host');
        $path = (string) config('stream.path');
        $user = (string) config('stream.user');
        $key = self::streamKey();
        $port = (int) config('stream.rtmp_port');

        return [
            'server' => 'rtmp://'.$host.($port === 1935 ? '' : ':'.$port),
            'key' => $path.'?user='.$user.'&pass='.$key,
            'srt' => 'srt://'.$host.':'.config('stream.srt_port').'?streamid=publish:'.$path.':'.$user.':'.$key.'&latency=2000000',
            'path' => $path,
        ];
    }

    /** YouTube connection, decrypted. */
    public static function youtube(): array
    {
        $youtube = self::stored()['youtube'] ?? [];
        if (! is_array($youtube)) {
            return [];
        }
        foreach (['refresh', 'access', 'ingest_name'] as $field) {
            if (isset($youtube[$field])) {
                $youtube[$field] = self::decrypt($youtube[$field]);
            }
        }

        return $youtube;
    }

    public static function putYoutube(array $youtube): void
    {
        $current = self::stored()['youtube'] ?? [];
        $next = is_array($current) ? $current : [];
        foreach ($youtube as $field => $value) {
            $next[$field] = in_array($field, self::SECRETS, true) && is_string($value) ? Crypt::encryptString($value) : $value;
        }
        self::put(['youtube' => $next], raw: true);
    }

    public static function forgetYoutube(): void
    {
        self::put(['youtube' => null], raw: true);
    }

    /** Stream key copied from YouTube Studio, used when the channel is not connected through Google. */
    public static function manualKey(): ?string
    {
        return self::secret('manual_key');
    }

    public static function putManualKey(?string $key): void
    {
        self::put(['manual_key' => $key ?: null]);
    }

    /**
     * Where the media server forwards the signal, or null when nothing goes to YouTube.
     *
     * @return array{url: string, mode: string}|null
     */
    public static function relayTarget(): ?array
    {
        $youtube = self::youtube();
        if (! empty($youtube['ingest_url']) && ! empty($youtube['ingest_name']) && ! empty($youtube['refresh'])) {
            return ['url' => rtrim($youtube['ingest_url'], '/').'/'.$youtube['ingest_name'], 'mode' => 'api'];
        }
        $manual = self::manualKey();

        return $manual ? ['url' => 'rtmp://a.rtmp.youtube.com/live2/'.$manual, 'mode' => 'key'] : null;
    }

    /** Details a new broadcast starts with. */
    public static function defaults(): array
    {
        $stored = self::stored()['defaults'] ?? [];
        $stored = is_array($stored) ? $stored : [];

        return [
            ...array_replace(self::BROADCAST_DEFAULTS, array_intersect_key($stored, self::BROADCAST_DEFAULTS)),
            'options' => VideoOptions::fill(is_array($stored['options'] ?? null) ? $stored['options'] : []),
        ];
    }

    public static function putDefaults(array $defaults): void
    {
        self::put(['defaults' => $defaults], raw: true);
    }

    private static function secret(string $field): ?string
    {
        return self::decrypt(self::stored()[$field] ?? null);
    }

    private static function decrypt(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private static function stored(): array
    {
        $stored = SiteSetting::query()->find(self::KEY)?->value;

        return is_array($stored) ? $stored : [];
    }

    /** Saves without touching the public site version: these settings never change what the site shows. */
    private static function put(array $values, bool $raw = false): void
    {
        if (! $raw) {
            $values = array_map(fn ($value) => is_string($value) ? Crypt::encryptString($value) : $value, $values);
        }
        $next = array_filter(array_replace(self::stored(), $values), fn ($value) => $value !== null);
        SiteSetting::withoutEvents(fn () => SiteSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => $next, 'updated_at' => now()]));
    }
}
