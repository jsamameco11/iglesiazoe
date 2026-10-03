<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One block of the radio timeline at an exact time (stored in UTC).
 *
 * Layer 0 is the main program: its blocks never overlap and gaps are filled with the
 * continuous music. Overlay layers 1–3 play on top of it (announcements, effects, jingles),
 * at their own volume and optionally lowering the music underneath while they sound.
 *
 * An automatic-music block («automatica») holds a period of the main program for one
 * playlist (or all of them), shuffled or in order; outside those periods the gaps play
 * the station's default automatic music.
 */
class RadioSlot extends UuidModel
{
    public const LIVE = 'vivo';

    public const AUTO = 'automatica';

    public const MAIN = 0;

    public const OVERLAYS = 3;

    /** Blocks chain one after another, so start times keep their milliseconds. */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected $fillable = ['starts_at', 'duration', 'kind', 'layer', 'radio_track_id', 'radio_playlist_id', 'title', 'note', 'bed', 'shuffle', 'duck', 'volume'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'duration' => 'float',
            'layer' => 'integer',
            'bed' => 'boolean',
            'shuffle' => 'boolean',
            'duck' => 'boolean',
            'volume' => 'integer',
        ];
    }

    public static function layerLabel(int $layer): string
    {
        return $layer === self::MAIN ? 'pista principal' : 'capa '.$layer;
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(RadioTrack::class, 'radio_track_id');
    }

    public function playlist(): BelongsTo
    {
        return $this->belongsTo(RadioPlaylist::class, 'radio_playlist_id');
    }

    public function endsAt(): CarbonImmutable
    {
        return $this->starts_at->addMilliseconds((int) round($this->duration * 1000));
    }
}
