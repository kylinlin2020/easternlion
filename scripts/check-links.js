#!/usr/bin/env node
/**
 * Internal link checker for the built site.
 *   node scripts/check-links.js [siteDir]
 * Default siteDir: ./public
 * Exits with 1 when a link points at a file that does not exist.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
if (!fs.existsSync(root)) {
  console.error("site directory not found:", root);
  process.exit(1);
}

const problems = [];
let checked = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) check(p);
  }
}

function check(file) {
  const html = fs.readFileSync(file, "utf8");
  const page = "/" + path.relative(root, file).replace(/\\/g, "/");
  const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const link of links) {
    if (!link.startsWith("/")) continue;
    const clean = link.split("#")[0].split("?")[0];
    if (!clean) continue;
    checked++;
    const abs = path.join(root, decodeURIComponent(clean));
    const ok =
      fs.existsSync(abs) ||
      fs.existsSync(path.join(abs, "index.html")) ||
      (path.extname(abs) === "" && fs.existsSync(abs + ".html"));
    if (!ok) problems.push(`${page}  ->  ${link}`);
  }
}

walk(root);

if (problems.length) {
  const unique = [...new Set(problems)];
  console.log("BROKEN LINKS (" + unique.length + "):");
  unique.forEach((p) => console.log("  " + p));
  if (unique.some((p) => p.includes("livereload"))) {
    console.log(
      "\n  hint: a livereload snippet leaked into the build. Stop `hugo server`\n" +
        "        and delete the resources/ directory before building (see the Makefile)."
    );
  }
  process.exit(1);
}
console.log(`OK: ${checked} internal links checked, none broken.`);
