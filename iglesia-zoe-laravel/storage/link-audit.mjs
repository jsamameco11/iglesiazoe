import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|php)$/.test(path) ? [path] : [];
  });

const routes = JSON.parse(readFileSync("storage/routes.json", "utf8").replace(/^\uFEFF/, ""));
const patterns = routes.map((route) => ({
  methods: route.method.split("|"),
  domain: route.domain,
  uri: route.uri,
  regex: new RegExp("^/" + route.uri.replace(/^\//, "").replace(/\{[^}]+\?\}/g, "[^/]*").replace(/\{[^}]+\}/g, "[^/]+") + "/?$"),
}));

const files = walk("resources/js");
const seen = new Map();
for (const file of files) {
  const code = readFileSync(file, "utf8");
  for (const match of code.matchAll(/(?:href=|send\(|postForm\(|fetch\(|router\.(?:get|post|visit)\(|action=|postJson\(|url:\s*|href:\s*)\s*\{?\s*[`"']([^`"']+)[`"']/g)) {
    let url = match[1].split("?")[0].replace(/\$\{[^}]+\}/g, "x");
    if (!url.startsWith("/") || url.startsWith("//") || /\.(png|jpe?g|svg|webp|mp3|wav|pdf)$/.test(url) || url.startsWith("/images") || url.startsWith("/videos") || url.startsWith("/media") || url.startsWith("/radio-preview")) continue;
    const method = /send\(|postForm\(|postJson\(|router\.post/.test(match[0]) ? "POST" : "GET";
    const key = `${method} ${url}`;
    if (!seen.has(key)) seen.set(key, relative("resources/js", file));
  }
}

let bad = 0;
for (const [key, file] of seen) {
  const [method, url] = key.split(" ");
  const hit = patterns.find((route) => route.regex.test(url) && route.methods.includes(method));
  if (!hit) {
    bad++;
    console.log(`MISSING ${key}  (${file})`);
  }
}
console.log(`${seen.size} frontend URLs checked, ${bad} without a matching route`);
