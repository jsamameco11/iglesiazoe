<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;

/** A browser listening to the radio: presence plus the WebRTC handshake for the live microphone. */
class RadioListener extends UuidModel
{
    public $timestamps = false;

    protected $fillable = ['id', 'session', 'state', 'offer', 'answer', 'last_seen', 'state_at'];

    protected function casts(): array
    {
        return [
            'last_seen' => 'immutable_datetime',
            'state_at' => 'immutable_datetime',
        ];
    }
}
