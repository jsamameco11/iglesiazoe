<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GeoSeeder extends Seeder
{
    private const CHUNK = 500;

    public function run(): void
    {
        $path = database_path('data/geo.json');
        $data = json_decode((string) file_get_contents($path), true);
        if (! is_array($data) || empty($data['countries']) || empty($data['tree'])) {
            throw new RuntimeException('No se pudo leer database/data/geo.json');
        }

        DB::transaction(function () use ($data) {
            DB::table('geo_districts')->delete();
            DB::table('geo_cities')->delete();
            DB::table('geo_regions')->delete();
            DB::table('geo_countries')->delete();

            foreach ($data['countries'] as $index => $country) {
                DB::table('geo_countries')->insert([
                    'code' => $country['code'],
                    'name' => $country['name'],
                    'dial' => $country['dial'],
                    'flag' => $country['flag'] ?? '',
                    'region_label' => $country['labels'][0],
                    'city_label' => $country['labels'][1] ?? null,
                    'district_label' => $country['labels'][2] ?? null,
                    'sort_order' => $index,
                ]);
            }

            foreach ($data['tree'] as $code => $regions) {
                foreach ($regions as [$regionName, $children]) {
                    $regionId = DB::table('geo_regions')->insertGetId(['country_code' => $code, 'name' => $regionName]);
                    $plain = [];
                    foreach ($children as $child) {
                        if (is_array($child)) {
                            [$cityName, $districts] = $child;
                            $cityId = DB::table('geo_cities')->insertGetId(['region_id' => $regionId, 'name' => $cityName]);
                            foreach (array_chunk($districts, self::CHUNK) as $chunk) {
                                DB::table('geo_districts')->insert(array_map(fn ($name) => ['city_id' => $cityId, 'name' => $name], $chunk));
                            }
                        } else {
                            $plain[] = ['region_id' => $regionId, 'name' => $child];
                        }
                    }
                    foreach (array_chunk($plain, self::CHUNK) as $chunk) {
                        DB::table('geo_cities')->insert($chunk);
                    }
                }
            }
        });
    }
}
