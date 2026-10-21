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
hugo.toml                 site config, company/contact parameters
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
data/
  categories.yaml         the three product families used on the home / products pages
  sidebar.yaml            the five product categories shown in the sidebar
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

## Design tokens

All values were measured from the original site (Chrome computed styles + rendered
screenshots of a local mirror of `easternlion.cn`).

| Token | Value | Use |
| --- | --- | --- |
| `--yellow` | `#fbbf07` | main navigation, timeline dots, banner bar |
| `--gold` | `#f3c043` | sidebar "Product Category" header, table header row, `rgba(243,192,67,.44)` caption bars |
| `--red` | `#e64545` | Inquire button; `#e8543f` for the "Product Description" bar |
| `--blue` | `#1d5991` | table group headers (Engine / Controller) |
| `--slate` | `#52708c` | Add to Basket button |
| `--green` | `#3fbe72` | mailto links in the footer |
| container | `1180px` | all page grids |
| header / nav | `76px` / `50px` | black header, yellow nav, 7 equal items (169px each) |
| sidebar | `280px` | product tile size as well (square, 20px radius) |
| body | `#000` | the whole site is dark; only the breadcrumb bar and the footer bottom bar are light |

### Hero and banners

* **Home hero** — the original uses LayerSlider (`fullwidth` skin): a fixed **800px** stage
  (measured 1425×800 at a 1425px viewport) in which the 1920×800 slide is scaled to *cover*
  and centred, so the sides of the picture are cropped. Reproduced 1:1.
* **Inner banners** — the original rule is
  `background:url(...) no-repeat scroll center center; background-size:cover;`
  with `padding-top:120px; padding-bottom:130px` (120/120 on Contact, Service, Video and FAQ).
  The height is therefore driven by the content, and the title lands at `y = 246px` — exactly
  like the original.

### Tiles
Two tile styles exist on the original site and both are reproduced:

* **Home / Products overview** — `pic-desc-bottom`: photo with a translucent gold bar
  (44% gold, 68px) across the bottom and a centred white caption.
* **Category pages** — `pic-desc-zoom-half-full-border`: square 280×280 tile, 20px radius,
  50% black overlay, centred white 24px caption; the overlay lightens on hover.

### Footer

Four columns — company block (name, tagline, 23px phone, fax, green mailto, 120px QR code,
website), *Quick Links*, *Company Profile*, *Product Category* — followed by a **white**
bottom bar with the factory address on the left and `Copyright © 2019 …` on the right.

### Float rail

Fixed panel on the right edge: *Telephone* (two numbers), *Email* (two addresses) and a red
*Leave a Message* button, exactly as in the original `onlineService` widget.

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

The original site has three contrast bugs that a faithful clone keeps:

1. the home page "Product Center" heading is `#333` on black,
2. the home page intro paragraph is `#545454` on black,
3. the footer column titles, the footer company name and the *Development History*
   descriptions are `#000` on black in the source CSS — invisible on the original site.

This build renders #3 readable by default. To get the pixel-identical original look, add
`?theme=original` to any URL (it is remembered in `localStorage`):

```
http://127.0.0.1:1313/about/history/?theme=original
```

Also note that the original's Perkins specification table contains non-numeric values in the
*Engine power* column (e.g. `19408`); those cells are reproduced verbatim.

## Internationalisation

The site is English only, but the structure is ready for i18n:

* front matter carries `description`/`summary` for meta tags,
* all user-facing strings live in `hugo.toml` (`[params]`) or in `data/*.yaml`,
* the language switcher in the header is a single element in `layouts/partials/header.html`.

To add a locale, enable Hugo multilingual mode and duplicate `content/` into `content.<lang>/`.

## Deployment

Cloudflare Pages is connected to the GitHub repository, so every push to `main` triggers a build:

1. build command: `hugo --gc --minify`
2. output directory: `public`
3. production branch: `main`

The custom domain `www.easternlion.cn` is **not** bound yet — point DNS at Cloudflare whenever
the switch-over is ready.
