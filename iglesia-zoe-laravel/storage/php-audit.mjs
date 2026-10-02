import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".php") ? [path] : [];
  });

const routes = readdirSync("routes").map((file) => readFileSync(join("routes", file), "utf8")).join("\n");
const appFiles = walk("app");
const everything = [...appFiles, ...walk("routes"), ...walk("config"), ...walk("database"), ...walk("bootstrap"), ...walk("resources/views")];
const text = Object.fromEntries(everything.map((file) => [file, readFileSync(file, "utf8")]));
let checked = 0;

for (const file of walk("app/Http/Controllers")) {
  const cls = basename(file, ".php");
  for (const match of text[file].matchAll(/public function (\w+)\(/g)) {
    checked++;
    const name = match[1];
    if (name === "__construct" || name === "__invoke") continue;
    const routed = new RegExp(`${cls}::class,\\s*'${name}'`).test(routes);
    if (!routed) console.log(`UNROUTED ${cls}::${name}`);
  }
}

for (const file of appFiles) {
  const cls = basename(file, ".php");
  const others = everything.filter((path) => path !== file).map((path) => text[path]).join("\n");
  if (!new RegExp(`\\b${cls}\\b`).test(others)) console.log(`UNUSED CLASS ${file}`);
  if (file.includes("Controllers")) continue;
  for (const match of text[file].matchAll(/(?:public|protected|private) (?:static )?function (\w+)\(/g)) {
    checked++;
    const name = match[1];
    if (name.startsWith("__")) continue;
    const self = (text[file].match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
    if (self > 1) continue;
    if (new RegExp(`(->|::|['"])${name}\\b`).test(others)) continue;
    if (/scope[A-Z]|Attribute$|^(casts|boot|booted|register|handle|share|version|rootView|rules|authorize|toArray|via|toMail|definition|up|down|run)$/.test(name)) continue;
    console.log(`UNUSED METHOD ${file}::${name}`);
  }
}
console.log(`checked ${checked} methods in ${appFiles.length} files`);
