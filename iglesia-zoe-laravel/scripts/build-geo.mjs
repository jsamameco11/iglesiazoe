// Builds database/data/geo.json from country-state-city (states and cities) and the
// INEI ubigeo files (Peru: departamentos, provincias, distritos).
// Usage: node scripts/build-geo.mjs <source-dir>
// The source dir must contain node_modules/country-state-city and ubigeo_peru_2016_*.json.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(process.argv[2] || ".");
const require = createRequire(join(source, "package.json"));
const csc = (file) => require(`country-state-city/lib/cjs/assets/${file}.json`);
const states = csc("state");
const cities = csc("city");
const countryMeta = csc("country");
const ubigeo = (file) => require(join(source, `ubigeo_peru_2016_${file}.json`));

const countries = [
  ["PE", "Perú", ["Departamento", "Provincia", "Distrito"]],
  ["AR", "Argentina", ["Provincia", "Ciudad"]],
  ["BZ", "Belice", ["Distrito", "Ciudad"]],
  ["BO", "Bolivia", ["Departamento", "Ciudad o municipio"]],
  ["BR", "Brasil", ["Estado", "Ciudad"]],
  ["CL", "Chile", ["Región", "Comuna o ciudad"]],
  ["CO", "Colombia", ["Departamento", "Municipio"]],
  ["CR", "Costa Rica", ["Provincia", "Cantón o ciudad"]],
  ["CU", "Cuba", ["Provincia", "Municipio"]],
  ["EC", "Ecuador", ["Provincia", "Cantón o ciudad"]],
  ["SV", "El Salvador", ["Departamento", "Municipio"]],
  ["ES", "España", ["Comunidad autónoma", "Municipio"]],
  ["US", "Estados Unidos", ["Estado", "Ciudad"]],
  ["FR", "Francia", ["Región", "Ciudad"]],
  ["GT", "Guatemala", ["Departamento", "Municipio"]],
  ["HT", "Haití", ["Departamento", "Ciudad"]],
  ["HN", "Honduras", ["Departamento", "Municipio"]],
  ["IT", "Italia", ["Región", "Comuna"]],
  ["MX", "México", ["Estado", "Municipio o ciudad"]],
  ["NI", "Nicaragua", ["Departamento", "Municipio"]],
  ["PA", "Panamá", ["Provincia", "Distrito o ciudad"]],
  ["PY", "Paraguay", ["Departamento", "Ciudad"]],
  ["PT", "Portugal", ["Distrito", "Ciudad"]],
  ["PR", "Puerto Rico", ["Municipio"]],
  ["DO", "República Dominicana", ["Provincia", "Municipio"]],
  ["UY", "Uruguay", ["Departamento", "Ciudad"]],
  ["VE", "Venezuela", ["Estado", "Ciudad"]],
];

const rename = {
  ES: {
    Andalusia: "Andalucía", Aragon: "Aragón", "Castilla La Mancha": "Castilla-La Mancha", "Canary Islands": "Canarias",
    Catalonia: "Cataluña", "Léon": "Castilla y León", Murcia: "Región de Murcia", Madrid: "Comunidad de Madrid",
    "Balearic Islands": "Islas Baleares", "Basque Country": "País Vasco", Valencia: "Comunidad Valenciana", Asturias: "Principado de Asturias",
  },
  IT: {
    Piedmont: "Piamonte", "Aosta Valley": "Valle de Aosta", Lombardy: "Lombardía", "Trentino-South Tyrol": "Trentino-Alto Adigio",
    "Friuli–Venezia Giulia": "Friuli-Venecia Julia", Tuscany: "Toscana", Sicily: "Sicilia", Sardinia: "Cerdeña", Lazio: "Lacio", Marche: "Marcas",
  },
  FR: {
    Corse: "Córcega", Bretagne: "Bretaña", Normandie: "Normandía", Occitanie: "Occitania", "Nouvelle-Aquitaine": "Nueva Aquitania",
    "Grand-Est": "Gran Este", "Hauts-de-France": "Altos de Francia", "Île-de-France": "Isla de Francia", "Centre-Val de Loire": "Centro-Valle de Loira",
    "Provence-Alpes-Côte-d’Azur": "Provenza-Alpes-Costa Azul", "Pays-de-la-Loire": "País del Loira", "Auvergne-Rhône-Alpes": "Auvernia-Ródano-Alpes",
    "Bourgogne-Franche-Comté": "Borgoña-Franco Condado",
  },
  PT: { Lisbon: "Lisboa", "Açores": "Azores" },
  US: {
    "District of Columbia": "Distrito de Columbia", "North Carolina": "Carolina del Norte", "North Dakota": "Dakota del Norte",
    "South Carolina": "Carolina del Sur", "South Dakota": "Dakota del Sur", "New Mexico": "Nuevo México", "New York": "Nueva York",
    "New Jersey": "Nueva Jersey", "New Hampshire": "Nuevo Hampshire", Pennsylvania: "Pensilvania", Hawaii: "Hawái", Louisiana: "Luisiana",
    "West Virginia": "Virginia Occidental",
  },
  CU: { "Havana Province": "La Habana" },
  NI: { "North Caribbean Coast": "Costa Caribe Norte", "South Caribbean Coast": "Costa Caribe Sur" },
  HN: { "Bay Islands Department": "Islas de la Bahía" },
  CR: { "Provincia de Cartago": "Cartago" },
  PA: { "Emberá-Wounaan Comarca": "Comarca Emberá-Wounaan", "Ngöbe-Buglé Comarca": "Comarca Ngäbe-Buglé", "Guna Yala": "Comarca Guna Yala" },
  HT: { Centre: "Centro", Nord: "Norte", "Nord-Est": "Noreste", "Nord-Ouest": "Noroeste", Ouest: "Oeste", Sud: "Sur", "Sud-Est": "Sureste" },
  EC: { "Morona-Santiago": "Morona Santiago" },
};

const extraStates = { ES: ["AS"] };
const skipStates = { US: ["PR"] };

const collator = new Intl.Collator("es", { sensitivity: "base" });
const sortNames = (list) => [...new Set(list.map((name) => name.trim()).filter(Boolean))].sort(collator.compare);

function cleanState(country, name) {
  const fixed = rename[country]?.[name];
  if (fixed) return fixed;
  return name.replace(/ (Department|Province|District)$/u, "").trim();
}

function dialFor(code) {
  const meta = countryMeta.find((item) => item.isoCode === code);
  return String(meta?.phonecode || "").replace(/^\+/, "").split(/[^0-9]/)[0];
}

function flagFor(code) {
  return countryMeta.find((item) => item.isoCode === code)?.flag || "";
}

function peru() {
  const departments = ubigeo("departamentos");
  const provinces = ubigeo("provincias");
  const districts = ubigeo("distritos");
  return departments
    .map((dep) => [
      dep.name.trim(),
      provinces
        .filter((prov) => prov.department_id === dep.id)
        .map((prov) => [prov.name.trim(), sortNames(districts.filter((dist) => dist.province_id === prov.id).map((dist) => dist.name))])
        .sort((a, b) => collator.compare(a[0], b[0])),
    ])
    .sort((a, b) => collator.compare(a[0], b[0]));
}

function puertoRico() {
  return sortNames(cities.filter((row) => row[1] === "US" && row[2] === "PR").map((row) => row[0])).map((name) => [name, []]);
}

function generic(code) {
  const byState = new Map();
  for (const row of cities) {
    if (row[1] !== code) continue;
    if (!byState.has(row[2])) byState.set(row[2], []);
    byState.get(row[2]).push(row[0]);
  }
  const keep = states.filter(
    (state) =>
      state.countryCode === code &&
      !(skipStates[code] || []).includes(state.isoCode) &&
      (byState.has(state.isoCode) || (extraStates[code] || []).includes(state.isoCode)),
  );
  const merged = new Map();
  for (const state of keep) {
    const name = cleanState(code, state.name);
    merged.set(name, [...(merged.get(name) || []), ...(byState.get(state.isoCode) || [])]);
  }
  return [...merged.entries()].map(([name, list]) => [name, sortNames(list)]).sort((a, b) => collator.compare(a[0], b[0]));
}

const tree = {};
for (const [code] of countries) {
  tree[code] = code === "PE" ? peru() : code === "PR" ? puertoRico() : generic(code);
}

const output = {
  countries: countries.map(([code, name, labels]) => ({ code, name, dial: dialFor(code), flag: flagFor(code), labels })),
  tree,
};

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "database", "data", "geo.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(output));

let regions = 0;
let places = 0;
let districts = 0;
for (const list of Object.values(tree)) {
  regions += list.length;
  for (const [, children] of list) {
    places += children.length;
    for (const child of children) if (Array.isArray(child)) districts += child[1].length;
  }
}
console.log(`countries=${countries.length} regions=${regions} places=${places} districts=${districts}`);
