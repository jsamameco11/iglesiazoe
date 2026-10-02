<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Laravel Boost (development only)
    |--------------------------------------------------------------------------
    |
    | The site is released to its own VPS with deploy/release.ps1, so the
    | Laravel Cloud guideline and skill are left out of the agent context.
    |
    */

    'guidelines' => [
        'exclude' => ['deployments'],
    ],

    'skills' => [
        'exclude' => ['deploying-to-cloud'],
    ],

];
