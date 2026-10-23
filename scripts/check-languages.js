#!/usr/bin/env node
/**
 * Language parity check — every published language must carry the same
 * pages, the same structure and the same strings-of-record as English.
 *
 *   node scripts/check-languages.js [projectDir]
 *
 * For each language declared in hugo.toml it checks:
 *   1. content.<lang>/ mirrors content/ file for file
 *   2. structural front matter (paths, weights, columns, rows, dates …)
 *      is identical to the English source — only the whitelisted human
 *      strings may differ
 *   3. i18n/<lang>.toml carries every key of i18n/en.toml, none empty
 *   4. data/*.yaml carries a <lang> variant of every dual field
 *      (faq q_/a_, categories description_, features blocks, series facts)
 *   5. layouts/partials/flag.html draws a flag for the language
 *
 * Exits non-zero when anything is missing or drifted.
 */
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const langFilter = (argv.find((a) => a.startsWith("--lang=")) || "").slice(7) || null;
const onlyFilter = (argv.find((a) => a.startsWith("--only=")) || "").slice(7) || null;
const filesFilter = argv
  .filter((a) => a.startsWith("--files="))
  .flatMap((a) => a.slice(8).split(","))
  .map((s) => s.trim().split(path.sep).join("/"))
  .filter(Boolean);
const dirArg = argv.find((a) => !a.startsWith("--"));
const root = path.resolve(dirArg || path.join(__dirname, ".."));

/* human strings that are allowed (and expected) to differ per language */
const TRANSLATABLE = new Set([
  "title", "description", "summary", "banner_title", "banner_sub", "banner_text",
  "category", "seo_title", "product_title", "app_name", "author",
  "hero_eyebrow", "hero_title", "hero_text",
  "name", "label", "alt", "t", "q", "a", "question", "answer",
]);

/* front matter keys that must stay identical in the yaml files */
const YAML_STRUCT = [
  "type", "layout", "weight", "date", "image", "banner_image", "banner_logo",
  "banner_compact", "banner_hide_title", "factor", "list_from", "loads", "outputs",
];

const problems = [];
const note = (s) => problems.push(s);

/* ------------------------------------------------------------------ config */
const toml = fs.readFileSync(path.join(root, "hugo.toml"), "utf8");
const langs = [];
{
  let cur = null;
  for (const line of toml.split(/\r?\n/)) {
    const mLang = line.match(/^\s*\[languages\.([A-Za-z-]+)\]/);
    if (mLang) { cur = { lang: mLang[1], dir: null }; langs.push(cur); continue; }
    if (cur) {
      const mDir = line.match(/^\s*contentDir\s*=\s*"([^"]+)"/);
      if (mDir) cur.dir = mDir[1];
    }
  }
}
const en = langs.find((l) => l.lang === "en") || { lang: "en", dir: "content" };
const others = langs.filter((l) => l.dir && l.dir !== en.dir);

/* ------------------------------------------------------------- file mirror */
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

const enFiles = fs.existsSync(path.join(root, en.dir))
  ? walk(path.join(root, en.dir)).filter((f) => f.endsWith(".md")).sort()
  : (note(`content dir ${en.dir}/ is missing`), []);

/* --------------------------------------------------- front matter handling */
function splitFront(src) {
  if (src[0] === "{") {
    let depth = 0, inStr = false, esc = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return { kind: "json", data: JSON.parse(src.slice(0, i + 1)), body: src.slice(i + 1) }; }
          catch (e) { return { kind: "error", error: e.message }; }
        }
      }
    }
    return { kind: "error", error: "unterminated json front matter" };
  }
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { kind: "none", body: src };
  return { kind: "yaml", text: m[1] };
}

/* json compare: identical except the whitelisted human strings */
function compareJson(a, b, p, file, lang) {
  if (p && TRANSLATABLE.has(p.split(".").pop())) return;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return note(`${lang}: ${file} ${p} shape differs`);
    if (a.length !== b.length) return note(`${lang}: ${file} ${p} has ${b.length} entries, english has ${a.length}`);
    a.forEach((v, i) => compareJson(v, b[i], `${p}[${i}]`, file, lang));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) return note(`${lang}: ${file} ${p}.${k} missing`);
      if (!(k in b)) return note(`${lang}: ${file} ${p}.${k} missing`);
      compareJson(a[k], b[k], `${p}.${k}`, file, lang);
    }
    return;
  }
  if (a !== b) note(`${lang}: ${file} ${p} drifted: ${JSON.stringify(b)} != english ${JSON.stringify(a)}`);
}

/* yaml compare: structural blocks identical, urls inside breadcrumb too */
function yamlBlocks(text) {
  const blocks = new Map();
  let key = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_]+):/);
    if (m) { key = m[1]; blocks.set(key, [line]); }
    else if (key && /^\s/.test(line)) blocks.get(key).push(line);
  }
  return blocks;
}

function compareYaml(enText, trText, file, lang) {
  const A = yamlBlocks(enText), B = yamlBlocks(trText);
  for (const k of YAML_STRUCT) {
    if (!A.has(k)) continue;
    const a = A.get(k).join("\n").replace(/\r/g, "");
    const b = B.has(k) ? B.get(k).join("\n").replace(/\r/g, "") : null;
    if (b === null) note(`${lang}: ${file} front matter lost "${k}"`);
    else if (a !== b) note(`${lang}: ${file} front matter "${k}" drifted: ${b.split("\n")[0]} != ${a.split("\n")[0]}`);
  }
  if (A.has("breadcrumb")) {
    const urls = (blk) => (blk || []).filter((l) => /url:/.test(l)).map((l) => l.trim()).join("|");
    const a = urls(A.get("breadcrumb")), b = urls(B.get("breadcrumb"));
    if (a !== b) note(`${lang}: ${file} breadcrumb urls drifted: ${b} != ${a}`);
  }
  if (A.has("faq")) {
    const count = (blk) => (blk || []).filter((l) => /-\s*q:/.test(l)).length;
    const a = count(A.get("faq")), b = count(B.get("faq"));
    if (a !== b) note(`${lang}: ${file} faq has ${b} questions, english has ${a}`);
  }
}

/* --------------------------------------------------------- content parity */
if (!onlyFilter || onlyFilter === "content") {
for (const { lang, dir } of others) {
  if (langFilter && lang !== langFilter) continue;
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) { note(`${lang}: content dir ${dir}/ is missing`); continue; }
  const files = walk(base).filter((f) => f.endsWith(".md")).sort();
  if (!filesFilter.length) {
    const missing = enFiles.filter((f) => !files.includes(f));
    const extra = files.filter((f) => !enFiles.includes(f));
    if (missing.length) note(`${lang}: ${missing.length} page(s) missing, e.g. ${missing.slice(0, 3).join(", ")}`);
    if (extra.length) note(`${lang}: ${extra.length} unexpected page(s), e.g. ${extra.slice(0, 3).join(", ")}`);
  }

  for (const f of enFiles) {
    if (filesFilter.length && !filesFilter.includes(f)) continue;
    if (!files.includes(f)) {
      if (filesFilter.length) note(`${lang}: ${f} missing`);
      continue;
    }
    const enSrc = fs.readFileSync(path.join(root, en.dir, f), "utf8");
    const trSrc = fs.readFileSync(path.join(base, f), "utf8");
    const A = splitFront(enSrc), B = splitFront(trSrc);
    if (A.kind === "error") note(`english ${f}: ${A.error}`);
    if (B.kind === "error") { note(`${lang}: ${f}: ${B.error}`); continue; }
    if (A.kind === "json") {
      if (B.kind !== "json") { note(`${lang}: ${f} is not json front matter any more`); continue; }
      compareJson(A.data, B.data, "", f, lang);
    } else if (A.kind === "yaml") {
      if (B.kind !== "yaml") { note(`${lang}: ${f} is not yaml front matter any more`); continue; }
      compareYaml(A.text, B.text, f, lang);
    }

    /* tripwire: the loudest strings must not still read english */
    const trip = ["title", "description", "banner_title", "summary", "banner_sub", "banner_text"];
    if (A.kind === "json" && B.kind === "json") {
      for (const k of trip) {
        if (typeof A.data[k] === "string" && A.data[k] && A.data[k] === B.data[k]) {
          note(`${lang}: ${f} — "${k}" is still english`);
        }
      }
    } else if (A.kind === "yaml" && B.kind === "yaml") {
      const val = (text, k) => {
        const m = text.match(new RegExp(`^${k}:\\s*"([^"]*)"`, "m")) || text.match(new RegExp(`^${k}:\\s*([^\\n]+)`, "m"));
        return m ? m[1].trim() : null;
      };
      for (const k of trip) {
        const a = val(A.text, k), b = val(B.text, k);
        if (a && b && a === b) note(`${lang}: ${f} — "${k}" is still english`);
      }
    }
  }
}
}

/* ------------------------------------------------------------- i18n keys */
function tomlInfo(file) {
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf8");
  const marks = [...txt.matchAll(/^\[([A-Za-z0-9_-]+)\]/gm)];
  const keys = marks.map((m) => m[1]);
  const empty = [...txt.matchAll(/^\[([A-Za-z0-9_-]+)\]\s*\nother = (''|""|'''|""")\s*$/gm)].map((m) => m[1]);
  const dupes = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
  /* printf verbs per key — translations must keep them exactly */
  const tokens = new Map();
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : txt.length;
    const block = txt.slice(m.index, end);
    const t = (block.match(/%\[?\d*\]?[svd]/g) || []).sort().join(" ");
    if (t) tokens.set(m[1], t);
  });
  return { keys: new Set(keys), order: keys, empty, dupes, tokens };
}
const enInfo = tomlInfo(path.join(root, "i18n", `${en.lang}.toml`));
if (!enInfo) note("i18n/en.toml is missing");
if (enInfo && enInfo.empty.length) note(`i18n/en.toml has empty values: ${enInfo.empty.join(", ")}`);
if (enInfo && enInfo.dupes.length) note(`i18n/en.toml has duplicate keys: ${enInfo.dupes.join(", ")}`);

if (!onlyFilter || onlyFilter === "i18n") {
for (const { lang } of others) {
  if (langFilter && lang !== langFilter) continue;
  const info = tomlInfo(path.join(root, "i18n", `${lang}.toml`));
  if (!info) { note(`i18n/${lang}.toml is missing`); continue; }
  const missing = enInfo.order.filter((k) => !info.keys.has(k));
  const extra = [...info.keys].filter((k) => !enInfo.keys.has(k));
  if (missing.length) note(`i18n/${lang}.toml missing ${missing.length} key(s): ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? " …" : ""}`);
  if (extra.length) note(`i18n/${lang}.toml has ${extra.length} unknown key(s): ${extra.slice(0, 6).join(", ")}`);
  if (info.empty.length) note(`i18n/${lang}.toml has empty values: ${info.empty.slice(0, 6).join(", ")}${info.empty.length > 6 ? " …" : ""}`);
  if (info.dupes.length) note(`i18n/${lang}.toml has duplicate keys: ${info.dupes.slice(0, 6).join(", ")}${info.dupes.length > 6 ? " …" : ""}`);
  for (const [k, t] of enInfo.tokens) {
    const got = info.tokens.get(k);
    if (got !== t) {
      note(`i18n/${lang}.toml key "${k}" printf placeholders changed: [${got || "none"}] — english has [${t}]`);
    }
  }
}
}

/* ----------------------------------------------------------- data strings */
const dataDir = path.join(root, "data");
if ((!onlyFilter || onlyFilter === "data") && fs.existsSync(dataDir)) {
  const langCodes = others.map((l) => l.lang);
  const read = (n) => (fs.existsSync(path.join(dataDir, n)) ? fs.readFileSync(path.join(dataDir, n), "utf8") : "");

  const faq = read("faq.yaml");
  if (faq) {
    const items = (faq.match(/^\s*-\s+id:/gm) || []).length;
    for (const l of langCodes) {
      for (const f of ["q", "a"]) {
        const n = (faq.match(new RegExp(`^\\s*${f}_${l}:\\s*\\S`, "gm")) || []).length;
        if (n !== items) note(`data/faq.yaml: ${l} has ${n} ${f}_${l} entries, expected ${items}`);
      }
    }
  }

  const cats = read("categories.yaml");
  if (cats) {
    const items = (cats.match(/^\s*description:/gm) || []).length;
    for (const l of langCodes) {
      const n = (cats.match(new RegExp(`^\\s*description_${l}:\\s*\\S`, "gm")) || []).length;
      if (n !== items) note(`data/categories.yaml: ${l} has ${n} description_${l} entries, expected ${items}`);
    }
  }

  const feats = read("features.yaml");
  if (feats) {
    const lines = feats.split(/\r?\n/);
    const blockCount = (code) => {
      let start = -1;
      for (let i = 0; i < lines.length; i++) if (lines[i] === `${code}:`) { start = i; break; }
      if (start < 0) return -1;
      let n = 0;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^[a-z]+:\s*$/.test(lines[i])) break;
        if (/^\s*-\s+icon:/.test(lines[i])) n++;
      }
      return n;
    };
    const nEn = blockCount("en");
    for (const l of langCodes) {
      const n = blockCount(l);
      if (n < 0) note(`data/features.yaml: missing "${l}:" block`);
      else if (n !== nEn) note(`data/features.yaml: ${l} has ${n} items, en has ${nEn}`);
    }
  }

  const facts = read("series_facts.yaml");
  if (facts) {
    const groups = new Map();
    let g = null;
    for (const line of facts.split(/\r?\n/)) {
      const mG = line.match(/^([a-z]+):\s*$/);
      if (mG) { g = mG[1]; groups.set(g, new Set()); continue; }
      const mF = line.match(/^\s+([a-z]+):\s*\S/);
      if (mF && g) groups.get(g).add(mF[1]);
    }
    for (const [group, have] of groups) {
      for (const l of langCodes) {
        if (!have.has(l)) note(`data/series_facts.yaml: "${group}" has no ${l} line`);
      }
    }
  }
}

/* ------------------------------------------------------------------- flag */
const flagSrc = fs.existsSync(path.join(root, "layouts", "partials", "flag.html"))
  ? fs.readFileSync(path.join(root, "layouts", "partials", "flag.html"), "utf8") : "";
for (const { lang } of others) {
  if (!flagSrc.includes(`eq $lang "${lang}"`)) note(`layouts/partials/flag.html has no flag for "${lang}"`);
}

/* ----------------------------------------------------------------- report */
const shown = langFilter
  ? problems.filter((p) => new RegExp(`(^|[^a-z])${langFilter}([^a-z]|$)`, "i").test(p))
  : problems;
if (langFilter) console.log(`language parity: ${problems.length} problem(s) total, ${shown.length} for "${langFilter}"`);
if (shown.length) {
  console.error(`language parity: ${shown.length} problem(s)${langFilter ? ` for ${langFilter}` : ""}`);
  for (const p of shown) console.error("  x " + p);
  process.exit(1);
}
if (langFilter) { console.log(`language parity ok for ${langFilter} — nothing under its name is broken`); process.exit(0); }
if (onlyFilter) { console.log(`language parity ok — the ${onlyFilter} section is clean`); process.exit(0); }
console.log(`language parity ok — ${langs.length} languages, ${enFiles.length} pages each, ${enInfo.order.length} i18n keys`);
