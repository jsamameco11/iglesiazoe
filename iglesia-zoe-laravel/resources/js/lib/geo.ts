export type GeoCountry = { code: string; name: string; dial: string; flag: string; labels: string[] };
export type GeoPlace = { id: number; name: string };

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
  countries: () => load<GeoCountry[]>("/geo/paises"),
  regions: (country: string) => load<GeoPlace[]>(`/geo/regiones/${encodeURIComponent(country)}`),
  cities: (region: number) => load<GeoPlace[]>(`/geo/ciudades/${region}`),
  districts: (city: number) => load<string[]>(`/geo/distritos/${city}`),
};

export function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}
