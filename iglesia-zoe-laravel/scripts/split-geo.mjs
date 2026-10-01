// Splits database/data/geo.json into static files served by the web server:
// public/geo-data/paises.json and one public/geo-data/<CODE>.json tree per country.
// Runs before every `npm run build`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { countries, tree } = JSON.parse(readFileSync(join(root, "database", "data", "geo.json"), "utf8"));
const target = join(root, "public", "geo-data");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "paises.json"), JSON.stringify(countries));
for (const { code } of countries) {
  writeFileSync(join(target, `${code}.json`), JSON.stringify(tree[code] ?? []));
}

console.log(`geo-data: ${countries.length} países`);
