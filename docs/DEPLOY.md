# Deployment checklist

The site is a static Hugo build that is served by **Cloudflare Pages**, with one **Pages
Function** that sends the inquiry to `sales@easternlion.cn` through **Cloudflare Email
Service**.

Everything below is written as a checklist: work top to bottom, tick as you go.

---

## 0. What has to be true when you are done

| | Check |
| --- | --- |
| ☐ | `https://www.easternlion.cn/` serves the new design (English) |
| ☐ | `https://www.easternlion.cn/zh/` serves the Chinese version |
| ☐ | `https://www.easternlion.cn/download/` lists the csv spec sheets |
| ☐ | the inquiry form sends a real mail that arrives in `sales@easternlion.cn` |
| ☐ | replying to that mail reaches the visitor |
| ☐ | `https://www.easternlion.cn/sitemap.xml` lists both languages |
| ☐ | `https://www.easternlion.cn/robots.txt` points at the sitemap |

---

## 1. Before the first push

### 1.1 The repository

```bash
make check        # build + 7 validation scripts
git log --oneline origin/main..main   # what is about to go live
```

`make check` runs:

| Script | What it protects |
| --- | --- |
| `check-links.js` | every internal link and asset resolves |
| `check-products.js` | all 44 product pages still have their specification tables |
| `check-alignment.js` | no page block is narrower than the 1280px container |
| `check-seo.js` | one `<h1>`, title and description lengths, canonical, hreflang, og, alt |
| `check-language.js` | no English left inside the Chinese pages (self test on the English pages) |
| `check-js.js` | every script parses |
| `check-inquiry-function.mjs` | the mail function sends to the right place and validates the payload |

### 1.2 Local preview

```bash
make dev                                   # http://127.0.0.1:1313
npx wrangler pages dev public              # the same, plus the pages function
```

The form cannot send from `hugo server` (no functions there) — it falls back to the preview
panel on purpose, so you see the fallback path. Use `wrangler pages dev` to test the real
send.

---

## 2. Cloudflare Pages project

### 2.1 Build settings

| Setting | Value |
| --- | --- |
| Framework preset | Hugo |
| Build command | `hugo --gc --minify` |
| Build output directory | `public` |
| Environment variable | `HUGO_VERSION = 0.134.0` |
| Production branch | `main` |

`wrangler.toml` is read by Pages as well; it sets `pages_build_output_dir = "public"` and
declares the email binding.

### 2.2 The email binding (needed for the inquiry form)

The form posts to `/api/inquiry`, which is `functions/api/inquiry.js`. It sends the mail through
the `EMAIL` binding.

1. **Onboard the sending domain** — in the Cloudflare dashboard open
   **Email Service → Email Sending** and onboard `easternlion.cn`. The sender address must
   belong to an onboarded domain, otherwise every send fails with `550 5.7.1` /
   `E_SENDER_NOT_VERIFIED`.
2. **Add the binding** — under **Settings → Functions → Bindings → Send email**:

   | Field | Value |
   | --- | --- |
   | Variable name | `EMAIL` |
   | Allowed destination | `sales@easternlion.cn` |
   | Permission | Edit |

   The destination restriction is deliberate: this endpoint may never send anywhere else. If
   the binding is already declared in `wrangler.toml`, Pages picks it up on the next deploy
   and you only need the domain onboarding.

3. **Optional: an API token** — only if you want the SMTP endpoint (see §4). Create a token
   with the **Email Sending: Edit** permission and keep it in the Cloudflare dashboard
   (never in the repository).

### 2.3 Error pages

| Page | Source | Status |
| --- | --- | --- |
| 404 | `layouts/404.html` (branded, with a search box) | published as `404.html` |
| 500 | `static/_500.html` | published as `_500.html` |
| 500 (zh) | `static/zh/_500.html` | published as `zh/_500.html` |

---

## 3. The custom domain

`www.easternlion.cn` is **not bound yet**.

1. In the Pages project: **Settings → Custom domains → Set up a custom domain** →
   `www.easternlion.cn`.
2. Cloudflare creates the `CNAME` record automatically when the zone is on the same account.
   If the domain is on another account, create it manually:

   | Type | Name | Target |
   | --- | --- | --- |
   | CNAME | `www` | `<project>.pages.dev` |
   | CNAME | `@` | `<project>.pages.dev` (optional, for the apex) |

3. The canonical url is `https://www.easternlion.cn/` in `hugo.toml` (`baseURL`). Change it
   **before** the first deploy if the domain differs — every canonical link, the sitemap and
   the `hreflang` alternates are built from it.
4. Wait for the certificate, then set the apex (`easternlion.cn`) to redirect to `www` (or the
   other way round) — pick one and keep it, otherwise the two versions compete in the search
   results.

### 3.1 DNS for the mail

Sending from `sales@easternlion.cn` does **not** need a mail server, but the receiving side
does:

- if `sales@easternlion.cn` is a real mailbox, keep the existing MX records,
- if the domain uses **Cloudflare Email Routing**, the inbox is forwarded to the real address
  and the routing rules must not drop `sales@easternlion.cn`.

---

## 4. If you would rather use SMTP

Cloudflare Email Service also speaks SMTP for applications that do not run on Workers:

| Setting | Value |
| --- | --- |
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` (implicit TLS) |
| Security | implicit TLS — port 587 with STARTTLS and plain port 25 are **not** supported |
| Username | the literal string `api_token` |
| Password | a Cloudflare API token with the **Email Sending: Edit** permission |

```bash
curl --ssl-reqd \
  --url "smtps://smtp.mx.cloudflare.net:465" \
  --user "api_token:<API_TOKEN>" \
  --mail-from "sales@easternlion.cn" \
  --mail-rcpt "sales@easternlion.cn" \
  --upload-file mail.txt
```

Use this when the site runs somewhere other than Cloudflare Pages (or when a legacy backend
sends the inquiry). It is **not** reachable from a browser, and the implicit TLS of port 465
is not available inside a Worker — which is why the Pages Function uses the `send_email`
binding. Both go through the same delivery pipeline, the same DKIM/ARC signing and the same
delivery logs.

---

## 5. After the deploy

### 5.1 Smoke test

```bash
# the built site
curl -sI https://www.easternlion.cn/ | head -1
curl -sI https://www.easternlion.cn/zh/ | head -1
curl -s  https://www.easternlion.cn/sitemap.xml | head -20
curl -s  https://www.easternlion.cn/robots.txt

# the inquiry endpoint (a wrong payload must be rejected)
curl -s -X POST https://www.easternlion.cn/api/inquiry \
  -H 'content-type: application/json' -d '{"name":"","email":"x","body":"hi"}'
# -> {"ok":false,"error":"name"}
```

Then, in a browser:

1. open `/contact/`, fill the form, press **Send inquiry**
2. check that the mail arrived in `sales@easternlion.cn`
3. reply to that mail — it must go to the visitor's address
4. open `/products/diesel-generator-set/`, add two models to the comparison, open the badge
5. open `/download/` and download one csv

### 5.2 Search engines

- `https://www.easternlion.cn/sitemap.xml` — a sitemap index with `/en/sitemap.xml` and
  `/zh/sitemap.xml`
- submit the sitemap in Google Search Console and Bing Webmaster Tools
- the `hreflang` alternates are emitted for every page; check them with
  `https://validator.hugo.io` or a validator of your choice

### 5.3 Monitoring

- **Cloudflare → Pages → the deployment logs** show the build output
- **Cloudflare → Email Service → sending logs** show every inquiry, with the delivery result
  and the spam score
- the inquiry function logs the Cloudflare error code when a send fails
  (`E_SENDER_NOT_VERIFIED`, `E_RATE_LIMIT_EXCEEDED`, …)

---

## 6. Rollback

Nothing is deployed by hand, so a rollback is a git operation:

```bash
git log --oneline -10
git revert <sha>          # or
git reset --hard <sha> && git push --force origin main
```

Pages rebuilds on the push and the previous build stays available under
**Deployments → ⋯ → Rollback to this deployment** for 30 days.

The inquiry function and the static site are deployed together, so a rollback never leaves a
function that expects a newer page (or the other way round).

---

## 7. Known limitations

| | |
| --- | --- |
| The form needs JavaScript | without it the visitor gets the plain page — the mail address and the phone number are on the same page, so the inquiry is still possible |
| `hugo server` cannot send | the pages function does not run there; the form falls back to WhatsApp / copy / download |
| The inquiry is stored in the visitor's browser | a form that is started but not sent is remembered locally for 14 days, on that device only |
| No third party form service | no formspree, no database, no tracking: the mail goes straight to Cloudflare and from there to the sales inbox |
