#!/usr/bin/env node
/**
 * SEO + accessibility audit for the built site.
 *
 *   node scripts/check-seo.js [siteDir]
 *
 * Checks every indexable page for:
 *   - exactly one <h1>
 *   - a <title> and a meta description of a sane length
 *   - a canonical link, hreflang alternates and og tags
 *   - images with an alt attribute
 *   - duplicate titles inside the same language
 *
 * Length limits are language aware: a Chinese title carries far more meaning
 * per character than an English one, so the Chinese pages get their own
 * (shorter) limits. Pages marked noindex (aliases, error pages) are skipped.
 *
 * The parser copes with minified markup (attributes without quotes).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
if (!fs.existsSync(root)) {
  console.error("site directory not found:", root);
  process.exit(1);
}

const LIMITS = {
  en: { titleMin: 15, titleMax: 75, descMin: 50, descMax: 185 },
  zh: { titleMin: 8, titleMax: 40, descMin: 20, descMax: 120 },
};

const problems = [];
const titles = new Map();
let pages = 0;
let skipped = 0;

function rel(file) {
  return "/" + path.relative(root, file).replace(/\\/g, "/");
}

/* read an attribute value, quoted or not */
function attr(tag, name) {
  const m = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  if (!m) return null;
  if (m[2] !== undefined) return m[2];
  if (m[3] !== undefined) return m[3];
  return m[4];
}

function check(file) {
  const html = fs.readFileSync(file, "utf8");
  const page = rel(file);

  /* aliases, 404 and 500 pages are not indexed — nothing to check */
  const robotsTag = (html.match(/<meta[^>]*name=["']?robots["']?[^>]*>/i) || [])[0] || "";
  if (/noindex/i.test(robotsTag)) {
    skipped++;
    return;
  }

  pages++;
  const lang = /^\/zh\//.test(page) ? "zh" : "en";
  const lim = LIMITS[lang];
  const add = (msg) => problems.push(`${page}  ->  ${msg}`);

  /* one h1 per page */
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) add(`expected 1 <h1>, found ${h1s}`);

  /* title */
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  if (!title) add("missing <title>");
  else {
    const len = title.trim().length;
    if (len < lim.titleMin) add(`title too short (${len} chars)`);
    if (len > lim.titleMax) add(`title too long (${len} chars)`);
    const key = lang + "::" + title.trim().toLowerCase();
    if (titles.has(key)) add(`duplicate title (also on ${titles.get(key)})`);
    else titles.set(key, page);
  }

  /* meta description */
  const descTag = (html.match(/<meta[^>]*name=["']?description["']?[^>]*>/i) || [])[0] || "";
  const content = attr(descTag, "content") || "";
  if (!content) add("missing meta description");
  else if (content.length < lim.descMin) add(`meta description too short (${content.length} chars)`);
  else if (content.length > lim.descMax) add(`meta description too long (${content.length} chars)`);

  /* canonical + hreflang + og */
  if (!/<link[^>]*rel=["']?canonical["']?/i.test(html)) add("missing canonical link");
  if (!/hreflang=/i.test(html)) add("missing hreflang alternates");
  if (!/property=["']?og:title["']?/i.test(html)) add("missing og:title");
  if (!/property=["']?og:image["']?/i.test(html)) add("missing og:image");

  /* images need an alt attribute */
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  imgs.forEach((tag) => {
    if (!/\balt\s*=/i.test(tag)) add("image without alt attribute: " + tag.slice(0, 70));
  });

  /* no javascript: links */
  if (/href=["']?javascript:/i.test(html)) add("javascript: link found");
}

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) check(p);
  }
})(root);

if (problems.length) {
  console.log(`SEO/ACCESSIBILITY PROBLEMS (${problems.length}) across ${pages} pages (${skipped} noindex pages skipped):`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log(`OK: ${pages} pages checked — titles, descriptions, h1, canonical, hreflang, og and alt all good (${skipped} noindex pages skipped).`);
