<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
     * Phone notifications for the web forms. Without keys here the app creates
     * a pair once and keeps it in site_settings.
     */
    'webpush' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', env('ZOE_SITE_URL', 'https://iglesiacristianazoe.miacademiapreu.com')),
    ],

    /*
     * Free music databases the radio library asks to identify a song (author, co-authors,
     * album, year, genres and cover). None needs a key; MusicBrainz asks for one request per
     * second and a User-Agent with a contact.
     */
    'music' => [
        'agent' => env('MUSIC_LOOKUP_AGENT', 'IglesiaZoeRadio/1.0 ( '.env('ZOE_SITE_URL', 'https://iglesiacristianazoe.miacademiapreu.com').' )'),
        'musicbrainz_gap_ms' => (int) env('MUSICBRAINZ_GAP_MS', 1100),
        'timeout' => (int) env('MUSIC_LOOKUP_TIMEOUT', 8),
        'store' => env('MUSIC_LOOKUP_STORE', 'US'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
