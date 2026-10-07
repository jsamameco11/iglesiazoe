<?php

/*
|--------------------------------------------------------------------------
| Live streaming
|--------------------------------------------------------------------------
|
| OBS (or any RTMP/SRT encoder) sends the signal to the media server
| (MediaMTX) on the VPS, which records it in its original quality, serves
| it to the site and relays it untouched to YouTube. deploy/stream-setup.sh
| installs the media server, the queue worker and the scheduler.
|
*/

return [

    'host' => env('STREAM_HOST', parse_url((string) env('ZOE_SITE_URL', 'https://iglesiacristianazoe.miacademiapreu.com'), PHP_URL_HOST)),

    'path' => env('STREAM_PATH', 'envivo'),

    'user' => env('STREAM_USER', 'zoe'),

    'rtmp_port' => (int) env('STREAM_RTMP_PORT', 1935),

    'srt_port' => (int) env('STREAM_SRT_PORT', 8890),

    'api' => rtrim((string) env('STREAM_API_URL', 'http://127.0.0.1:9997'), '/'),

    'player' => rtrim((string) env('STREAM_PLAYER_PATH', '/transmision/senal'), '/'),

    'recordings' => env('STREAM_RECORDINGS', '/var/lib/zoe-stream/grabaciones'),

    'ffmpeg' => env('STREAM_FFMPEG', 'ffmpeg'),

    'ffprobe' => env('STREAM_FFPROBE', 'ffprobe'),

    /** Recordings stay on Wasabi this long, only to download them for editing. */
    'retention_hours' => (int) env('STREAM_RETENTION_HOURS', 72),

    /** A broadcast that lost its signal ends on its own after this many minutes. */
    'grace_minutes' => (int) env('STREAM_GRACE_MINUTES', 15),

    /** After a broadcast ends, a new signal waits this long before opening a quick broadcast. */
    'cooldown_seconds' => 120,

    'uploads' => storage_path('app/private/subidas-video'),

    'upload_max_gb' => (int) env('STREAM_UPLOAD_MAX_GB', 40),

    /** Chunk size for edited videos sent from the panel; YouTube needs multiples of 256 KB. */
    'chunk_mb' => 16,

    'queue' => env('STREAM_QUEUE_CONNECTION', 'stream'),

    'youtube' => [
        'client_id' => env('YOUTUBE_CLIENT_ID'),
        'client_secret' => env('YOUTUBE_CLIENT_SECRET'),
    ],

];
