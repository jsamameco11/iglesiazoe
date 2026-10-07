<?php

namespace App\Domain\Site\Sermons;

use Carbon\CarbonImmutable;
use DateInterval;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Reads a YouTube channel the way a visitor sees it. Without credentials it reads the public
 * "En vivo" and "Videos" tabs and each watch page; with a Data API key it asks the official
 * API instead, which is faster and does not depend on the page layout.
 *
 * Every video comes out with the same shape, newest first.
 */
final class ChannelReader
{
    private const BASE = 'https://www.youtube.com';

    private const API = 'https://www.googleapis.com/youtube/v3';

    private const PAGE_SIZE = 30;

    public function __construct(private readonly ?string $apiKey = null) {}

    public static function make(): self
    {
        return new self(SermonSettings::apiKey());
    }

    public function usesApi(): bool
    {
        return $this->apiKey !== null;
    }

    /**
     * Latest videos of the channel: id, title, views and length as the channel lists them.
     * A null length means YouTube is broadcasting it now or it is scheduled.
     *
     * @return list<array{id: string, title: string, views: int|null, duration: int|null, stream: bool}>
     */
    public function latest(string $channelUrl, string $filter = 'streams', int $pages = 1): array
    {
        if ($channelUrl === '') {
            throw new RuntimeException('No hay un canal de YouTube configurado.');
        }

        $videos = $this->usesApi()
            ? $this->latestFromApi($channelUrl, $filter, $pages)
            : $this->latestFromPages($channelUrl, $filter, $pages);

        return array_values(collect($videos)->unique('id')->all());
    }

    /**
     * Full details of each video, keyed by id. Videos YouTube does not return are left out.
     *
     * @param  list<string>  $ids
     * @return array<string, array{id: string, title: string, description: string, duration: int|null, views: int|null, channel: string|null, aired_at: CarbonImmutable|null, live_now: bool, upcoming: bool, was_live: bool, embeddable: bool, thumbnail: string}>
     */
    public function details(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return $this->usesApi() ? $this->detailsFromApi($ids) : $this->detailsFromPages($ids);
    }

    /** @return list<array{id: string, title: string, views: int|null, duration: int|null, stream: bool}> */
    private function latestFromPages(string $channelUrl, string $filter, int $pages): array
    {
        $tabs = $filter === 'all' ? ['streams', 'videos'] : ['streams'];
        $videos = [];
        foreach ($tabs as $tab) {
            $html = $this->page($channelUrl.'/'.$tab);
            $data = $this->json($html, '/var ytInitialData = (\{.*?\});<\/script>/s');
            if ($data === null) {
                throw new RuntimeException('YouTube no devolvió la lista de videos del canal.');
            }
            $found = $this->lockups($data, $tab === 'streams');
            $token = $this->continuation($data);
            for ($page = 1; $page < $pages && $token !== null; $page++) {
                $more = $this->browse($html, $token);
                $found = [...$found, ...$this->lockups($more, $tab === 'streams')];
                $token = $this->continuation($more);
            }
            $videos = [...$videos, ...$found];
        }

        return $videos;
    }

    /** Asks for the next page of a channel tab, the same way the page does when you scroll. */
    private function browse(string $html, string $token): array
    {
        preg_match('/"INNERTUBE_API_KEY":"([^"]+)"/', $html, $key);
        preg_match('/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/', $html, $version);
        if (! isset($key[1], $version[1])) {
            return [];
        }
        $response = $this->http()->asJson()->post(self::BASE.'/youtubei/v1/browse?prettyPrint=false&key='.$key[1], [
            'context' => ['client' => ['clientName' => 'WEB', 'clientVersion' => $version[1], 'hl' => 'es', 'gl' => 'PE']],
            'continuation' => $token,
        ]);

        return $response->successful() && is_array($response->json()) ? $response->json() : [];
    }

    /**
     * Each video card of a channel tab.
     *
     * @return list<array{id: string, title: string, views: int|null, duration: int|null, stream: bool}>
     */
    private function lockups(array $data, bool $stream): array
    {
        $videos = [];
        $walk = function (mixed $node) use (&$walk, &$videos, $stream): void {
            if (! is_array($node)) {
                return;
            }
            foreach ($node as $key => $value) {
                if ($key === 'lockupViewModel' && is_array($value) && ($value['contentType'] ?? '') === 'LOCKUP_CONTENT_TYPE_VIDEO') {
                    $video = $this->lockup($value, $stream);
                    if ($video !== null) {
                        $videos[] = $video;
                    }

                    continue;
                }
                $walk($value);
            }
        };
        $walk($data);

        return $videos;
    }

    /** @return array{id: string, title: string, views: int|null, duration: int|null, stream: bool}|null */
    private function lockup(array $lockup, bool $stream): ?array
    {
        $id = $lockup['contentId'] ?? null;
        if (! is_string($id) || ! preg_match('/^[A-Za-z0-9_-]{11}$/', $id)) {
            return null;
        }
        $meta = $lockup['metadata']['lockupMetadataViewModel'] ?? [];
        $parts = [];
        foreach ($meta['metadata']['contentMetadataViewModel']['metadataRows'] ?? [] as $row) {
            foreach ($row['metadataParts'] ?? [] as $part) {
                $parts[] = (string) ($part['text']['content'] ?? '');
            }
        }
        $views = null;
        foreach ($parts as $part) {
            if (preg_match('/^[\d.,\s]+(mil|k|M)?/u', trim($part)) && ! preg_match('/hace|ago/i', $part)) {
                $views = self::count($part);
                break;
            }
        }
        $duration = null;
        if (preg_match_all('/"text":"(\d{1,2}(?::\d{2}){1,2})"/', (string) json_encode($lockup['contentImage'] ?? []), $badges)) {
            $duration = self::clock($badges[1][0]);
        }

        return [
            'id' => $id,
            'title' => trim((string) ($meta['title']['content'] ?? '')),
            'views' => $views,
            'duration' => $duration,
            'stream' => $stream,
        ];
    }

    private function continuation(array $data): ?string
    {
        $token = null;
        $walk = function (mixed $node) use (&$walk, &$token): void {
            if (! is_array($node) || $token !== null) {
                return;
            }
            if (isset($node['continuationItemRenderer']['continuationEndpoint']['continuationCommand']['token'])) {
                $token = (string) $node['continuationItemRenderer']['continuationEndpoint']['continuationCommand']['token'];

                return;
            }
            foreach ($node as $value) {
                $walk($value);
            }
        };
        $walk($data);

        return $token;
    }

    /** @return array<string, array<string, mixed>> */
    private function detailsFromPages(array $ids): array
    {
        $details = [];
        foreach ($ids as $id) {
            $player = $this->json($this->page(self::BASE.'/watch?v='.$id.'&hl=es&gl=PE'), '/var ytInitialPlayerResponse = (\{.*?\});(?:var|<\/script>)/s');
            $video = $player['videoDetails'] ?? null;
            if (! is_array($video) || ($video['videoId'] ?? null) !== $id) {
                continue;
            }
            $micro = $player['microformat']['playerMicroformatRenderer'] ?? [];
            $live = $micro['liveBroadcastDetails'] ?? [];
            $aired = $live['startTimestamp'] ?? $micro['publishDate'] ?? $micro['uploadDate'] ?? null;
            $details[$id] = [
                'id' => $id,
                'title' => trim((string) ($video['title'] ?? '')),
                'description' => trim((string) ($video['shortDescription'] ?? '')),
                'duration' => isset($video['lengthSeconds']) && (int) $video['lengthSeconds'] > 0 ? (int) $video['lengthSeconds'] : null,
                'views' => isset($video['viewCount']) ? (int) $video['viewCount'] : null,
                'channel' => isset($video['author']) ? (string) $video['author'] : null,
                'aired_at' => $aired ? CarbonImmutable::parse($aired)->utc() : null,
                'live_now' => (bool) ($live['isLiveNow'] ?? false),
                'upcoming' => (bool) ($video['isUpcoming'] ?? false),
                'was_live' => (bool) ($video['isLiveContent'] ?? false),
                'embeddable' => ($player['playabilityStatus']['playableInEmbed'] ?? true) !== false,
                'thumbnail' => self::bestThumbnail($video['thumbnail']['thumbnails'] ?? [], $id),
            ];
        }

        return $details;
    }

    /** @return list<array{id: string, title: string, views: int|null, duration: int|null, stream: bool}> */
    private function latestFromApi(string $channelUrl, string $filter, int $pages): array
    {
        $channel = preg_match('~/channel/(UC[\w-]{22})~', $channelUrl, $match)
            ? ['id' => $match[1]]
            : (preg_match('~/(@[\w.\-]+)~u', $channelUrl, $match) ? ['forHandle' => $match[1]] : ['forUsername' => basename($channelUrl)]);
        $uploads = $this->api('channels', ['part' => 'contentDetails', ...$channel])['items'][0]['contentDetails']['relatedPlaylists']['uploads'] ?? null;
        if (! is_string($uploads)) {
            throw new RuntimeException('La API de YouTube no encontró el canal '.$channelUrl.'.');
        }

        $ids = [];
        $token = null;
        for ($page = 0; $page < $pages; $page++) {
            $list = $this->api('playlistItems', ['part' => 'contentDetails', 'playlistId' => $uploads, 'maxResults' => self::PAGE_SIZE] + ($token ? ['pageToken' => $token] : []));
            foreach ($list['items'] ?? [] as $item) {
                $ids[] = (string) ($item['contentDetails']['videoId'] ?? '');
            }
            $token = $list['nextPageToken'] ?? null;
            if (! $token) {
                break;
            }
        }

        $videos = [];
        foreach ($this->detailsFromApi(array_values(array_filter($ids))) as $video) {
            if ($filter === 'streams' && ! $video['was_live']) {
                continue;
            }
            $videos[] = [
                'id' => $video['id'],
                'title' => $video['title'],
                'views' => $video['views'],
                'duration' => $video['live_now'] || $video['upcoming'] ? null : $video['duration'],
                'stream' => $video['was_live'],
            ];
        }

        return $videos;
    }

    /** @return array<string, array<string, mixed>> */
    private function detailsFromApi(array $ids): array
    {
        $details = [];
        foreach (array_chunk($ids, 50) as $chunk) {
            $items = $this->api('videos', ['part' => 'snippet,contentDetails,statistics,liveStreamingDetails,status', 'id' => implode(',', $chunk)])['items'] ?? [];
            foreach ($items as $item) {
                $id = (string) ($item['id'] ?? '');
                $snippet = $item['snippet'] ?? [];
                $live = $item['liveStreamingDetails'] ?? null;
                $aired = $live['actualStartTime'] ?? $snippet['publishedAt'] ?? null;
                $details[$id] = [
                    'id' => $id,
                    'title' => trim((string) ($snippet['title'] ?? '')),
                    'description' => trim((string) ($snippet['description'] ?? '')),
                    'duration' => self::isoDuration($item['contentDetails']['duration'] ?? null),
                    'views' => isset($item['statistics']['viewCount']) ? (int) $item['statistics']['viewCount'] : null,
                    'channel' => $snippet['channelTitle'] ?? null,
                    'aired_at' => $aired ? CarbonImmutable::parse($aired)->utc() : null,
                    'live_now' => ($snippet['liveBroadcastContent'] ?? 'none') === 'live',
                    'upcoming' => ($snippet['liveBroadcastContent'] ?? 'none') === 'upcoming',
                    'was_live' => is_array($live),
                    'embeddable' => ($item['status']['embeddable'] ?? true) !== false,
                    'thumbnail' => self::bestThumbnail(array_values($snippet['thumbnails'] ?? []), $id),
                ];
            }
        }

        return $details;
    }

    private function api(string $resource, array $query): array
    {
        $response = Http::timeout(20)->retry(2, 500, throw: false)->get(self::API.'/'.$resource, [...$query, 'key' => $this->apiKey]);
        if (! $response->successful()) {
            $reason = $response->json('error.message') ?: 'HTTP '.$response->status();
            throw new RuntimeException('La API de YouTube respondió: '.strip_tags((string) $reason));
        }

        return (array) $response->json();
    }

    private function page(string $url): string
    {
        $response = $this->http()->get($url);
        if (! $response->successful()) {
            throw new RuntimeException('YouTube respondió '.$response->status().' al abrir '.$url.'.');
        }

        return $response->body();
    }

    /** Looks like a browser in Peru that already accepted cookies, so YouTube answers in Spanish without the consent page. */
    private function http(): PendingRequest
    {
        return Http::timeout(20)->retry(2, 800, throw: false)->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
            'Accept-Language' => 'es-419,es;q=0.9',
            'Cookie' => 'CONSENT=YES+1; SOCS=CAI',
        ]);
    }

    private function json(string $html, string $pattern): ?array
    {
        if (! preg_match($pattern, $html, $match)) {
            return null;
        }
        $data = json_decode($match[1], true);

        return is_array($data) ? $data : null;
    }

    /** "1:13:31" or "45:10" in seconds. */
    public static function clock(string $value): ?int
    {
        $parts = array_map('intval', explode(':', $value));
        if (count($parts) < 2 || count($parts) > 3) {
            return null;
        }
        $seconds = 0;
        foreach ($parts as $part) {
            $seconds = $seconds * 60 + $part;
        }

        return $seconds;
    }

    /** "1.234", "1,2 mil", "3,4 M" or "353 vistas" as a number. */
    public static function count(string $value): ?int
    {
        if (! preg_match('/([\d.,]+)\s*(mil|k|M|millones)?/u', $value, $match)) {
            return null;
        }
        $suffix = $match[2] ?? '';
        if ($suffix === '') {
            return (int) preg_replace('/\D/', '', $match[1]);
        }
        $number = (float) str_replace(',', '.', str_replace('.', '', $match[1]));

        return (int) round($number * (in_array($suffix, ['M', 'millones'], true) ? 1_000_000 : 1_000));
    }

    private static function isoDuration(?string $value): ?int
    {
        if (! $value) {
            return null;
        }
        try {
            $interval = new DateInterval($value);
        } catch (\Throwable) {
            return null;
        }
        $seconds = $interval->d * 86400 + $interval->h * 3600 + $interval->i * 60 + $interval->s;

        return $seconds > 0 ? $seconds : null;
    }

    /** The widest picture YouTube offers, without the tracking query. */
    private static function bestThumbnail(array $thumbnails, string $id): string
    {
        $best = collect($thumbnails)->filter(fn ($thumb) => is_array($thumb) && ! empty($thumb['url']))->sortByDesc(fn ($thumb) => (int) ($thumb['width'] ?? 0))->first();
        $url = is_array($best) ? strtok((string) $best['url'], '?') : null;

        return $url ?: 'https://i.ytimg.com/vi/'.$id.'/hqdefault.jpg';
    }
}
