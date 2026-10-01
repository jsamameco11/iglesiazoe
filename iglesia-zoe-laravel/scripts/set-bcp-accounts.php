<?php

use App\Models\SiteSetting;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$setting = SiteSetting::query()->firstOrNew(['key' => 'site']);
$value = is_array($setting->value) ? $setting->value : config('zoe.settings');
$value['bankSoles'] = '3052651989073';
$value['bankSolesCci'] = '00230500265198907310';
$value['bankHolder'] = 'Iglesia Cristiana de Fe Zoe';
$value['yapeHolder'] = 'Iglesia Cristiana de Fe Zoe';
$value['yapeQr'] = '/images/yape-qr.png';
$setting->value = $value;
$setting->updated_at = now();
$setting->save();

echo "Cuentas BCP soles actualizadas.\n";
