<?php

use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const KEYS = ['liveUrl', 'liveYoutubeId'];

    /** The EN VIVO button and the live player now follow the church's own broadcast, so the pasted links go away. */
    public function up(): void
    {
        $row = DB::table('site_settings')->where('key', 'site')->first();
        $stored = $row ? json_decode((string) $row->value, true) : null;
        if (is_array($stored) && array_intersect(self::KEYS, array_keys($stored))) {
            DB::table('site_settings')->where('key', 'site')->update(['value' => json_encode(array_diff_key($stored, array_flip(self::KEYS)))]);
        }

        if (Schema::hasColumn('sermons', 'is_live')) {
            Schema::table('sermons', function (Blueprint $table) {
                $table->dropColumn('is_live');
            });
        }

        LoadPublicSite::flush();
    }

    public function down(): void
    {
        if (! Schema::hasColumn('sermons', 'is_live')) {
            Schema::table('sermons', function (Blueprint $table) {
                $table->boolean('is_live')->default(false);
            });
        }
    }
};
