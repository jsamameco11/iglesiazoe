<?php

use App\Models\SiteSetting;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$row = SiteSetting::query()->where('key', 'site')->first();
$value = is_array($row?->value) ? $row->value : [];
$value['yapeQr'] = '/images/yape-qr-2.png';
$row->value = $value;
$row->save();

echo $row->value['yapeQr'], PHP_EOL;
