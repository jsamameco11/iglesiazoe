<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const OLD = [
        'address' => 'Calle Bolívar 755, Chiclayo',
        'mapUrl' => 'https://www.google.com/maps/search/?api=1&query=Calle+Bolivar+755+Chiclayo',
    ];

    public function up(): void
    {
        $site = SiteSetting::query()->find('site');
        if (! $site || ! is_array($site->value)) {
            return;
        }

        $value = $site->value;
        foreach (self::OLD as $key => $old) {
            if (($value[$key] ?? null) === $old) {
                $value[$key] = config("zoe.settings.$key");
            }
        }

        if ($value !== $site->value) {
            $site->update(['value' => $value]);
        }
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        // Content-only migration: the previous address was wrong, so it is not restored.
    }
};
