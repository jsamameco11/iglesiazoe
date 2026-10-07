<?php

use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The Sunday service starts at 10:30 a.m.: the saved schedule (and the home countdown that reads
     * it) moves from 10:00, and so do the planned visits that chose that service.
     */
    public function up(): void
    {
        $this->replaceSunday('10:00', '10:30');
    }

    public function down(): void
    {
        $this->replaceSunday('10:30', '10:00');
    }

    private function replaceSunday(string $from, string $to): void
    {
        $row = DB::table('site_settings')->where('key', 'site')->first();
        $stored = $row ? json_decode((string) $row->value, true) : null;
        if (is_array($stored) && is_string($stored['sunday'] ?? null) && str_contains($stored['sunday'], $from)) {
            $stored['sunday'] = str_replace($from, $to, $stored['sunday']);
            DB::table('site_settings')->where('key', 'site')->update(['value' => json_encode($stored)]);
            LoadPublicSite::flush();
        }

        foreach (['Domingos', 'Domingo'] as $day) {
            DB::table('visit_plans')->where('service', "{$day} {$from} a.m.")->update(['service' => "{$day} {$to} a.m."]);
        }
    }
};
