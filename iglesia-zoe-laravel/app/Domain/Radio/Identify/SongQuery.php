<?php

namespace App\Domain\Radio\Identify;

/** What is known of a song before asking the internet: its name, author, co-authors and length. */
final class SongQuery
{
    public readonly string $title;

    public readonly bool $live;

    /** @var list<string> Cuts the name asks for («acoustic», «remix»…). */
    public readonly array $cuts;

    /** @var list<string> Co-authors by name. */
    public readonly array $featured;

    /** @var list<string> Co-authors by social handle («@uncorazonorg»), named once a database credits them. */
    public readonly array $handles;

    /** @param  list<string>  $featured */
    public function __construct(
        string $title,
        public readonly string $artist = '',
        array $featured = [],
        public readonly ?float $duration = null,
    ) {
        $this->live = Text::isLive($title);
        $this->cuts = Text::cuts($title);
        $this->title = Text::cleanTitle($title) ?: trim($title);
        $names = Text::unique([...$featured, ...Text::featuredIn($title)]);
        $this->featured = array_values(array_filter($names, fn (string $name) => ! Text::isHandle($name)));
        $this->handles = array_values(array_filter($names, fn (string $name) => Text::isHandle($name)));
    }

    /** The same song once its author was found inside the name it came with. */
    public function withArtist(string $artist, string $title): self
    {
        $notes = implode(' ', array_filter([$this->live ? 'live' : '', ...$this->cuts]));

        return new self($notes !== '' ? "{$title} ({$notes})" : $title, $artist, [...$this->featured, ...$this->handles], $this->duration);
    }

    /** @return list<string> */
    public function names(): array
    {
        return array_values(array_filter([$this->artist, ...$this->featured], fn (string $name) => Text::key($name) !== ''));
    }

    public function cacheKey(): string
    {
        return sha1(Text::key($this->title).'|'.Text::key($this->artist).'|'.($this->duration ? (int) round($this->duration / 3) : '')
            .'|'.($this->live ? 'live' : '').'|'.implode(',', $this->cuts));
    }
}
