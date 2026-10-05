<?php

namespace App\Domain\Radio\Identify;

/** What is known of a song before asking the internet: its name, author, co-authors and length. */
final class SongQuery
{
    public readonly string $title;

    public readonly bool $live;

    /** @param  list<string>  $featured */
    public function __construct(
        string $title,
        public readonly string $artist = '',
        public readonly array $featured = [],
        public readonly ?float $duration = null,
    ) {
        $this->live = Text::isLive($title);
        $this->title = Text::cleanTitle($title) ?: trim($title);
    }

    /** @return list<string> */
    public function names(): array
    {
        return array_values(array_filter([$this->artist, ...$this->featured], fn (string $name) => Text::key($name) !== ''));
    }

    public function cacheKey(): string
    {
        return sha1(Text::key($this->title).'|'.Text::key($this->artist).'|'.($this->duration ? (int) round($this->duration / 3) : ''));
    }
}
