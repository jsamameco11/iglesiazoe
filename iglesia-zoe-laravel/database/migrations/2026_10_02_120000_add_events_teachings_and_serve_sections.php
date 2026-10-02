<?php

use App\Domain\Site\Actions\LoadPublicSite;
use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Texts that were the shipped defaults; a stored copy equal to them follows the new, shorter default. */
    private const RETIRED_DEFAULTS = [
        'giveBody' => 'Creemos que dar es un acto de adoración, gratitud y obediencia a Dios. Gracias a tu generosidad y fidelidad, podemos seguir llevando el mensaje de amor, sosteniendo la obra de la iglesia y ayudando a quienes más lo necesitan.',
        'giveYapeText' => 'Envía tu aporte al número de la iglesia o pregunta en recepción.',
    ];

    public function up(): void
    {
        Schema::create('church_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->string('time_label', 60)->nullable();
            $table->string('location', 160)->nullable();
            $table->string('summary', 300)->nullable();
            $table->text('body')->nullable();
            $table->string('image_path')->nullable();
            $table->string('cta_label', 40)->nullable();
            $table->string('cta_url')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'starts_on']);
        });

        Schema::create('teachings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('kind', 20)->default('predica');
            $table->date('teaching_date');
            $table->string('summary', 400)->nullable();
            $table->string('file_path')->nullable();
            $table->string('youtube_id', 20)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'kind', 'teaching_date']);
        });

        $site = SiteSetting::query()->find('site');
        if ($site && is_array($site->value)) {
            $value = $site->value;
            foreach (self::RETIRED_DEFAULTS as $key => $old) {
                if (($value[$key] ?? null) === $old) {
                    unset($value[$key]);
                }
            }
            $site->value = $value;
            $site->updated_at = now();
            $site->save();
        }
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        Schema::dropIfExists('teachings');
        Schema::dropIfExists('church_events');
    }
};
