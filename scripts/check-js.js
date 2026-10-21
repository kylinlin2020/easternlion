#!/usr/bin/env node
/**
 * Syntax check for every javascript file of the site.
 *
 *   node scripts/check-js.js [dir]
 *
 * Parses the file with the javascript engine (no execution) and reports the
 * first syntax error per file. A broken script silently disables a feature,
 * so this belongs in CI.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.resolve(process.argv[2] || path.join(__dirname, "..", "static", "js"));
if (!fs.existsSync(dir)) {
  console.error("directory not found:", dir);
  process.exit(1);
}

const problems = [];
let checked = 0;

(function walk(d) {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!entry.name.endsWith(".js")) continue;
    checked++;
    const code = fs.readFileSync(p, "utf8");
    try {
      new vm.Script(code, { filename: p });
    } catch (e) {
      problems.push(`${path.relative(process.cwd(), p)}  ->  ${e.message}`);
    }
  }
})(dir);

if (problems.length) {
  console.log(`JAVASCRIPT SYNTAX ERRORS (${problems.length}):`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log(`OK: ${checked} javascript files parsed, no syntax errors.`);
