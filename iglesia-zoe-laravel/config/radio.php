<?php

/*
|--------------------------------------------------------------------------
| Radio
|--------------------------------------------------------------------------
|
| The station checks the audio files of its library in the background (see
| App\Domain\Radio\RadioHealth) so a missing or broken file never leaves the
| listeners in silence: the music falls back to the next source instead.
|
*/

return [

    'verify_files' => (bool) env('RADIO_VERIFY_FILES', true),

];
