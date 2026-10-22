# Eastern Lion — static site

A 1:1 static rebuild of **www.easternlion.cn** (Fuan Eastern Lion Electric Machines Co., Ltd) as a
Hugo site, deployed to Cloudflare Pages through GitHub Actions / Pages builds.

Live preview: <https://easternlion.pages.dev/>

---

## Stack

| Piece | Choice |
| --- | --- |
| Generator | [Hugo](https://gohugo.io) `0.134.0` (extended not required) |
| Styles | Hand-written CSS (`assets/css/main.css`), no framework |
| Assets | All images downloaded into `static/images/` — no dependency on the old `ldycdn.com` CDN |
| Hosting | Cloudflare Pages (build: `hugo --gc --minify` → `public`) |
| Source | GitHub — `kylinlin2020/easternlion`, production branch `main` |
| Language | English only (structure is i18n-ready, see below) |

## 本地预览（当前工作方式）

> 目前阶段 **只做本地预览**，不同步 GitHub / Cloudflare。远端仓库与 Pages 项目保持现状，
> 不再推送；下面的命令只在本机使用。

```bash
# 1) 开发预览（推荐）：改 content/ 或 layouts/ 后自动重建，浏览器自动刷新
hugo server --port 1313 --bind 127.0.0.1 --navigateToChanged
#    → http://127.0.0.1:1313/

# 2) 生产构建（与线上等价，用于本地核对）
hugo --gc --minify --destination public
#    → public/ ，用任意静态服务器打开，例如：
node -e "require('http').createServer((q,s)=>{const p=require('path'),f=require('fs');const u=require('url').parse(q.url).pathname;let x=p.join('public',u);if(u.endsWith('/'))x+='index.html';f.readFile(x,(e,d)=>{s.writeHead(e?404:200,{'content-type':e?'text/html':'text/html; charset=utf-8'});s.end(e?'404':d)})}).listen(8900)"
#    → http://127.0.0.1:8900/

# 3) 与原站镜像对照（采集时的本地副本）
#    → http://127.0.0.1:8899/site/index.html
```

需要同步时再执行：

```bash
git push origin main          # GitHub
wrangler pages deploy public --project-name easternlion --branch main
```

## Local development

```bash
hugo server -D          # http://localhost:1313
hugo --gc --minify      # static build into public/
```

## Repository layout

```
hugo.toml                 site config, company/contact parameters, language block
content/
  _index.md               home (hero slides + product centre)
  products/               product catalogue
    _index.md             category overview
    brush-alternator/     STC series brush alternator
    brushless-alternator/ EL series brushless alternator
    diesel-generator-set/ 50 Hz generator sets (15 engine series)
    50hz-diesel-generator-set/
    60hz-diesel-generator-set/
  about/                  Company Profile, History, Team, Qualification, Workshop
  news/                   News Center
  service.md  video.md  faq.md  contact.md
content.zh/               the same tree, translated (served under /zh/)
data/
  categories.yaml         the three product families used on the home / products pages
  sidebar.yaml            the 19 entries shown in the sidebar (with i18n keys)
i18n/
  en.toml                 UI strings (English)
  zh.toml                 UI strings (简体中文, ready for the zh site)
layouts/
  _default/               baseof, single, list
  products/               list (overview), category (grid), single (detail + spec table)
  about/ news/ service/ video/ faq/ contact/
  partials/               header, footer, banner, breadcrumb, sidebar, float rail …
assets/css/main.css       all styling
static/images/            logo, hero slides, banners, product photos, workshop, certificates
```

## Product pages

Product pages use JSON front matter so the specification tables stay machine-readable:

```json
{
  "title": "Engine By Longxin Series",
  "image": "/images/products/engine-by-longxin-series.jpg",
  "columns": ["Model", "Prime power (kW)", "…"],
  "rows": [["GFS-W33", "24", "30", "…"], ["…", "…", "…", "…"]],
  "breadcrumb": [{ "name": "Products", "url": "/products/" }]
}
```

`layouts/products/single.html` renders `columns` as the table header and `rows` as the body.
A row of eleven cells is rendered with the two-level *Genset Specification / Engine /
Brushless Alternator / Controller / Datasheet* header used on the original site.

## Design system

The site was rebuilt as a modern B2B industrial layout (Generac / Cummins Power Systems /
Atlas Copco patterns) while keeping all of the original content, data and page structure.

| Token | Value | Use |
| --- | --- | --- |
| `--navy-900 … --navy-600` | `#0a1622 → #1e425e` | header, banner, footer, dark surfaces |
| `--amber` / `--amber-600` | `#f59e0b` / `#d97706` | the single accent (CTAs, markers, hover states) |
| `--blue` | `#2563eb` | links inside body copy |
| `--surface / -2 / -3` | `#fff` / `#f8fafc` / `#f1f5f9` | content backgrounds |
| `--line` | `#e2e8f0` | 1px borders |
| radii | 6 / 10 / 14 / 20 / 28 / pill | cards, buttons, images |
| elevation | 4 soft shadows | hover lift on cards |
| container | **1280px** (24px gutters) | all grids |

Layout rules:

* **Top utility bar** (address, hours, e-mail, phone) → **sticky white header** (logo, search,
  language switcher, *Get a Quote* CTA) → **white nav** with an amber underline on the active item
  and a hover dropdown;
* **Hero** – dark navy stage, gradient + amber radial glow, eyebrow, 2-line headline, sub-copy,
  two CTAs and a 4-cell stat strip; sliders use 30px amber progress dashes;
* **Cards** – white, 1px border, 20px radius, lift on hover; product cards use a light image
  plate with the title underneath;
* **Tables** – rounded card shell, sticky navy header, zebra rows, amber hover row;
* **Sidebar** – sticky white card, navy title bar, list rows with a chevron, active row in amber;
* **Footer** – a CTA band (navy gradient + amber top rule) above a 4-column navy footer and a
  slim bottom bar;
* **Float rail** – three icon tabs on the right edge that expand on hover.

Responsive: 980px collapses the nav into a drawer, 640px hides the search and the quote button,
moves the language switcher into the drawer and stacks the grids.

## Interactive features (all client-side, no backend)

| Feature | Where | How |
| --- | --- | --- |
| **Site search** | header | `layouts/index.json` emits `search-index.json` (title, url, description, category, kW range, frequency and **every model with its power ratings**) per language; `assets/js/search.js` fetches it and shows a ranked dropdown (title > category > section > description > model) plus **category shortcuts**. Model queries are normalised, so `gfs-w33`, `gfs w33` and `GFSW33` all hit. The dropdown is keyboard navigable (↑ ↓ Enter Esc). |
| **Product filters** | category pages | type / power band / frequency chips; each card carries `data-kind`, `data-hz`, `data-min`, `data-max`. The power band matches when a series *covers* it. State is written to the query string. |
| **Power coverage list** | category pages | collapsible table of every series with its frequency and kW range, so buyers can see which engine covers which band before opening a spec sheet. |
| **Model quick-jump** | product pages | a *Jump to model* select over all models in the spec table; picking one scrolls to the row and highlights it. |
| **WhatsApp inquiry** | product pages | the *Chat on WhatsApp* button carries the whole request: the series, the model the visitor is looking at (it follows the url hash, the *jump to model* menu and the neighbouring sizes), the power it covers, the frequency and the page link. `assets/js/inquiry-links.js` rebuilds the message whenever the model changes, and the *Inquire* button hands the same context into the contact form, so the matrix arrives with the model, its load and its frequency filled in. |
| **Inquiry form** | contact page | `assets/js/contact.js` validates name / e-mail / message and shows inline errors, then posts the inquiry to the pages function, which sends it to `sales@easternlion.cn` with the visitor as the reply-to. The body is assembled from the form: salutation, the models, the load of every model, the drawing reference, the message and the contact block, all labelled in the visitor's language. If the function is not reachable the visitor gets the same body to send through WhatsApp, to copy, or to download as a text file. |
| **Candidate models** | contact page | a small matrix with one row per model and **its own load and frequency** (`GF/GFS-C200 | 500 kW | 60 Hz`), so *quote me 500 kW at 60 Hz and 1000 kW at 50 Hz* reaches the engineers exactly as it was meant. The rows come from the power finder, the comparison tray or the url (`?models=A:500:60,B:1000:50`) and can be edited, added and removed. |
| **Lightbox** | certificates, family photos | `static/js/lightbox.js` opens any `a[data-lb]` in a full-screen overlay (Esc / backdrop / ✕ to close). |
| **Sticky action bar** | product pages (mobile) | product name + call button + *Inquire* pinned to the bottom of the viewport. |
| **Power-band comparison** | product pages | `comparables` in the front matter lists the series whose power range overlaps the current one. |
| **Power finder** | home, products overview, category pages | a slim one-row band (not a big block — it must not compete with the product grid): type the load in kW (or pick 50/100/200/500/1000 kW) and a 50/60 Hz toggle, and every series that covers the load is listed with the closest model, its kW rating, the other matching models and a *Get a quote* button. On the category pages it is folded away behind *find the model that covers my load* so the product grid stays the focus. `layouts/partials/finder-data.html` derives the model/kW pairs from the specification tables at build time, `static/js/finder.js` does the matching. When nothing covers the load it points at the nearest unit. |
| **Spec search** | header | typing `200kw` or `200kw 60hz` into the search box lists every model that covers that load at that frequency, with its kW rating and a deep link to the row in the spec table. The same model/power data powers the power finder, the comparison tool and the search index. |
| **Model comparison** | category & product pages | the **+** button on every card adds a model to the comparison (max 4). It lives in a small badge in the bottom right corner — not a bar across the content — and opens a side-by-side table of power range, frequency, model count, engine, alternator and controller. `layouts/partials/compare-data.html` emits the data as JSON, `static/js/compare.js` renders the tray and the dialog, every string is localised. |
| **Sortable spec tables** | product pages | the header of a specification table sorts the rows by that column (numbers and model numbers numerically, text alphabetically). |
| **Container alignment audit** | whole site | `scripts/check-alignment.js` fails the build when a page-level block is narrower than the 1280px container. |
| **Clickable hero stats** | home page | each figure links to the matching page (history, service, alternators, generator sets). |

Product meta used by these features is derived from the specification tables at build time
(`power_min`, `power_max`, `hz`, `product_kind`, `comparables`).

### Hero and banners

* **Home hero** — one clean photograph of the Eastern Lion workshop (`images/banner/service.jpg`,
  1920×700, sharp at every viewport) on a dark navy stage with a gradient and an amber radial
  glow, a slow Ken Burns zoom, the eyebrow *Golden Supplier in China*, a two-line headline,
  sub-copy, two CTAs and a four-cell stat strip. No slider: the original shipped a LayerSlider
  whose slides carried the slogan as part of the bitmap, which reads badly on a phone. The
  slogan-free strip `images/hero/0-gensets.jpg` (1600×374) is used where a wide, short band is
  needed — the service banner for example.
* **Inner banners** — full-width photo, dark overlay, centred uppercase title, 280px minimum
  height. Pages that carry their own `<h1>` (product detail, news article) step the banner
  title down to a plain label, so every page keeps exactly one `<h1>`.

### Tiles

* **Home / Products overview** — a white card with the product photo, an amber label pill
  overlapping the lower left of the image, the category title, a one-line description and a
  *View details* link.
* **Category pages** — a three-column grid of white product cards (image plate, title,
  frequency and kW tags, category and *View details*) with a compare toggle in the corner.

### Footer

A navy CTA band (*Need a generator set for your project?* + *Send an inquiry* + *Products*)
above a four-column navy footer — company block (logo, tagline, 23px phone, fax, green mailto,
QR code, website), *Quick Links*, *Company Profile*, *Product Category* — and a slim bottom bar
with the factory address on the left and `Copyright © 2019 …` on the right.

### Float rail

A fixed panel on the right edge with three icon tabs: *Telephone*, *Email* and
*Leave a Message*.

### Company pages (Company Profile)

`content/about/*` and `content/news/*` all use the same shell as the original:

* banner with the **white** logo, the tagline *Golden Supplier in China* and the company
  description, dimmed by a 45% black overlay,
* breadcrumb → *About Us* heading → separator → the six yellow buttons
  (Company Profile · Development History · Our Team · Qualification · News Center · Our Workshop),
* then the page content.

The **Development History** page reproduces the original `addImgdevelopment` component: a
`#fcc92f` centre line, 42px white nodes with a 12px yellow dot, a 30px dashed connector and the
year alternating left/right in 18px `#4c4c4c`.

The **Qualification** page keeps the three original sections — *Certificate*, *Exhibition*
(horizontal slider) and *Our Partners*.

### Service / Video / FAQ / Contact

* **Service** — title, narrow centred column with the market text, then the three white
  *Applications 1/2/3* cards with the orange underline.
* **Video** — the three original YouTube embeds in a 3-column grid.
* **FAQ** — left-aligned *FAQ* heading and the five bordered Q&A boxes.
* **Contact Us** — *International Department* | *Manufacturer* on top, the office photo and the
  *Get In Touch* inquiry form below (the form opens the visitor's mail client and pre-fills the
  product when arriving from a product page).

### Product detail

Measured from the original (`a.jqzoom` = 400×400, thumbnail 64×64, qty 25/41/25×27,
buttons 109×40 and 190×40):

* 400×400 white image box + a 64×64 thumbnail underneath,
* 27px gutter, then the info column (Share to · title + QR icon · Category · Availability ·
  Quantity · Inquire / Add to Basket),
* spec table with the two-level header and white cells.

Breadcrumb chains reproduce the original's repetition, e.g. for a 50 Hz set:
`Home » Products » Diesel Generator Set » Diesel Generator Set » 50HZ Diesel Generator Set »
Engine By Longxin Series » Engine By Longxin Series`.

## Inherited quirks (reproduced on purpose)

The original site has three contrast bugs — the home page *Product Center* heading was `#333`
on black, the home page intro paragraph was `#545454` on black, and the footer column titles
plus the *Development History* descriptions were `#000` on black. The redesign renders all of
them readable; the original can still be compared side by side against the local mirror of the
crawled site (`http://127.0.0.1:8899/site/index.html`).

The original's Perkins specification table contains non-numeric values in the *Engine power*
column (e.g. `19408`); those cells are reproduced verbatim.

## Assets

The stylesheet and every script are served through Hugo Pipes (`resources.Get | minify | fingerprint`),
so the file name carries a content hash: the browser can cache them forever and a changed file
always gets a new url. The scripts live in `assets/js/` (not `static/`) for that reason.

### Output formats

`hugo.toml` registers three extra output formats:

| Format | Media type | Produces |
| --- | --- | --- |
| `SEARCHINDEX` | application/json | `/search-index.json` — the data behind the site search |
| `CSV` | text/csv | `/products/<series>/spec.csv` — the specification table of a product |
| `ALLSPECS` | text/csv | `/download/all-specs.csv` — every model of every series |

The product pages carry `outputs: ["html", "csv"]` in their front matter, the download page
`outputs: ["html", "allspecs"]`.

## Internationalisation

The site ships **two languages**:

| | English | 简体中文 |
| --- | --- | --- |
| URL | `/…` | `/zh/…` |
| content | `content/` | `content.zh/` |
| UI strings | `i18n/en.toml` | `i18n/zh.toml` |

* every UI string lives in `i18n/<lang>.toml` (navigation, footer, forms, product buttons, news meta);
* internal page links use `relLangURL`, static assets and content-provided image paths stay
  root-relative (`relURL`) because Hugo only publishes `static/` at the site root;
* the language switcher in the header is driven by `site.Home.Sites` — it shows the languages
  configured in `hugo.toml` and links to the other language's home page;
* product/category names come from `data/sidebar.yaml` and `data/categories.yaml` with an
  i18n `key` per entry, so the same list serves both languages;
* front matter carries `description`/`summary` for meta tags.
* data that is content rather than chrome (`data/faq.yaml`, `data/categories.yaml`) carries both
  languages in one file (`q`/`a` and `description`/`description_zh`); the templates pick the
  right one with `site.Language.Lang`;
* the specification table headers are mapped to i18n keys (`col_model`, `col_prime_kw`, …),
  so the Chinese pages show 中文表头 while the data rows stay the original model codes.

Both locales are complete: 55 English pages and 55 Chinese pages, 40/40 Chinese URLs verified.

**To add a third language**

1. `cp -r content content.<lang>` and translate;
2. copy `i18n/en.toml` → `i18n/<lang>.toml` and translate the values;
3. add a `[languages.<lang>]` block in `hugo.toml` with `contentDir = "content.<lang>"`.

## Tooling

> Note: the dev server injects a `livereload.js` snippet into Hugo's render cache. Always stop
> `hugo server` before a production build (`make build` clears `resources/` for you), otherwise
> the snippet leaks into the built HTML and the link check reports it as broken.

```bash
make dev       # hugo server on http://127.0.0.1:1313 (auto rebuild + livereload)
make build     # production build into ./public
make check     # build + link, product, alignment, SEO and language checks
make clean
```

`npm run dev | build | check` does the same thing.

Validation scripts (also used by CI):

| Script | What it does |
| --- | --- |
| `scripts/check-links.js [dir]` | walks the built site, resolves every internal `href`/`src`, fails on a broken one (1234 links, 0 broken) |
| `scripts/check-products.js` | parses the JSON front matter of all 44 product pages and checks the required keys (`columns`, `rows`, `power_min/max`, `hz`, `product_kind`, `comparables`) |
| `scripts/check-alignment.js [dir]` | fails when a built page contains a block narrower than the 1280px container (89 pages checked) |
| `scripts/check-seo.js [dir]` | checks every indexable page for one `<h1>`, a title and meta description of a sane length, canonical link, hreflang alternates, og tags, `alt` on every image and duplicate titles per language (86 pages checked, language-aware limits) |
| `scripts/check-language.js [dir] [lang]` | finds English text left inside the Chinese pages (brand names, model codes and e-mails are allowed). `node scripts/check-language.js public en` runs the same rules over the English pages as a self test |
| `scripts/check-js.js [dir]` | parses every script with the javascript engine — a syntax error silently disables a feature, so it belongs in CI (6 files) |

## SEO and GEO

### Classic SEO

| | |
| --- | --- |
| **Titles** | built per page type: the home page carries the brand and the slogan, a product page is *Series \| Category \| Brand*, a news article is *Title \| News \| Brand*, every other page is *Title \| Brand* — and every title is shortened to the brand alias when it would pass 72 characters |
| **Descriptions** | one per page from the front matter, 50–185 characters (20–120 in Chinese) |
| **Headings** | exactly one `<h1>` per page, the banner steps down to a plain label when the page brings its own heading |
| **Canonical** | every page points at itself; the `/categories/` and `/tags/` taxonomies point at `/products/` and are `noindex` |
| **Languages** | `hreflang` alternates for `en` and `zh` on every page, `og:locale` included |
| **Social** | `og:title`, `og:description`, `og:image` (absolute), `og:url`, `og:type`, twitter cards |
| **Images** | every `<img>` has an `alt`, the file name says what is on it, the file size matches the display size |
| **Sitemap** | `/sitemap.xml` (an index) → `/en/sitemap.xml` and `/zh/sitemap.xml`, every page of both languages |
| **Robots** | `/robots.txt` with the absolute sitemap link and an explicit welcome for the answer engines |
| **Link graph** | no orphan page: every page is linked from at least one other page (checked in CI) |

### Structured data (the same block serves SEO and the answer engines)

| Page | Schema |
| --- | --- |
| every page | `Organization` + `LocalBusiness` (address, contact point, area served, knows about) and `WebSite` with a `SearchAction` |
| home | `WebPage` |
| a category | `CollectionPage` with an `ItemList` of the series |
| a product | `Product` (sku, mpn, image, brand, manufacturer, frequency, power range, model count) |
| faq | `FAQPage` with every question and answer in the visitor's language |
| video | `VideoObject` for each of the three films |
| a news article | `NewsArticle` |
| service | `Service` with the provider and the contact point |
| contact | `ContactPage` |
| inner pages | `BreadcrumbList` |

### GEO — for the answer engines

The point of a generator catalogue is that an engine can *quote* it. So:

- **`/llms.txt`** (llmstxt.org) — a written summary of the company, the key facts and every section, in the language of the site.
- **`/llms-full.txt`** — the whole catalogue as markdown: all 44 series with their power ranges, every model with its prime and standby power, the faq and the company pages.
- **`robots.txt`** welcomes `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot` and `Bytespider`.
- **Every series explains how to choose it** — below the specification table a decision guide
  lists the six decisions a buyer really makes (engine brand, prime or standby duty, voltage and
  frequency, enclosure, starting and transfer, paralleling, site conditions) with the guidance for
  each and what this series offers. The numbers in the last column are read out of the
  specification table, so the guide can never contradict it.
- **Every series answers in one sentence** — the top of each product page carries a single
  generated paragraph (*Engine By Cummins is a 50 Hz diesel generator set series from Eastern Lion,
  built around the Cummins engine, covering 22 to 444 kW in 40 models. It is used for data
  centres, hospitals, …*), built from the data itself so it can never drift from the
  specification table. The same sentence goes into the schema, the search index and
  `llms-full.txt`.
- **The facts are atomic and quotable** — 2 kW to 2000 kW, 50 Hz and 60 Hz, 15,000 alternators and 2,000 generator sets a year, 35 service bases, founded 1987 — in the `Organization` schema, on the home page and in `llms.txt`.
- **The specification tables are the payload** — 44 series, every model with its power, engine, alternator and controller, and the same numbers as `csv` at `/download/all-specs.csv`.
- **Every page is server rendered** — nothing important hides behind a click, so a crawler sees the whole page.
- **The model codes are consistent** everywhere (front matter, tables, csv, schema, `llms.txt`), because that is what an engine matches on.

### The checks

`scripts/check-seo.js` now verifies the above on the built site: one `<h1>`, the title and description lengths (language aware), the canonical, the hreflang alternates, the og tags, the alt attributes, the duplicate titles, **the structured data every page type needs**, the presence of `llms.txt` and `llms-full.txt`, the robots rules for the answer engines, and that no page is an orphan.

## Sending the inquiry (Cloudflare Email Service)

The inquiry form is **not** a mailto any more: the visitor presses *Send inquiry* and the
mail arrives in `sales@easternlion.cn` with a reply-to address of the visitor.

The site is static, so the mail is sent from the edge by a **Pages Function**,
`functions/api/inquiry.js`:

```
browser --POST /api/inquiry--> Pages Function --send_email binding--> Cloudflare Email Service --> sales@easternlion.cn
```

| Piece | Where |
| --- | --- |
| `docs/DEPLOY.md` | the deployment checklist: Cloudflare Pages, the email binding, the domain, the smoke test |
| `functions/api/inquiry.js` | validates the payload, builds the mail (text + html), sends it, returns `{ ok: true }` |
| `wrangler.toml` | the `send_email` binding, restricted to one destination |
| `assets/js/contact.js` | posts the inquiry, shows the receipt - and falls back to WhatsApp / copy / download when the function is not reachable |

**One time setup in the Cloudflare dashboard**

1. **Email Service > Email Sending** > onboard the domain `easternlion.cn` (the sender address
   must belong to an onboarded domain, otherwise the send fails with `550 5.7.1`).
2. The binding from `wrangler.toml` is picked up by Pages automatically; otherwise add it under
   **Settings > Functions > Bindings > Send email** with the name `EMAIL` and the destination
   `sales@easternlion.cn`. The restriction is deliberate: this endpoint may never send
   anywhere else.
3. Nothing else - no API token in the repository, no third party form service.

**Local testing**

`hugo server` does not run Pages Functions, so the form falls back to the preview panel
(the visitor sees *The inquiry could not be sent automatically* plus the WhatsApp, copy and
download options). To test the real thing:

```bash
npx wrangler pages dev public        # serves public/ plus functions/
```

**The SMTP endpoint instead**

Cloudflare Email Service also speaks SMTP for applications that are not on Workers:

| Setting | Value |
| --- | --- |
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` (implicit TLS) |
| Username | the literal `api_token` |
| Password | a Cloudflare API token with the **Email Sending: Edit** permission |

`smtp.mx.cloudflare.net:465` is not reachable from the browser and implicit TLS on 465 is not
available inside a Worker, which is why the Pages Function uses the `send_email` binding - it is
the same delivery pipeline, the same DKIM/ARC signing and the same delivery logs.

## Deployment

The step by step checklist (Cloudflare Pages, the email binding, the custom
domain, the smoke test and the rollback) lives in **[docs/DEPLOY.md](docs/DEPLOY.md)**.


Cloudflare Pages is connected to the GitHub repository, so every push to `main` triggers a build:

| Setting | Value |
| --- | --- |
| Framework preset | Hugo |
| Build command | `hugo --gc --minify` |
| Build output directory | `public` |
| Environment variable | `HUGO_VERSION = 0.134.0` |
| Production branch | `main` |

`/.github/workflows/ci.yml` builds the site and runs all seven validation scripts on every push and
pull request, so a broken link or a truncated product page fails the build before it reaches
Pages.

Custom domain: `www.easternlion.cn` is **not** bound yet — add the domain in the Cloudflare
Pages project and point the DNS record at Cloudflare whenever the switch-over is ready. The
canonical URL is set in `hugo.toml` (`baseURL`), and `hreflang` alternates are emitted for the
`en` / `zh` locales.

Error pages: `layouts/404.html` renders the branded 404 page, `static/_500.html` is published
as `_500.html` for Cloudflare Pages.
