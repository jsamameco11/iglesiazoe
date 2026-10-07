<?php

namespace App\Domain\Stream\YouTube;

use App\Domain\Auth\Support\Entrance;
use App\Domain\Stream\StreamSettings;
use App\Models\LiveStream;
use Carbon\CarbonInterval;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * The church's YouTube channel through the YouTube Data API v3: live broadcasts bound
 * to one reusable stream (the one the media server relays to), resumable uploads,
 * playlists and thumbnails. The account is connected once with OAuth.
 */
final class YouTubeClient
{
    private const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN = 'https://oauth2.googleapis.com/token';

    private const REVOKE = 'https://oauth2.googleapis.com/revoke';

    private const API = 'https://www.googleapis.com/youtube/v3';

    private const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';

    private const SCOPE = 'https://www.googleapis.com/auth/youtube';

    public static function configured(): bool
    {
        return filled(config('stream.youtube.client_id')) && filled(config('stream.youtube.client_secret'));
    }

    public static function connected(): bool
    {
        return self::configured() && filled(StreamSettings::youtube()['refresh'] ?? null);
    }

    /** Address registered in Google Cloud as the authorised redirect URI. */
    public static function redirectUri(): string
    {
        return Entrance::adminUrl('/admin/transmision/youtube/volver');
    }

    public static function authUrl(string $state): string
    {
        return self::AUTH.'?'.http_build_query([
            'client_id' => config('stream.youtube.client_id'),
            'redirect_uri' => self::redirectUri(),
            'response_type' => 'code',
            'scope' => self::SCOPE,
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ]);
    }

    /** Finishes the Google sign-in: keeps the tokens, reads the channel and prepares the stream OBS relays to. */
    public static function connect(string $code): array
    {
        if (! self::configured()) {
            throw YouTubeError::because('notConfigured');
        }
        try {
            $response = Http::asForm()->connectTimeout(5)->timeout(20)->post(self::TOKEN, [
                'code' => $code,
                'client_id' => config('stream.youtube.client_id'),
                'client_secret' => config('stream.youtube.client_secret'),
                'redirect_uri' => self::redirectUri(),
                'grant_type' => 'authorization_code',
            ]);
        } catch (ConnectionException) {
            throw new YouTubeError('No pudimos comunicarnos con Google. Vuelve a intentarlo en un momento.', 'connection');
        }
        if ($response->failed()) {
            throw YouTubeError::from($response);
        }
        $tokens = $response->json();
        if (empty($tokens['refresh_token'])) {
            throw new YouTubeError('Google no entregó el permiso permanente. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.', 'noRefreshToken');
        }
        StreamSettings::putYoutube([
            'refresh' => $tokens['refresh_token'],
            'access' => $tokens['access_token'],
            'expires_at' => time() + (int) ($tokens['expires_in'] ?? 3600),
            'connected_at' => now()->toIso8601String(),
            'error' => null,
        ]);

        $channel = self::call('GET', self::API.'/channels', ['part' => 'snippet', 'mine' => 'true'])['items'][0] ?? null;
        if (! $channel) {
            StreamSettings::forgetYoutube();
            throw new YouTubeError('Esa cuenta de Google no tiene un canal de YouTube. Entra con la cuenta del canal de la iglesia.', 'noChannel');
        }
        StreamSettings::putYoutube(['channel' => [
            'id' => $channel['id'],
            'title' => $channel['snippet']['title'] ?? '',
            'handle' => $channel['snippet']['customUrl'] ?? '',
            'thumbnail' => $channel['snippet']['thumbnails']['default']['url'] ?? '',
        ]]);

        try {
            self::prepareIngest();
        } catch (YouTubeError $error) {
            StreamSettings::putYoutube(['error' => $error->getMessage()]);
        }

        return StreamSettings::youtube();
    }

    public static function disconnect(): void
    {
        $refresh = StreamSettings::youtube()['refresh'] ?? null;
        if ($refresh) {
            try {
                Http::asForm()->connectTimeout(4)->timeout(8)->post(self::REVOKE, ['token' => $refresh]);
            } catch (\Throwable) {
            }
        }
        StreamSettings::forgetYoutube();
        Cache::forget('zoe.youtube.playlists');
    }

    /** The reusable stream every broadcast binds to; its address is where the media server relays. */
    public static function prepareIngest(): void
    {
        $youtube = StreamSettings::youtube();
        $stream = null;
        if (! empty($youtube['ingest_id'])) {
            $stream = self::call('GET', self::API.'/liveStreams', ['part' => 'id,cdn', 'id' => $youtube['ingest_id']])['items'][0] ?? null;
        }
        $stream ??= self::call('POST', self::API.'/liveStreams', ['part' => 'snippet,cdn,contentDetails'], [
            'snippet' => ['title' => 'Iglesia Zoe · Señal de la web (no borrar)'],
            'cdn' => ['ingestionType' => 'rtmp', 'resolution' => 'variable', 'frameRate' => 'variable'],
            'contentDetails' => ['isReusable' => true],
        ]);

        StreamSettings::putYoutube([
            'ingest_id' => $stream['id'],
            'ingest_url' => $stream['cdn']['ingestionInfo']['ingestionAddress'] ?? 'rtmp://a.rtmp.youtube.com/live2',
            'ingest_name' => $stream['cdn']['ingestionInfo']['streamName'] ?? '',
            'error' => null,
        ]);
    }

    /** Creates the broadcast on the channel with every YouTube option and binds it to the stream. */
    public static function createBroadcast(LiveStream $live): array
    {
        if (empty(StreamSettings::youtube()['ingest_id'])) {
            self::prepareIngest();
        }
        $options = VideoOptions::fill($live->options ?? []);
        $broadcast = self::call('POST', self::API.'/liveBroadcasts', ['part' => 'snippet,status,contentDetails'], [
            'snippet' => self::broadcastSnippet($live, $options),
            'status' => ['privacyStatus' => $options['privacy'], 'selfDeclaredMadeForKids' => $options['kids']],
            'contentDetails' => [
                'enableAutoStart' => true,
                'enableAutoStop' => false,
                'enableDvr' => $options['dvr'],
                'enableEmbed' => $options['embeddable'],
                'recordFromStart' => true,
                'latencyPreference' => $options['latency'],
                'monitorStream' => ['enableMonitorStream' => false],
            ],
        ]);
        $id = $broadcast['id'];
        self::call('POST', self::API.'/liveBroadcasts/bind', ['id' => $id, 'part' => 'id,contentDetails', 'streamId' => StreamSettings::youtube()['ingest_id']]);

        return ['id' => $id, 'warnings' => self::finishVideo($id, $live->title, $live->description, $options, $live->cover_path)];
    }

    /** Applies edited details to a broadcast that has not ended. */
    public static function updateBroadcast(LiveStream $live, bool $coverChanged = false): array
    {
        $options = VideoOptions::fill($live->options ?? []);
        self::call('PUT', self::API.'/liveBroadcasts', ['part' => 'id,snippet,status'], [
            'id' => $live->youtube_id,
            'snippet' => self::broadcastSnippet($live, $options),
            'status' => ['privacyStatus' => $options['privacy'], 'selfDeclaredMadeForKids' => $options['kids']],
        ]);

        return self::finishVideo($live->youtube_id, $live->title, $live->description, $options, $coverChanged ? $live->cover_path : null, playlist: false);
    }

    /**
     * Ends the broadcast on YouTube. One that never went on air is removed instead,
     * so the channel does not keep an upcoming stream that will not happen.
     */
    public static function completeBroadcast(string $id): string
    {
        try {
            self::call('POST', self::API.'/liveBroadcasts/transition', ['broadcastStatus' => 'complete', 'id' => $id, 'part' => 'status']);

            return 'complete';
        } catch (YouTubeError $error) {
            if (! in_array($error->reason, ['invalidTransition', 'redundantTransition', 'liveBroadcastNotFound'], true)) {
                throw $error;
            }
        }
        $status = self::broadcastStatus($id);
        if (in_array($status, ['created', 'ready'], true)) {
            self::call('DELETE', self::API.'/liveBroadcasts', ['id' => $id]);

            return 'deleted';
        }

        return $status ?? 'missing';
    }

    public static function broadcastStatus(string $id): ?string
    {
        return self::call('GET', self::API.'/liveBroadcasts', ['part' => 'status', 'id' => $id])['items'][0]['status']['lifeCycleStatus'] ?? null;
    }

    /**
     * Processing state of a video, or null when it no longer exists.
     *
     * @return array{ready: bool, failed: bool, privacy: ?string, duration: ?int}|null
     */
    public static function video(string $id): ?array
    {
        $video = self::call('GET', self::API.'/videos', ['part' => 'status,processingDetails,contentDetails', 'id' => $id])['items'][0] ?? null;
        if (! $video) {
            return null;
        }
        $upload = $video['status']['uploadStatus'] ?? '';
        $processing = $video['processingDetails']['processingStatus'] ?? '';

        return [
            'ready' => $upload === 'processed' || $processing === 'succeeded',
            'failed' => in_array($upload, ['failed', 'rejected', 'deleted'], true) || in_array($processing, ['failed', 'terminated'], true),
            'privacy' => $video['status']['privacyStatus'] ?? null,
            'duration' => self::seconds($video['contentDetails']['duration'] ?? null),
        ];
    }

    /** @return list<array{id: string, title: string}> */
    public static function playlists(): array
    {
        return Cache::remember('zoe.youtube.playlists', 300, function () {
            $items = self::call('GET', self::API.'/playlists', ['part' => 'snippet', 'mine' => 'true', 'maxResults' => 50])['items'] ?? [];

            return collect($items)->map(fn ($item) => ['id' => $item['id'], 'title' => $item['snippet']['title'] ?? ''])->sortBy('title')->values()->all();
        });
    }

    /** Title, description, category, tags, language and visibility of a video already on the channel. */
    public static function updateVideo(string $id, string $title, ?string $description, array $options): void
    {
        $options = VideoOptions::fill($options);
        self::call('PUT', self::API.'/videos', ['part' => 'snippet,status'], [
            'id' => $id,
            'snippet' => VideoOptions::snippet($title, $description, $options),
            'status' => [
                'privacyStatus' => $options['privacy'],
                'selfDeclaredMadeForKids' => $options['kids'],
                'embeddable' => $options['embeddable'],
                'license' => $options['license'],
            ],
        ]);
    }

    /**
     * Category, tags, language, playlist and thumbnail; what fails here does not stop the video.
     *
     * @return list<string>
     */
    public static function finishVideo(string $id, string $title, ?string $description, array $options, ?string $coverPath, bool $playlist = true, bool $snippet = true): array
    {
        $options = VideoOptions::fill($options);
        $warnings = [];
        if ($snippet) {
            try {
                self::call('PUT', self::API.'/videos', ['part' => 'snippet'], ['id' => $id, 'snippet' => VideoOptions::snippet($title, $description, $options)]);
            } catch (YouTubeError $error) {
                $warnings[] = 'Categoría y etiquetas: '.$error->getMessage();
            }
        }
        if ($playlist && $options['playlist']) {
            try {
                self::call('POST', self::API.'/playlistItems', ['part' => 'snippet'], ['snippet' => [
                    'playlistId' => $options['playlist'],
                    'resourceId' => ['kind' => 'youtube#video', 'videoId' => $id],
                ]]);
            } catch (YouTubeError $error) {
                $warnings[] = 'Lista de reproducción: '.$error->getMessage();
            }
        }
        if ($coverPath) {
            $warnings = [...$warnings, ...self::setThumbnail($id, $coverPath)];
        }

        return $warnings;
    }

    /** @return list<string> */
    public static function setThumbnail(string $videoId, string $coverPath): array
    {
        $image = ThumbnailSource::read($coverPath);
        if (! $image) {
            return [];
        }
        try {
            self::send(fn (string $token) => Http::withToken($token)->connectTimeout(5)->timeout(60)
                ->withBody($image['bytes'], $image['mime'])
                ->post(self::UPLOAD.'/thumbnails/set?videoId='.urlencode($videoId)));
        } catch (YouTubeError $error) {
            return ['Miniatura: '.($error->status === 403 ? 'YouTube solo acepta miniaturas personalizadas en canales verificados con número de teléfono.' : $error->getMessage())];
        }

        return [];
    }

    /** Opens a resumable upload and returns the address the parts go to. */
    public static function startUpload(string $title, ?string $description, array $options, int $size, string $mime): string
    {
        $options = VideoOptions::fill($options);
        $response = self::send(fn (string $token) => Http::withToken($token)->acceptJson()->connectTimeout(5)->timeout(30)
            ->withHeaders(['X-Upload-Content-Length' => (string) $size, 'X-Upload-Content-Type' => $mime])
            ->post(self::UPLOAD.'/videos?'.http_build_query([
                'uploadType' => 'resumable',
                'part' => 'snippet,status',
                'notifySubscribers' => $options['notify'] ? 'true' : 'false',
            ]), [
                'snippet' => VideoOptions::snippet($title, $description, $options),
                'status' => VideoOptions::uploadStatus($options),
            ]));
        $session = $response->header('Location');
        if (! $session) {
            throw new YouTubeError('YouTube no abrió la subida. Vuelve a intentarlo.', 'noSession');
        }

        return $session;
    }

    /**
     * Sends one part of the file. Returns the video when YouTube has the whole file,
     * or the next byte it expects.
     *
     * @return array{done: bool, offset: int, video: ?array}
     */
    public static function sendChunk(string $session, string $bytes, int $offset, int $total, string $mime): array
    {
        $end = $offset + strlen($bytes) - 1;
        $response = self::send(fn (string $token) => Http::withToken($token)->acceptJson()->withoutRedirecting()->connectTimeout(10)->timeout(600)
            ->withHeaders(['Content-Range' => "bytes {$offset}-{$end}/{$total}"])
            ->withBody($bytes, $mime)
            ->put($session), allow: [308]);

        return self::uploadState($response, $end + 1);
    }

    /**
     * Asks YouTube how much of an interrupted upload it already has.
     *
     * @return array{done: bool, offset: int, video: ?array}
     */
    public static function uploadState(Response|string $response, int $fallback = 0, int $total = 0): array
    {
        if (is_string($response)) {
            $response = self::send(fn (string $token) => Http::withToken($token)->acceptJson()->withoutRedirecting()->connectTimeout(10)->timeout(30)
                ->withHeaders(['Content-Range' => "bytes */{$total}"])
                ->withBody('', 'application/octet-stream')
                ->put($response), allow: [308]);
            $fallback = 0;
        }
        if ($response->status() === 308) {
            $range = (string) $response->header('Range');

            return ['done' => false, 'offset' => preg_match('/bytes=0-(\d+)/', $range, $match) ? (int) $match[1] + 1 : $fallback, 'video' => null];
        }

        return ['done' => true, 'offset' => $fallback, 'video' => $response->json()];
    }

    private static function broadcastSnippet(LiveStream $live, array $options): array
    {
        $start = $options['scheduled_at'] && strtotime($options['scheduled_at']) > time() + 60 ? $options['scheduled_at'] : now()->utc()->addMinute()->format('Y-m-d\TH:i:s\Z');

        return [
            'title' => VideoOptions::clean($live->title, 100) ?: 'Transmisión en vivo',
            'description' => VideoOptions::clean((string) $live->description, 5000),
            'scheduledStartTime' => $start,
        ];
    }

    private static function call(string $method, string $url, array $query = [], ?array $json = null): array
    {
        $response = self::send(fn (string $token) => Http::withToken($token)->acceptJson()->connectTimeout(5)->timeout(30)
            ->withQueryParameters($query)
            ->send($method, $url, $json === null ? [] : ['json' => $json]));

        return $response->json() ?? [];
    }

    /**
     * Runs a request with a fresh access token, refreshing it once when Google says it expired.
     *
     * @param  callable(string): Response  $request
     * @param  list<int>  $allow
     */
    private static function send(callable $request, array $allow = []): Response
    {
        try {
            $response = $request(self::token());
            if ($response->status() === 401) {
                $response = $request(self::token(refresh: true));
            }
        } catch (ConnectionException) {
            throw new YouTubeError('No pudimos comunicarnos con YouTube. Revisa la conexión del servidor y vuelve a intentarlo.', 'connection');
        }
        if ($response->failed() && ! in_array($response->status(), $allow, true)) {
            throw YouTubeError::from($response);
        }

        return $response;
    }

    private static function token(bool $refresh = false): string
    {
        if (! self::configured()) {
            throw YouTubeError::because('notConfigured');
        }
        $youtube = StreamSettings::youtube();
        if (empty($youtube['refresh'])) {
            throw YouTubeError::because('notConnected');
        }
        if (! $refresh && ! empty($youtube['access']) && (int) ($youtube['expires_at'] ?? 0) > time() + 60) {
            return $youtube['access'];
        }

        try {
            $response = Http::asForm()->connectTimeout(5)->timeout(15)->post(self::TOKEN, [
                'client_id' => config('stream.youtube.client_id'),
                'client_secret' => config('stream.youtube.client_secret'),
                'refresh_token' => $youtube['refresh'],
                'grant_type' => 'refresh_token',
            ]);
        } catch (ConnectionException) {
            throw new YouTubeError('No pudimos comunicarnos con Google. Vuelve a intentarlo en un momento.', 'connection');
        }
        if ($response->failed()) {
            $error = YouTubeError::from($response);
            if ($error->reason === 'invalid_grant') {
                StreamSettings::putYoutube(['error' => $error->getMessage(), 'access' => '', 'expires_at' => 0]);
            }
            throw $error;
        }
        StreamSettings::putYoutube(['access' => $response->json('access_token'), 'expires_at' => time() + (int) $response->json('expires_in', 3600)]);

        return (string) $response->json('access_token');
    }

    private static function seconds(?string $duration): ?int
    {
        if (! $duration) {
            return null;
        }
        try {
            return (int) CarbonInterval::make($duration)?->totalSeconds;
        } catch (\Throwable) {
            return null;
        }
    }
}
