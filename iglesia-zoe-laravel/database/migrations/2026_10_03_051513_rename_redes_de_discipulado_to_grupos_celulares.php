<?php

use App\Domain\Site\Actions\LoadPublicSite;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SLUG = 'redes-de-discipulado';

    /** The adults ministry is called Grupos Celulares everywhere; a name already changed in the admin is kept. */
    public function up(): void
    {
        DB::table('ministries')->where('slug', self::SLUG)->where('name', 'Redes de Discipulado')->update(['name' => 'Grupos Celulares', 'updated_at' => now()]);
        LoadPublicSite::flush();
    }

    public function down(): void
    {
        DB::table('ministries')->where('slug', self::SLUG)->where('name', 'Grupos Celulares')->update(['name' => 'Redes de Discipulado', 'updated_at' => now()]);
        LoadPublicSite::flush();
    }
};
