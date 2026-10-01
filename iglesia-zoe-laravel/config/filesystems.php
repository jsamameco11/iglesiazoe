<?php

$wasabi = [
    'driver' => 's3',
    'key' => env('WASABI_ACCESS_KEY'),
    'secret' => env('WASABI_SECRET_KEY'),
    'region' => env('WASABI_REGION', 'us-central-1'),
    'bucket' => env('WASABI_BUCKET'),
    'endpoint' => rtrim((string) env('WASABI_ENDPOINT', 'https://s3.us-central-1.wasabisys.com'), '/'),
    'use_path_style_endpoint' => true,
    // Only for machines whose HTTPS is inspected by local software; servers keep the system CA store.
    'http' => ['verify' => env('WASABI_CA_BUNDLE') ? base_path(env('WASABI_CA_BUNDLE')) : true],
    'throw' => true,
    'report' => true,
];

// Keeps local or staging uploads apart from production inside the same bucket (e.g. WASABI_PREFIX=dev).
$wasabiPrefix = trim((string) env('WASABI_PREFIX', ''), '/');
$wasabiPrefix = $wasabiPrefix === '' ? '' : $wasabiPrefix.'/';

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Site photos, videos and theme files, readable by anyone with the link.
        'wasabi' => [
            ...$wasabi,
            'url' => $wasabi['endpoint'].'/'.$wasabi['bucket'],
            'root' => $wasabiPrefix.'public',
            'visibility' => 'public',
        ],

        // Receipts, report photos and theme files: only reachable through short-lived signed links.
        'wasabi-private' => [
            ...$wasabi,
            'root' => $wasabiPrefix.'private',
            'visibility' => 'private',
        ],

    ],

    // Where uploads go: Wasabi when it is configured, the local disks otherwise.
    'media' => env('WASABI_BUCKET') ? 'wasabi' : 'public',
    'vault' => env('WASABI_BUCKET') ? 'wasabi-private' : 'local',

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
