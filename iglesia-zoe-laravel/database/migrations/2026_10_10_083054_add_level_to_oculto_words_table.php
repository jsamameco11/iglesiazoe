<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * El Cristiano Oculto gets two levels: the best-known words and phrases play as "intermedio",
 * everything else as "difícil". A few classic words join the intermediate level.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('oculto_words', function (Blueprint $table) {
            $table->string('level', 12)->default('dificil')->after('clues')->index();
        });

        $data = json_decode((string) file_get_contents(database_path('data/games/oculto-levels.json')), true, flags: JSON_THROW_ON_ERROR);
        $known = array_flip(array_map(fn (string $word) => mb_strtolower($word), $data['intermedio']));

        $intermediate = DB::table('oculto_words')->get(['id', 'word'])
            ->filter(fn (object $row) => isset($known[mb_strtolower($row->word)]))
            ->pluck('id');
        foreach ($intermediate->chunk(200) as $ids) {
            DB::table('oculto_words')->whereIn('id', $ids->all())->update(['level' => 'intermedio']);
        }

        $themes = DB::table('oculto_categories')->pluck('id')->flip();
        $present = DB::table('oculto_words')->pluck('word')->map(fn (string $word) => mb_strtolower($word))->flip();
        $now = now();
        $rows = collect($data['new'])
            ->filter(fn (array $row) => $themes->has($row['category_id']) && ! $present->has(mb_strtolower($row['word'])))
            ->map(fn (array $row) => [
                'id' => (string) Str::uuid(),
                'oculto_category_id' => $row['category_id'],
                'word' => $row['word'],
                'description' => $row['description'],
                'reference' => $row['reference'],
                'clues' => json_encode($row['clues'], JSON_UNESCAPED_UNICODE),
                'level' => 'intermedio',
                'active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        if ($rows->isNotEmpty()) {
            DB::table('oculto_words')->insert($rows->values()->all());
        }
    }

    public function down(): void
    {
        $data = json_decode((string) file_get_contents(database_path('data/games/oculto-levels.json')), true, flags: JSON_THROW_ON_ERROR);
        DB::table('oculto_words')->whereIn('word', array_column($data['new'], 'word'))->delete();

        Schema::table('oculto_words', function (Blueprint $table) {
            $table->dropIndex(['level']);
            $table->dropColumn('level');
        });
    }
};
