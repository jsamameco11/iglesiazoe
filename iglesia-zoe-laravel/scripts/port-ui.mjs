import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, extname, join, relative } from "path";

const SRC = "D:/Renzo/RENZO/1. G Y S DIGITALS/G Y S DIGITALS CODIGOS/IGLESIA CRISTIANA ZOE/iglesia-zoe/src";
const DEST = "D:/Renzo/RENZO/1. G Y S DIGITALS/G Y S DIGITALS CODIGOS/IGLESIA CRISTIANA ZOE/iglesia-zoe-laravel/resources/js";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function transform(content) {
  content = content.replace(/^"use client";\r?\n/m, "");
  content = content.replace(/from "@\/components\//g, 'from "@/Components/');
  content = content.replace(/from "@\/app\/actions\/(?:auth|media|admin|reports)"/g, 'from "@/lib/actions"');

  if (content.includes('from "next/link"') && content.includes("usePathname")) {
    content = content.replace(/import Link from "next\/link";\r?\n/, "");
    content = content.replace(/import \{ usePathname \} from "next\/navigation";\r?\n/, 'import { Link, usePage } from "@inertiajs/react";\n');
    content = content.replace(/const pathname = usePathname\(\);/, 'const pathname = usePage().url.split("?")[0];');
  } else {
    content = content.replace(/import Link from "next\/link";/g, 'import { Link } from "@inertiajs/react";');
    content = content.replace(/import \{ usePathname \} from "next\/navigation";\r?\n/, 'import { usePage } from "@inertiajs/react";\n');
    content = content.replace(/const pathname = usePathname\(\);/, 'const pathname = usePage().url.split("?")[0];');
  }

  return content;
}

const copies = [
  ["components", "Components"],
  ["propuestas", "propuestas"],
  ["lib", "lib"],
];

for (const [from, to] of copies) {
  cpSync(join(SRC, from), join(DEST, to), {
    recursive: true,
    filter: (source) => !source.replace(/\\/g, "/").includes("/supabase"),
  });
}

for (const file of walk(DEST)) {
  if (![".ts", ".tsx"].includes(extname(file))) continue;
  const next = transform(readFileSync(file, "utf8"));
  writeFileSync(file, next);
}

console.log("UI ported");
