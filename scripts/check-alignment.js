#!/usr/bin/env node
/**
 * Alignment audit: every page-level block must use the full container width.
 * Flags inline styles that constrain a block below the container width
 * (1280px) — the usual cause of a page that does not line up with the header.
 *
 *   node scripts/check-alignment.js [siteDir]
 */
const fs = require("fs");
const path = require("path");

const CONTAINER = 1280;
const root = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
if (!fs.existsSync(root)) {
  console.error("site directory not found:", root);
  process.exit(1);
}

const problems = [];
let pages = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) check(p);
  }
}

function check(file) {
  pages++;
  const html = fs.readFileSync(file, "utf8");
  const page = "/" + path.relative(root, file).replace(/\\/g, "/");
  for (const m of html.matchAll(/style="([^"]*max-width[^"]*)"/g)) {
    const mw = m[1].match(/max-width:\s*(\d+)px/);
    if (!mw) continue;
    const w = parseInt(mw[1], 10);
    if (w >= CONTAINER) continue;
    problems.push(`${page}  ->  max-width:${w}px  (${m[1].trim().slice(0, 60)})`);
  }
}

walk(root);

if (problems.length) {
  console.log(`ALIGNMENT PROBLEMS (${problems.length}) — blocks narrower than ${CONTAINER}px:`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log(`OK: ${pages} pages checked, no block is narrower than the ${CONTAINER}px container.`);
