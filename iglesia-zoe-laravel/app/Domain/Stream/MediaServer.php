<?php

namespace App\Domain\Stream;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/** The media server (MediaMTX) on the VPS: what it is receiving right now, through its local API. */
final class MediaServer
{
    private const KICK_ENDPOINTS = [
        'rtmpConn' => 'rtmpconns',
        'rtmpsConn' => 'rtmpconns',
        'srtConn' => 'srtconns',
        'rtspSession' => 'rtspsessions',
        'rtspsSession' => 'rtspsessions',
        'webRTCSession' => 'webrtcsessions',
    ];

    /**
     * @return array{online: bool, ready: bool, since: ?string, tracks: list<string>, video: ?string, kbps: ?int, viewers: int, source: ?array}
     */
    public static function status(): array
    {
        $empty = ['online' => false, 'ready' => false, 'since' => null, 'tracks' => [], 'video' => null, 'kbps' => null, 'viewers' => 0, 'source' => null];
        try {
            $response = Http::connectTimeout(2)->timeout(3)->acceptJson()->get(config('stream.api').'/v3/paths/get/'.config('stream.path'));
        } catch (\Throwable) {
            return $empty;
        }
        if ($response->status() === 404) {
            return ['online' => true] + $empty;
        }
        if (! $response->successful()) {
            return $empty;
        }

        $path = $response->json();
        $ready = (bool) ($path['ready'] ?? false);
        [$tracks, $video] = self::tracks($path);

        return [
            'online' => true,
            'ready' => $ready,
            'since' => $ready ? ($path['readyTime'] ?? null) : null,
            'tracks' => $tracks,
            'video' => $video,
            'kbps' => $ready ? self::bitrate((int) ($path['bytesReceived'] ?? 0)) : null,
            'viewers' => is_array($path['readers'] ?? null) ? count($path['readers']) : 0,
            'source' => is_array($path['source'] ?? null) ? $path['source'] : null,
        ];
    }

    /** Disconnects whoever is publishing, e.g. when the broadcast is ended from the panel. */
    public static function kick(): bool
    {
        $source = self::status()['source'];
        $endpoint = self::KICK_ENDPOINTS[$source['type'] ?? ''] ?? null;
        if (! $endpoint || empty($source['id'])) {
            return false;
        }
        try {
            return Http::connectTimeout(2)->timeout(4)->post(config('stream.api').'/v3/'.$endpoint.'/kick/'.$source['id'])->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /** Page of the media server's own player, proxied by Apache under the site. */
    public static function playerUrl(): string
    {
        return config('stream.player').'/'.config('stream.path').'/';
    }

    /** @return array{0: list<string>, 1: ?string} */
    private static function tracks(array $path): array
    {
        $names = [];
        $video = null;
        foreach ((array) ($path['tracks2'] ?? []) as $track) {
            if (! is_array($track)) {
                continue;
            }
            $codec = (string) ($track['codec'] ?? '');
            $names[] = $codec;
            $props = is_array($track['codecProps'] ?? null) ? $track['codecProps'] : [];
            if (! $video && isset($props['width'], $props['height'])) {
                $video = $props['width'].'×'.$props['height'];
            }
        }
        if (! $names) {
            $names = array_values(array_filter((array) ($path['tracks'] ?? []), 'is_string'));
        }

        return [array_values(array_filter($names)), $video];
    }

    /** Incoming bitrate from the bytes received since the previous look. */
    private static function bitrate(int $bytes): ?int
    {
        $now = microtime(true);
        $previous = Cache::get('zoe.stream.bytes');
        Cache::put('zoe.stream.bytes', ['bytes' => $bytes, 'at' => $now], 120);
        if (! is_array($previous) || $bytes < $previous['bytes'] || $now - $previous['at'] < 1 || $now - $previous['at'] > 60) {
            return null;
        }

        return (int) round(($bytes - $previous['bytes']) * 8 / 1000 / ($now - $previous['at']));
    }
}
