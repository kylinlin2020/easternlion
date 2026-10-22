# Fuan Eastern Lion — static site (Hugo)
#
#   make dev      development server on http://127.0.0.1:1313
#   make build    production build into ./public
#   make check    build + all seven validation scripts
#   make clean    remove generated files
#
# Set HUGO to the Hugo binary if it is not on the PATH:
#   make build HUGO=/usr/local/bin/hugo

HUGO ?= hugo
PORT ?= 1313

.PHONY: all dev build preview check links products align seo language js inquiry clean

all: build

dev:
	$(HUGO) server --port $(PORT) --bind 127.0.0.1 --navigateToChanged

build:
	@# the dev server injects a livereload snippet into the render cache and leaves a
	@# .hugo_build.lock behind that carries its baseURL (localhost:1313) — both have to go
	rm -rf resources public .hugo_build.lock
	$(HUGO) --gc --minify --noBuildLock

preview:
	$(HUGO) server --port $(PORT) --bind 127.0.0.1 --renderToDisk

check: build links products align seo language js inquiry

links:
	node scripts/check-links.js public

products:
	node scripts/check-products.js

align:
	node scripts/check-alignment.js public

seo:
	node scripts/check-seo.js public

language:
	node scripts/check-language.js public

js:
	node scripts/check-js.js assets/js

inquiry:
	node scripts/check-inquiry-function.mjs

clean:
	rm -rf public resources .hugo_build.lock
