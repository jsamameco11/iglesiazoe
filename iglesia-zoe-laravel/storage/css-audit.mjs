import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir, ext) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, ext) : ext.some((e) => path.endsWith(e)) ? [path] : [];
  });

const sources = [...walk("resources/js", [".ts", ".tsx"]), ...walk("resources/views", [".php"]), ...walk("app", [".php"]), ...walk("config", [".php"])]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

for (const file of walk("resources/css", [".css"])) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const classes = new Set();
  for (const block of css.split("{")) {
    const selector = block.split("}").pop();
    for (const match of selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) classes.add(match[1]);
  }
  const unused = [...classes].filter((name) => {
    const escaped = name.replace(/[-]/g, "\\-");
    if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(sources)) return false;
    const prefix = name.replace(/-[^-]+$/, "-");
    return !(prefix !== name && new RegExp(`["'\`\\s]${prefix.replace(/[-]/g, "\\-")}\\$\\{`).test(sources));
  });
  console.log(`${file}: ${classes.size} classes, ${unused.length} unused`);
  if (unused.length) console.log("  " + unused.join(" "));
}
