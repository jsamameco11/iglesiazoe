<?php

namespace App\Domain\Games\Rooms;

use RuntimeException;

/** A move the room refuses; its message is shown to the player as is. */
class RoomError extends RuntimeException {}
