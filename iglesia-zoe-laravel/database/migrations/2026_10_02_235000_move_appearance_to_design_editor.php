<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Domain\Site\Design\NormalizeDesign;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private const PREVIOUS_ESSENCE = "Hace más de 30 años nació una convicción que hoy define todo lo que somos: Cristo no solo vino a darnos salvación, vino a entregarnos su propia vida.\n\nFrente a una sociedad golpeada por la depresión, la ansiedad y la incertidumbre, nuestra certeza es absoluta: si lo tienes a Él, lo tienes todo. No estás llamado a vivir en la escasez, sino a experimentar plenitud en todas las áreas: personal, familiar, económica y espiritual. Más que una congregación, somos una familia.";

    /** Colors and type now live only in the Diseño editor. */
    private const APPEARANCE_SETTINGS = ['headingColor', 'bodyColor', 'accentColor', 'paperColor', 'stoneColor', 'clayColor', 'fontPair'];

    /** Typefaces replaced by the three-family system (Fraunces, Inter, Fredoka). */
    private const RETIRED_FONTS = ['Cormorant Garamond', 'Plus Jakarta Sans'];

    public function up(): void
    {
        $this->updateSite();
        $this->updateDesign();
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        // Content-only migration: the previous values are not kept, so it is not reversible.
    }

    private function updateSite(): void
    {
        $site = SiteSetting::query()->find('site');
        if (! $site || ! is_array($site->value)) {
            return;
        }

        $value = $site->value;
        if (trim((string) ($value['essenceText'] ?? '')) === self::PREVIOUS_ESSENCE) {
            $value['essenceText'] = config('zoe.settings.essenceText');
        }
        foreach (self::APPEARANCE_SETTINGS as $key) {
            unset($value[$key]);
        }

        $site->value = $value;
        $site->updated_at = now();
        $site->save();
    }

    private function updateDesign(): void
    {
        $design = SiteSetting::query()->find('design');
        if (! $design || ! is_array($design->value)) {
            return;
        }

        $value = $design->value;
        foreach (['heading', 'text'] as $role) {
            if (in_array($value['fonts'][$role] ?? null, self::RETIRED_FONTS, true)) {
                unset($value['fonts'][$role]);
            }
        }

        $design->value = NormalizeDesign::run($value);
        $design->updated_at = now();
        $design->save();
    }
};
