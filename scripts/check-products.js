#!/usr/bin/env node
/**
 * Validates the product front matter (JSON) of every product page:
 *   - the file parses and is not truncated
 *   - title / image / columns / rows exist
 *   - the derived meta (power range, frequency, kind, comparables) is present
 *
 *   node scripts/check-products.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const CATS = ["brush-alternator", "brushless-alternator", "diesel-generator-set", "60hz-diesel-generator-set"];
const BASES = ["content", "content.zh"];

let checked = 0;
const problems = [];

for (const base of BASES) {
  for (const cat of CATS) {
    const dir = path.join(root, base, "products", cat);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
      const full = path.join(dir, file);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      const raw = fs.readFileSync(full, "utf8");
      const end = raw.indexOf("\n}") + 2;
      let fm = null;
      if (end <= 2) {
        problems.push(`${rel}: front matter is missing or truncated`);
        continue;
      }
      try {
        fm = JSON.parse(raw.slice(0, end));
      } catch (e) {
        problems.push(`${rel}: invalid JSON front matter (${e.message.slice(0, 40)})`);
        continue;
      }
      const required = ["title", "image", "columns", "rows", "power_min", "power_max", "hz", "product_kind"];
      const missing = required.filter((k) => fm[k] === undefined);
      if (missing.length) problems.push(`${rel}: missing ${missing.join(", ")}`);
      if (Array.isArray(fm.rows) && !fm.rows.length) problems.push(`${rel}: rows is empty`);
      if (!Array.isArray(fm.comparables)) problems.push(`${rel}: comparables is missing`);
      checked++;
    }
  }
}

if (problems.length) {
  console.log("PRODUCT FRONT MATTER PROBLEMS (" + problems.length + "):");
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log(`OK: ${checked} product pages validated.`);
