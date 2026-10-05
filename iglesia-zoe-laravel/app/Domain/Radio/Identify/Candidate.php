<?php

namespace App\Domain\Radio\Identify;

/** One version of a song a music database knows: its credits, the release it is on and its genre tags. */
final class Candidate
{
    public const ALBUM = 'album';

    public const EP = 'ep';

    public const SINGLE = 'single';

    public const COMPILATION = 'compilation';

    /** How well it matches the song being identified, from 0 to 1. */
    public float $score = 0.0;

    public float $titleScore = 0.0;

    public float $artistScore = 0.0;

    /**
     * @param  list<string>  $featured
     * @param  list<array{0: string, 1: float}>  $tags  Genre tags with their weight; one tag may list other names after «||».
     */
    public function __construct(
        public string $source,
        public string $id,
        public string $title,
        public string $artist,
        public array $featured = [],
        public ?string $album = null,
        public ?string $albumType = null,
        public ?int $albumTracks = null,
        public ?int $year = null,
        public ?float $duration = null,
        public ?string $cover = null,
        public array $tags = [],
        public ?string $isrc = null,
        public ?string $artistId = null,
        public ?string $albumId = null,
    ) {}

    /** Whether the release is a real album or EP of the artist, not a single or a compilation. */
    public function onAlbum(): bool
    {
        return $this->album !== null && in_array($this->albumType, [self::ALBUM, self::EP], true);
    }

    /** Seconds between its length and $seconds, or null when one of them is unknown. */
    public function gap(?float $seconds): ?float
    {
        return $seconds && $this->duration ? abs($this->duration - $seconds) : null;
    }
}
