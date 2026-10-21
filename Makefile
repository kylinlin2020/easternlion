# Fuan Eastern Lion — static site (Hugo)
#
#   make dev      development server on http://127.0.0.1:1313
#   make build    production build into ./public
#   make check    build + link check + product front matter check
#   make clean    remove generated files
#
# Set HUGO to the Hugo binary if it is not on the PATH:
#   make build HUGO=/usr/local/bin/hugo

HUGO ?= hugo
PORT ?= 1313

.PHONY: all dev build preview check links products clean

all: build

dev:
	$(HUGO) server --port $(PORT) --bind 127.0.0.1 --navigateToChanged

build:
	$(HUGO) --gc --minify --noBuildLock

preview:
	$(HUGO) server --port $(PORT) --bind 127.0.0.1 --renderToDisk

check: build links products

links:
	node scripts/check-links.js public

products:
	node scripts/check-products.js

clean:
	rm -rf public resources .hugo_build.lock
