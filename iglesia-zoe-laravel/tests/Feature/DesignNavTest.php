<?php

namespace Tests\Feature;

use App\Domain\Site\Design\NormalizeDesign;
use Tests\TestCase;

class DesignNavTest extends TestCase
{
    public function test_the_menu_keeps_its_original_look_until_it_is_changed(): void
    {
        $this->assertArrayNotHasKey('nav', NormalizeDesign::run([]));
        $this->assertArrayNotHasKey('nav', NormalizeDesign::run(['nav' => ['font' => 'cursiva', 'size' => 'grande']]));
    }

    public function test_menu_typography_is_clamped_to_safe_values(): void
    {
        $nav = NormalizeDesign::run(['nav' => [
            'font' => 'heading',
            'size' => 40,
            'weight' => 450,
            'dropSize' => 13.3,
            'dropWeight' => 100,
            'tracking' => 0.0123,
            'color' => 'red',
        ]])['nav'];

        $this->assertSame(['font' => 'heading', 'size' => 19.0, 'weight' => 500, 'dropSize' => 13.5, 'dropWeight' => 300, 'tracking' => 0.01], $nav);
    }
}
