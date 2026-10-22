const fs = require("fs");
const path = require("path");

/**
 * SEO + GEO audit for the built site.
 *
 *   node scripts/check-seo.js [siteDir]
 *
 * Classic SEO: one <h1> per page, a title and a meta description of a sane
 * length, a canonical link, hreflang alternates, og tags, alt on every image,
 * no duplicate titles inside a language.
 *
 * GEO (generative engine optimisation): the structured data an answer engine
 * needs (Organization, WebSite + SearchAction, Product, ItemList, FAQPage,
 * VideoObject, NewsArticle, Service, ContactPage, BreadcrumbList), the
 * /llms.txt and /llms-full.txt files, a robots.txt that welcomes the AI
 * crawlers, and no page that nothing links to.
 */
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
const pages = [];
let skipped = 0;

/* ---------------------------------------------------------------- helpers */
function rel(file) {
  return "/" + path.relative(root, file).replace(/\\/g, "/");
}

function attr(tag, name) {
  const m = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  if (!m) return null;
  if (m[2] !== undefined) return m[2];
  if (m[3] !== undefined) return m[3];
  return m[4];
}

/* every json-ld block of a page */
function schemas(html) {
  const out = [];
  const re = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (e) {
      out.push({ __invalid: true, __raw: raw.slice(0, 80) });
    }
  }
  return out;
}

/* the types that appear anywhere in the schema graph */
function typesOf(nodes) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n["@type"]) {
      (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).forEach((t) => out.push(t));
    }
    if (n["@graph"]) walk(n["@graph"]);
    if (n.mainEntity) walk(n.mainEntity);
    if (n.hasPart) walk(n.hasPart);
    if (n.itemListElement) walk(n.itemListElement);
    if (n.acceptedAnswer) walk(n.acceptedAnswer);
  };
  nodes.forEach(walk);
  return out;
}

/* ------------------------------------------------------------------ checks */
function check(file) {
  const html = fs.readFileSync(file, "utf8");
  const page = rel(file);

  const robotsTag = (html.match(/<meta[^>]*name=["']?robots["']?[^>]*>/i) || [])[0] || "";
  if (/noindex/i.test(robotsTag)) {
    skipped++;
    return;
  }

  pages.push({ file, page, html });
  const url = page.replace(/\/index\.html$/, "/");
  const lang = /^\/zh\//.test(url) ? "zh" : "en";
  const lim = LIMITS[lang];
  const add = (msg) => problems.push(`${page}  ->  ${msg}`);

  /* one h1 */
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

  /* description */
  const descTag = (html.match(/<meta[^>]*name=["']?description["']?[^>]*>/i) || [])[0] || "";
  const content = attr(descTag, "content") || "";
  if (!content) add("missing meta description");
  else if (content.length < lim.descMin) add(`meta description too short (${content.length} chars)`);
  else if (content.length > lim.descMax) add(`meta description too long (${content.length} chars)`);

  /* canonical, hreflang, og */
  if (!/<link[^>]*rel=["']?canonical["']?/i.test(html)) add("missing canonical link");
  if (!/hreflang=/i.test(html)) add("missing hreflang alternates");
  if (!/property=["']?og:title["']?/i.test(html)) add("missing og:title");
  if (!/property=["']?og:image["']?/i.test(html)) add("missing og:image");
  else {
    const ogTag = (html.match(/<meta[^>]*property=["']?og:image["']?[^>]*>/i) || [])[0] || "";
    const og = attr(ogTag, "content") || "";
    if (og && !/^https?:\/\//i.test(og)) add("og:image is not an absolute url");
  }

  /* alt on every image */
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  imgs.forEach((tag) => {
    if (!/\balt\s*=/i.test(tag)) add("image without alt attribute: " + tag.slice(0, 70));
  });

  /* the structured data */
  const nodes = schemas(html);
  if (nodes.some((n) => n.__invalid)) add("a json-ld block is not valid json");
  const types = typesOf(nodes);
  const has = (t) => types.includes(t);

  if (!has("Organization")) add("the json-ld has no Organization");
  if (!has("WebSite")) add("the json-ld has no WebSite");
  /* the page type decides what else has to be there */
  const isProduct = /\/products\/[^/]+\/[^/]+\/$/.test(page) && !/zh\//.test(page) + "";
  if (/\/products\/[^/]+\/[^/]+\/?$/.test(page) && page.split("/").filter(Boolean).length >= 3) {
    if (!has("Product") && !has("ItemList")) {
      /* a category page lists products, a product page is a product */
      if (html.indexOf("spec-table") > -1) add("a product page without a Product schema");
    }
  }
  /* a product page answers the question in one quotable sentence */
  if (/\/products\/[^/]+\/[^/]+\/?$/.test(url)) {
    if (!/class=["']?series-summary/.test(html)) add("the product page has no one sentence summary");
    if (!/class=["']?series-guide/.test(html)) add("the product page has no decision guide");
    if (!/id=["']?how-to-choose/.test(html)) add("the product page has no decision guide anchor");
    if (!/is an? [A-Za-z0-9 ]*\d+ Hz|\u662f\u4e1c\u65b9|\u7cfb\u5217/.test(html)) add("the product page has no answer sentence");
  }
  if (/\/faq\/?$/.test(url) && !has("FAQPage")) add("the faq page has no FAQPage schema");
  if (/\/news\/[^/]+\/[^/]+\/?$/.test(url) && !has("NewsArticle")) add("a news article without a NewsArticle schema");
  if (/\/video\/?$/.test(url) && !has("VideoObject")) add("the video page has no VideoObject schema");
  if (/\/service\/?$/.test(url) && !has("Service")) add("the service page has no Service schema");
  if (/\/contact\/?$/.test(url) && !has("ContactPage")) add("the contact page has no ContactPage schema");
  if (url === "/" || url === "/zh/") {
    if (!has("WebPage")) add("the home page has no WebPage schema");
    if (!/SearchAction/.test(html)) add("the WebSite schema has no SearchAction");
  } else {
    if (!has("BreadcrumbList")) add("the json-ld has no BreadcrumbList");
  }
}

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) check(p);
  }
})(root);

/* ------------------------------------------------- the files an engine wants */
function fileExists(name, minSize) {
  const p = path.join(root, name.replace(/^\//, ""));
  if (!fs.existsSync(p)) {
    problems.push(`/${name} is missing — an answer engine cannot read it`);
    return;
  }
  const size = fs.statSync(p).size;
  if (size < minSize) problems.push(`/${name} is too short (${size} bytes)`);
}

fileExists("llms.txt", 800);
fileExists("llms-full.txt", 5000);

const robotsPath = path.join(root, "robots.txt");
if (!fs.existsSync(robotsPath)) {
  problems.push("robots.txt is missing");
} else {
  const robots = fs.readFileSync(robotsPath, "utf8");
  for (const bot of ["GPTBot", "PerplexityBot", "ClaudeBot", "Google-Extended"]) {
    if (robots.indexOf(bot) === -1) problems.push(`robots.txt does not mention ${bot}`);
  }
  if (!/Sitemap:\s*https?:/i.test(robots)) problems.push("robots.txt has no absolute sitemap link");
}

/* ---------------------------------------------------------- orphan pages */
const linked = new Set();
for (const { html } of pages) {
  const re = /(?:href|src)=["']?([^"' >]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (!u.startsWith("/")) continue;
    linked.add(u.split("#")[0].split("?")[0]);
  }
}
for (const { page } of pages) {
  const p = page.replace(/\/index\.html$/, "/");
  if (p === "/" || p === "/zh/") continue;
  if (/\/404\.html$/.test(p) || /\/zh\/404\.html$/.test(p)) continue; /* served by the host, never linked */
  if (!linked.has(p) && !linked.has(page)) {
    problems.push(`${page}  ->  nothing links to this page (an orphan)`);
  }
}

/* ------------------------------------------------------------------ report */
if (problems.length) {
  console.log(`SEO/GEO PROBLEMS (${problems.length}) across ${pages.length} pages (${skipped} noindex pages skipped):`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log(
  `OK: ${pages.length} pages checked — titles, descriptions, headings, canonical, hreflang, og, alt, ` +
    `the structured data, llms.txt, robots.txt and the internal link graph are all in order ` +
    `(${skipped} noindex pages skipped).`
);
