<?php

namespace App\Domain\Geo;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class GeoDirectory
{
    private const TTL = 86400;

    public static function countries(): array
    {
        return Cache::remember('geo:countries', self::TTL, fn () => DB::table('geo_countries')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($row) => [
                'code' => $row->code,
                'name' => $row->name,
                'dial' => $row->dial,
                'flag' => $row->flag,
                'labels' => array_values(array_filter([$row->region_label, $row->city_label, $row->district_label])),
            ])
            ->all());
    }

    public static function dialCodes(): array
    {
        return array_values(array_unique(array_column(self::countries(), 'dial')));
    }

    /**
     * Confirms the chosen place exists in the directory and returns the canonical names.
     *
     * @return array{region: string, city: ?string, district: ?string}|null
     */
    public static function resolve(string $country, string $region, ?string $city, ?string $district): ?array
    {
        $regionRow = DB::table('geo_regions')->where('country_code', strtoupper($country))->where('name', $region)->first();
        if (! $regionRow) {
            return null;
        }

        $cityRow = null;
        if ($city !== null && $city !== '') {
            $cityRow = DB::table('geo_cities')->where('region_id', $regionRow->id)->where('name', $city)->first();
            if (! $cityRow) {
                return null;
            }
        }

        $districtName = null;
        if ($district !== null && $district !== '') {
            if (! $cityRow) {
                return null;
            }
            $districtName = DB::table('geo_districts')->where('city_id', $cityRow->id)->where('name', $district)->value('name');
            if (! $districtName) {
                return null;
            }
        }

        return ['region' => $regionRow->name, 'city' => $cityRow?->name, 'district' => $districtName];
    }
}
