<?php

namespace App\Domain\Radio;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** An audio the radio cannot keep; the message is shown to the admin as it is. */
final class AudioRejected extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }

    /** The answer for the form; "again" tells the browser that its upload is gone and the file must be sent anew. */
    public function response(): JsonResponse
    {
        return response()->json(['error' => $this->getMessage()] + ($this->status === 410 ? ['again' => true] : []), $this->status);
    }
}
