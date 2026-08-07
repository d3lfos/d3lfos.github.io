# Delfos Arb — site

Minimal GitHub Pages (Jekyll) landing for **Delfos Arb**.

## Ruby (macOS)

macOS ships Ruby 2.6 — too old. Use Homebrew Ruby 3.4:

```bash
brew install ruby   # already installed if `brew list ruby` works
echo 'export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
ruby -v   # expect 3.4.x
```

## Local

```bash
cd delfosarb-web
bundle install
bundle exec jekyll serve
```

Open http://127.0.0.1:4000

## GitHub Pages

1. Create a public repo (e.g. `DelfosArb/delfosarb.github.io` for org site, or `delfosarb-web` with Pages from `main` / root).
2. Push `main`.
3. Settings → Pages → Source: Deploy from branch `main` / `/ (root)`.

## Brand

- Logo: `assets/logo.svg` (vector) · `assets/logo.png` / `logo-source.png` (raster)
- Line: *Reading the living surface of the order book.*
