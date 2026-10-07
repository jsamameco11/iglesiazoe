<?php

namespace App\Domain\Site\Sermons;

use App\Domain\Stream\LiveState;
use App\Models\Sermon;
use App\Models\SiteSetting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Watches the "En vivo" page of the church's YouTube channel, so a service streamed straight
 * to YouTube shows up on Prédicas (and lights the EN VIVO button) while it is on air.
 * When the broadcast ends, the channel watcher looks again every few minutes until the
 * recording is on the site, instead of waiting for its next scheduled check.
 */
final class ChannelLive
{
    private const KEY = 'sermons_youtube_live';

    /** A reading older than this is ignored, so a broken check never leaves the site "live" forever. */
    private const STALE_MINUTES = 10;

    /** How long after a broadcast ends the watcher keeps looking for its recording. */
    private const CATCH_UP_HOURS = 3;

    private const CATCH_UP_EVERY_MINUTES = 5;

    /** @return array{id: string, title: string, description: string, started_at: ?string, thumbnail: string}|null */
    public static function current(): ?array
    {
        $stored = self::stored();
        $checked = is_string($stored['checked_at'] ?? null) ? CarbonImmutable::parse($stored['checked_at']) : null;
        if (! is_array($stored['live'] ?? null) || ! $checked || $checked->lt(now()->subMinutes(self::STALE_MINUTES))) {
            return null;
        }

        return $stored['live'];
    }

    /**
     * Reads the channel now and brings in the recording of a broadcast that just ended.
     *
     * @return array{id: string, title: string, description: string, started_at: ?string, thumbnail: string}|null
     */
    public static function check(): ?array
    {
        $channel = SermonSettings::channelUrl();
        if ($channel === '') {
            return null;
        }

        $before = self::stored();
        try {
            $live = self::read($channel);
        } catch (\Throwable $error) {
            Log::warning('sermons: no se pudo revisar si el canal está en vivo', ['error' => $error->getMessage()]);

            return null;
        }

        $was = $before['live']['id'] ?? null;
        $catchUp = $before['catch_up'] ?? null;
        if (is_string($was) && $was !== ($live['id'] ?? null)) {
            $catchUp = ['id' => $was, 'until' => now()->addHours(self::CATCH_UP_HOURS)->toIso8601String(), 'synced_at' => null];
        }
        $catchUp = self::catchUp($catchUp);

        self::put(['live' => $live, 'checked_at' => now()->toIso8601String(), 'catch_up' => $catchUp]);
        if ($was !== ($live['id'] ?? null)) {
            LiveState::forget();
        }

        return $live;
    }

    /**
     * Runs the channel watcher every few minutes until the finished broadcast is a sermon of
     * the site (published or waiting for review), then stops.
     *
     * @param  array{id: string, until: string, synced_at: ?string}|null  $catchUp
     * @return array{id: string, until: string, synced_at: ?string}|null
     */
    private static function catchUp(?array $catchUp): ?array
    {
        if ($catchUp === null || SermonSettings::current()['mode'] === 'off') {
            return null;
        }
        if (now()->gt(CarbonImmutable::parse($catchUp['until'])) || Sermon::query()->where('youtube_id', $catchUp['id'])->exists()) {
            return null;
        }
        $synced = $catchUp['synced_at'] ? CarbonImmutable::parse($catchUp['synced_at']) : null;
        if ($synced && $synced->gt(now()->subMinutes(self::CATCH_UP_EVERY_MINUTES))) {
            return $catchUp;
        }

        SermonSync::make()->run('auto');

        return Sermon::query()->where('youtube_id', $catchUp['id'])->exists() ? null : [...$catchUp, 'synced_at' => now()->toIso8601String()];
    }

    /** @return array{id: string, title: string, description: string, started_at: ?string, thumbnail: string}|null */
    private static function read(string $channel): ?array
    {
        $response = Http::timeout(20)->retry(2, 800, throw: false)->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
            'Accept-Language' => 'es-419,es;q=0.9',
            'Cookie' => 'CONSENT=YES+1; SOCS=CAI',
        ])->get($channel.'/live');
        if (! $response->successful()) {
            throw new \RuntimeException('YouTube respondió '.$response->status().' al abrir '.$channel.'/live.');
        }
        if (! preg_match('/var ytInitialPlayerResponse = (\{.*?\});(?:var|<\/script>)/s', $response->body(), $match)) {
            return null;
        }

        $player = json_decode($match[1], true);
        $video = is_array($player) ? ($player['videoDetails'] ?? null) : null;
        $broadcast = $player['microformat']['playerMicroformatRenderer']['liveBroadcastDetails'] ?? [];
        $id = is_array($video) ? ($video['videoId'] ?? null) : null;
        $onAir = (($video['isLive'] ?? false) === true || ($broadcast['isLiveNow'] ?? false) === true) && ($video['isUpcoming'] ?? false) !== true;
        if (! $onAir || ! is_string($id) || ! preg_match('/^[A-Za-z0-9_-]{11}$/', $id)) {
            return null;
        }

        return [
            'id' => $id,
            'title' => trim((string) ($video['title'] ?? '')) ?: 'Servicio en vivo',
            'description' => Str::limit(trim((string) ($video['shortDescription'] ?? '')), 1500),
            'started_at' => isset($broadcast['startTimestamp']) ? CarbonImmutable::parse($broadcast['startTimestamp'])->utc()->toIso8601String() : null,
            'thumbnail' => 'https://i.ytimg.com/vi/'.$id.'/hqdefault.jpg',
        ];
    }

    /** @return array<string, mixed> */
    private static function stored(): array
    {
        $stored = SiteSetting::query()->find(self::KEY)?->value;

        return is_array($stored) ? $stored : [];
    }

    /** @param  array<string, mixed>  $value */
    private static function put(array $value): void
    {
        SiteSetting::withoutEvents(fn () => SiteSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => $value, 'updated_at' => now()]));
    }
}
