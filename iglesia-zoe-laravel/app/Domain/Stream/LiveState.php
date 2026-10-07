<?php

namespace App\Domain\Stream;

use App\Domain\Site\Sermons\ChannelLive;
use App\Models\LiveStream;
use Illuminate\Support\Facades\Cache;

/** What visitors see of the live stream: shared with every page for the EN VIVO button and polled by the Prédicas and Enseñanzas pages. */
final class LiveState
{
    private const CACHE = 'zoe.live.state';

    public static function forget(): void
    {
        Cache::forget(self::CACHE);
    }

    /**
     * @return array{live: bool, signal?: bool, title?: string, description?: ?string, preacher?: ?string, kind?: string, started_at?: ?string, youtube_id?: ?string, player?: string, cover?: ?string}
     */
    public static function current(): array
    {
        return Cache::remember(self::CACHE, 15, function () {
            $live = LiveStream::query()->where('status', 'live')->latest('started_at')->first();
            if (! $live) {
                return self::fromChannel();
            }

            return [
                'live' => true,
                'signal' => $live->hasSignal(),
                'title' => $live->title,
                'description' => $live->show_summary ? $live->description : null,
                'preacher' => $live->preacher,
                'kind' => $live->kind,
                'started_at' => $live->started_at?->toIso8601String(),
                'youtube_id' => $live->youtube_mode === 'api' ? $live->publicYoutubeId() : null,
                'player' => MediaServer::playerUrl(),
                'cover' => $live->coverUrl(),
            ];
        });
    }

    /**
     * A service streamed straight to the church's YouTube channel (without OBS going through the site).
     *
     * @return array{live: bool, signal?: bool, title?: string, description?: ?string, preacher?: ?string, kind?: string, started_at?: ?string, youtube_id?: ?string, cover?: ?string}
     */
    private static function fromChannel(): array
    {
        $channel = ChannelLive::current();
        if (! $channel) {
            return ['live' => false];
        }

        return [
            'live' => true,
            'signal' => true,
            'title' => $channel['title'],
            'description' => $channel['description'] ?: null,
            'preacher' => null,
            'kind' => 'predica',
            'started_at' => $channel['started_at'],
            'youtube_id' => $channel['id'],
            'cover' => $channel['thumbnail'],
        ];
    }

    public static function onAir(): bool
    {
        $state = self::current();

        return $state['live'] && ($state['signal'] ?? false);
    }
}
