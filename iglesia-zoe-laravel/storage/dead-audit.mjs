import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const root = resolve("resources/js");
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?)$/.test(path) ? [path] : [];
  });

const files = walk(root);
const code = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));
const norm = (path) => path.replace(/\\/g, "/").replace(/\.(tsx?|d\.ts)$/, "").replace(/\/index$/, "");

const importers = new Map(files.map((file) => [norm(file), []]));
for (const file of files) {
  for (const match of code[file].matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const spec = match[1];
    let target;
    if (spec.startsWith("@/")) target = norm(join(root, spec.slice(2)));
    else if (spec.startsWith(".")) target = norm(resolve(dirname(file), spec));
    else continue;
    if (importers.has(target)) importers.get(target).push(file);
  }
}

for (const file of files) {
  for (const match of code[file].matchAll(/export \*(?: from|\s+from)\s*["'](\.[^"']+)["']/g)) {
    const target = norm(resolve(dirname(file), match[1]));
    importers.get(target)?.push(...importers.get(norm(file)));
  }
}

for (const file of files) {
  const key = norm(file);
  const rel = relative(root, file).replace(/\\/g, "/");
  if (rel.startsWith("Pages/") || rel === "app.tsx" || rel.endsWith(".d.ts")) continue;
  const users = importers.get(key);
  if (!users.length) {
    console.log(`UNUSED FILE ${rel}`);
    continue;
  }
  for (const match of code[file].matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface|let)\s+(\w+)/g)) {
    const name = match[1];
    const used = users.some((user) => new RegExp(`\\b${name}\\b`).test(code[user]));
    const internal = (code[file].match(new RegExp(`\\b${name}\\b`, "g")) || []).length > 1;
    if (!used) console.log(`${internal ? "EXPORT ONLY USED INSIDE" : "UNUSED EXPORT"} ${rel} :: ${name}`);
  }
}
