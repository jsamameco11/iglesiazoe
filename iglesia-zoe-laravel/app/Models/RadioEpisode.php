<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A recorded program published on /radio so people can listen to it whenever they want.
 *
 * The audio lives in the library: deleting it there removes the episode too.
 */
class RadioEpisode extends UuidModel
{
    protected $fillable = ['radio_track_id', 'title', 'program', 'description', 'cover_path', 'aired_on', 'published'];

    protected function casts(): array
    {
        return [
            'aired_on' => 'date',
            'published' => 'boolean',
        ];
    }

    private const CARDS_KEY = 'radio.episodes.generation';

    protected static function booted(): void
    {
        static::saved(fn () => self::flushCards());
        static::deleted(fn () => self::flushCards());
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(RadioTrack::class, 'radio_track_id');
    }

    /**
     * Cards of the newest published episodes for /radio, kept in the cache until an episode or an audio changes.
     *
     * @return list<array<string, mixed>>
     */
    public static function publishedCards(int $limit = 60): array
    {
        $generation = Cache::rememberForever(self::CARDS_KEY, fn () => Str::random(12));

        return Cache::remember("radio.episodes.{$generation}.{$limit}", now()->addDay(), fn () => self::published()->limit($limit)->get()->map->card()->all());
    }

    /** Called whenever an episode or an audio changes; again after the transaction commits, so no cache keeps what it replaced. */
    public static function flushCards(): void
    {
        Cache::forever(self::CARDS_KEY, Str::random(12));
        DB::afterCommit(fn () => Cache::forever(self::CARDS_KEY, Str::random(12)));
    }

    /** Visible on /radio, newest first. A deactivated or missing audio stays out of the page. */
    public static function published(): Builder
    {
        return self::query()
            ->where('published', true)
            ->whereHas('track', fn (Builder $track) => $track->where('active', true)->whereNotNull('file_path')->where('file_path', '!=', ''))
            ->with('track')
            ->orderByDesc('aired_on')
            ->orderByDesc('created_at');
    }

    public function card(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'program' => $this->program,
            'description' => $this->description,
            'cover' => $this->cover_path,
            'src' => $this->track?->file_path,
            'duration' => $this->track?->duration ?? 0,
            'aired_on' => $this->aired_on->toDateString(),
        ];
    }

    public function full(): array
    {
        return [
            ...$this->card(),
            'track_id' => $this->radio_track_id,
            'track_title' => $this->track?->title,
            'published' => $this->published,
        ];
    }
}
