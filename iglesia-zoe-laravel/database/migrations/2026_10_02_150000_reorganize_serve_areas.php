<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\ServeArea;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Pastoral care and the training path have their own page in the carousel but take no volunteer sign-ups. */
    private const WITHOUT_SIGNUP = ['pastoral', 'ruta-del-servidor'];

    /** First-install areas replaced by Música and by the Atmósfera teams. */
    private const RETIRED = ['alabanza', 'bienvenida', 'intercesion'];

    public function up(): void
    {
        Schema::table('serve_areas', function (Blueprint $table) {
            $table->boolean('accepts_volunteers')->default(true)->after('cta_url');
        });

        foreach (ServeArea::query()->whereIn('slug', self::RETIRED)->get() as $area) {
            if ($this->untouched($area)) {
                $area->delete();
            }
        }

        foreach (config('zoe.serve_areas') as $index => $defaults) {
            $area = ServeArea::query()->where('slug', $defaults['slug'])->first();
            $values = [...$defaults, 'sort_order' => $index + 1, 'accepts_volunteers' => ! in_array($defaults['slug'], self::WITHOUT_SIGNUP, true)];
            if (! $area) {
                ServeArea::query()->create([...$values, 'active' => true]);
            } elseif ($this->untouched($area)) {
                $area->forceFill($values)->save();
            }
        }

        LoadPublicSite::flush();
    }

    public function down(): void
    {
        Schema::table('serve_areas', function (Blueprint $table) {
            $table->dropColumn('accepts_volunteers');
        });
    }

    private function untouched(ServeArea $area): bool
    {
        return $area->created_at && $area->updated_at && $area->created_at->equalTo($area->updated_at);
    }
};
