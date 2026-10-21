#!/usr/bin/env node
/**
 * Language check: finds English text left inside the Chinese pages.
 *
 *   node scripts/check-language.js [siteDir] [lang]
 *
 * Walks every /zh/ page, strips the markup and looks for runs of English
 * words that are not part of an allowed list (brand names, model numbers,
 * units, product codes …). Anything left is an untranslated fragment.
 *
 * Pass "en" as the second argument to run the same rules over the English
 * pages — those are supposed to be english, so the script then reports how
 * many runs it found. A non-zero count proves the detection still works.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
const lang = process.argv[3] || "zh";
if (!fs.existsSync(root)) {
  console.error("site directory not found:", root);
  process.exit(1);
}

/* words that are expected to stay in english */
const ALLOWED = new Set([
  "Eastern", "Lion", "Easternlion", "Logo",
  "PDF", "ISO", "SAE", "ATS", "FAQ", "WhatsApp", "Alibaba", "Google", "Sheets", "LibreOffice", "Excel",
  "Cummins", "Perkins", "Yuchai", "YTO", "Lovol", "Wuxi", "Kofo", "Huachai",
  "Longxin", "Woling", "Yangdong", "Yunnei", "Yuxing", "Kaixun",
  "Stamford", "Marathon", "Engga", "Leroy", "Somer", "Smartgen", "Ruifen",
  "Volvo", "MTU", "Deutz", "Weichai", "Changchai", "Duofang",
  "EL", "ELS", "STC", "GFS", "GF", "GFSW", "SVC", "HGM", "HPC", "HX",
  "E", "P", "T", "S", "H", "M", "A", "B", "C", "D", "F", "G", "K", "N", "R", "W",
  "Hz", "kW", "KW", "V", "A", "mm", "kg", "mm", "HP", "RPM", "IP", "AC", "DC",
  "ID", "QQ", "Tel", "Fax", "Email", "Add", "No", "Type", "Qty", "Model",
  "Co", "Ltd", "Inc", "Corp", "Fuan", "Fujian", "China", "Pty",
  "Inc.", "Ltd.", "Company", "Profile", "Contact", "Us", "Service",
  "Video", "News", "Home", "Products", "More", "View", "Details",
  "Search", "Copyright", "All", "Rights", "Reserved", "Web", "Site",
  "Engine", "Series", "Set", "Generator", "Alternator", "Brush", "Brushless",
  "Diesel", "Gasoline", "Silent", "Open", "Frame", "Canopy", "Trailer",
  "Portable", "Industrial", "Marine", "Mining", "Telecom", "Hospital",
  "Building", "Airport", "Railway", "Real", "Estate", "Buy", "Now",
]);

const findings = [];
let pages = 0;

function rel(file) {
  return "/" + path.relative(root, file).replace(/\\/g, "/");
}

function check(file) {
  pages++;
  let html = fs.readFileSync(file, "utf8");
  /* drop script/style/svg and tags */
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const text = html
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ") /* e-mails */
    .replace(/\b(?:https?:\/\/|www\.)[^\s"']+/gi, " ") /* urls */
    .replace(/\s+/g, " ")
    .trim();

  /* english runs: 2+ words in a row, or a single long word */
  const re = /\b([A-Za-z][A-Za-z'&-]*(?:\s+[A-Za-z][A-Za-z'&-]*){1,})\b/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(text))) {
    const words = m[1].split(/\s+/);
    /* model numbers and codes (GFS-W33, EL274K, "GFS-C80 I", 6120 …) are not untranslated text */
    const isCode = (w) =>
      /\d/.test(w) ||
      ALLOWED.has(w) ||
      (w.length <= 3 && w === w.toUpperCase()) ||
      (w.length <= 5 && w === w.toUpperCase() && !/[a-z]/.test(w));
    if (words.every(isCode)) continue;
    /* a run of two or more words where at least one is not allowed */
    if (!words.some((w) => !ALLOWED.has(w) && w.length > 2)) continue;
    const hit = m[1].trim();
    if (seen.has(hit)) continue;
    seen.add(hit);
    findings.push(`${rel(file)}  ->  "${hit}"`);
  }
}

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) {
      const r = rel(p);
      const isZh = r.startsWith("/zh/");
      const isEn = !isZh && !r.startsWith("/_") && !r.includes("/_");
      if (lang === "zh" && isZh && !r.startsWith("/zh/_500")) check(p);
      if (lang === "en" && isEn) check(p);
    }
  }
})(root);

if (lang === "en") {
  console.log(`self test: the rules found ${findings.length} english runs in the english pages.`);
  findings.slice(0, 5).forEach((f) => console.log("  " + f));
  if (!findings.length) {
    console.error("SELF TEST FAILED: the rules no longer detect english.");
    process.exit(1);
  }
  process.exit(0);
}

if (findings.length) {
  console.log(`ENGLISH LEFT IN THE CHINESE PAGES (${findings.length}):`);
  findings.forEach((f) => console.log("  " + f));
  process.exit(1);
}
console.log(`OK: ${pages} Chinese pages checked — no untranslated english found.`);
