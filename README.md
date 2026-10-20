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

| Token | Value | Use |
| --- | --- | --- |
| `--yellow` | `#fbbf07` | main navigation, accents, timeline dots |
| `--gold` | `#f5c33b` | sidebar "Product Category" header |
| `--red` | `#e8543f` | "Product Description" bar, Inquire button |
| `--blue` | `#3d7fb5` | table group headers (Engine / Controller) |
| `--slate` | `#52708c` | WhatsApp button |
| container | `1180px` | all page grids |
| header / nav | `77px` / `50px` | black header, yellow nav |

Home page uses the light footer, inner pages use the dark footer with the QR code — matching
the original site.

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
