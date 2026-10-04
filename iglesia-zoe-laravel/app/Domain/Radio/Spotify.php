<?php

namespace App\Domain\Radio;

use Illuminate\Support\Facades\Http;

/**
 * Spotify playlists kept in the panel as a reference. Only public data is read (name and cover
 * through Spotify's oEmbed); the admin previews them in Spotify's own player.
 */
final class Spotify
{
    private const ID = '[A-Za-z0-9]{22}';

    /** The playlist id of a share link, a spotify: URI, an embed link or a bare id; null otherwise. */
    public static function playlistId(string $input): ?string
    {
        $input = trim($input);
        $patterns = [
            '~^spotify:playlist:('.self::ID.')$~',
            '~^(?:https?://)?open\.spotify\.com/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?(?:embed/)?playlist/('.self::ID.')(?:[/?#].*)?$~i',
            '~^('.self::ID.')$~',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $input, $match)) {
                return $match[1];
            }
        }

        return null;
    }

    public static function url(string $id): string
    {
        return 'https://open.spotify.com/playlist/'.$id;
    }

    public static function embed(string $id): string
    {
        return 'https://open.spotify.com/embed/playlist/'.$id.'?utm_source=generator&theme=0';
    }

    /**
     * Public name and cover of a playlist. `found` is false when Spotify does not know it (or it
     * is private) and null when Spotify could not be reached.
     *
     * @return array{found: ?bool, name: ?string, cover: ?string}
     */
    public static function lookup(string $id): array
    {
        try {
            $response = Http::connectTimeout(4)->timeout(6)->acceptJson()->get('https://open.spotify.com/oembed', ['url' => self::url($id)]);
        } catch (\Throwable) {
            return ['found' => null, 'name' => null, 'cover' => null];
        }
        if (in_array($response->status(), [400, 404], true)) {
            return ['found' => false, 'name' => null, 'cover' => null];
        }
        if (! $response->successful()) {
            return ['found' => null, 'name' => null, 'cover' => null];
        }
        $name = trim((string) $response->json('title'));
        $cover = (string) $response->json('thumbnail_url');

        return [
            'found' => true,
            'name' => $name !== '' ? mb_substr($name, 0, 80) : null,
            'cover' => str_starts_with($cover, 'https://') ? mb_substr($cover, 0, 500) : null,
        ];
    }
}
