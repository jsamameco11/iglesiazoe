<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class GivingSettingsSeeder extends Seeder
{
    /**
     * Publishes the giving keys without touching any other saved setting.
     */
    public function run(): void
    {
        $keys = ['bankSoles', 'bankSolesCci', 'bankDollars', 'bankDollarsCci', 'bankHolder', 'yape', 'yapeHolder', 'yapeQr'];
        $defaults = config('zoe.settings');
        $row = SiteSetting::query()->firstOrNew(['key' => 'site']);
        $stored = is_array($row->value) ? $row->value : [];

        foreach ($keys as $key) {
            if (($stored[$key] ?? '') === '') {
                $stored[$key] = $defaults[$key];
            }
        }

        $row->value = $stored;
        $row->updated_at = now();
        $row->save();
    }
}
