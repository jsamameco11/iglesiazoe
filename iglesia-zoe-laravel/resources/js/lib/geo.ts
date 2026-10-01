export type GeoCountry = { code: string; name: string; dial: string; flag: string; labels: string[] };
export type GeoCity = string | [name: string, districts: string[]];
export type GeoTree = [region: string, cities: GeoCity[]][];

const memo = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  const cached = memo.get(url);
  if (cached) return cached as Promise<T>;
  const request = fetch(url, { headers: { Accept: "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`geo ${res.status}`);
    return res.json() as Promise<T>;
  });
  request.catch(() => memo.delete(url));
  memo.set(url, request);
  return request;
}

export const geo = {
  countries: () => load<GeoCountry[]>("/geo-data/paises.json"),
  tree: (country: string) => load<GeoTree>(`/geo-data/${encodeURIComponent(country.toUpperCase())}.json`),
};

export function citiesOf(tree: GeoTree, region: string): GeoCity[] {
  return tree.find(([name]) => name === region)?.[1] ?? [];
}

export function cityName(city: GeoCity) {
  return typeof city === "string" ? city : city[0];
}

export function districtsOf(cities: GeoCity[], city: string): string[] {
  const match = cities.find((item) => typeof item !== "string" && item[0] === city);
  return match && typeof match !== "string" ? match[1] : [];
}

export function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}
