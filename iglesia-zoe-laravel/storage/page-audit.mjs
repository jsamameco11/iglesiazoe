import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const walk = (dir, ext) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, ext) : path.endsWith(ext) ? [path] : [];
  });

const php = [...walk("app", ".php"), ...walk("routes", ".php")].map((file) => readFileSync(file, "utf8")).join("\n");
const rendered = new Set([...php.matchAll(/(?:Inertia::render|inertia)\(\s*'([^']+)'/g)].map((match) => match[1]));
const pages = walk("resources/js/Pages", ".tsx").map((file) => relative("resources/js/Pages", file).replace(/\\/g, "/").replace(/\.tsx$/, ""));

for (const page of pages) if (!rendered.has(page)) console.log(`PAGE NOT RENDERED ${page}`);
for (const page of rendered) if (!pages.includes(page)) console.log(`RENDER WITHOUT PAGE ${page}`);

const routes = readdirSync("routes").map((file) => readFileSync(join("routes", file), "utf8")).join("\n");
const paths = new Set([...routes.matchAll(/Route::(?:get|post|put|patch|delete|match|any)\(\s*(?:\[[^\]]*\],\s*)?'([^']+)'/g)].map((match) => match[1].replace(/^\//, "")));
const js = walk("resources/js", ".tsx").concat(walk("resources/js", ".ts")).map((file) => [file, readFileSync(file, "utf8")]);
const links = new Map();
for (const [file, code] of js)
  for (const match of code.matchAll(/["'`](\/(?:admin\/)?[a-z0-9\-\/]*)["'`]/g)) {
    const url = match[1];
    if (url.length < 2 || url.startsWith("//") || /\.(png|jpe?g|svg|webp|mp3|js|css)$/.test(url)) continue;
    if (!links.has(url)) links.set(url, relative("resources/js", file));
  }

const prefixes = [...paths];
for (const [url, file] of links) {
  const path = url.replace(/^\//, "").replace(/\/$/, "");
  const candidates = [path, path.replace(/^admin\//, ""), path.replace(/^admin$/, "/")];
  const ok = candidates.some((candidate) =>
    prefixes.some((route) => {
      const pattern = new RegExp(`^${route.replace(/^\//, "").replace(/\{[^}]+\}/g, "[^/]+")}$`);
      return pattern.test(candidate) || route.replace(/\{[^}]+\}.*$/, "").replace(/\/$/, "") === candidate;
    }),
  );
  if (!ok && path !== "") console.log(`LINK WITHOUT ROUTE ${url} (${file})`);
}
console.log(`${pages.length} pages, ${rendered.size} rendered, ${links.size} links, ${paths.size} routes`);
