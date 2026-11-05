# Creel: Chrome extension

Records a site's same-site JSON fetch/XHR responses while the user browses and
downloads them as one ZIP.

## Stack

TypeScript (strict), Vite 8 + @crxjs/vite-plugin 3, bun (package manager and
`bun test`), fflate, oxlint, knip, prettier. Manifest V3, Chrome 123+.

## Architecture

- `src/capture/page.ts`: MAIN world from `document_start`; wraps fetch/XHR
  (`wrap.ts`) and posts captures with `window.postMessage`.
- `src/capture/relay.ts`: isolated world; validates (`lib/messages.ts`) and
  forwards to the service worker.
- `src/background/sw.ts`: the only writer. Session in `chrome.storage.local`,
  script registration, IndexedDB (`lib/db.ts`), badge, download.
- `src/offscreen/`: builds the ZIP (`lib/zip.ts`) and returns a blob URL.
- `src/popup/`: renders the pure view model in `state.ts` (all copy in `COPY`).
- `src/lib/`: `types.ts`, `names.ts`, `site.ts`, `messages.ts`, `db.ts`,
  `zip.ts`, `consent.ts`, `accept.ts`, `same-site.ts`.
- `src/styles/tokens.css`: design tokens.

`page.js` and `relay.js` are built by `bun build --format=iife` into
`dist/capture/`: crxjs would make them web-accessible.

## Commands

`bun run build | start | test | typecheck | check | e2e | store | video`, `just dist`,
`just pack`. `store` renders the store images into `store/screenshots/`, and `video` the
promo into `store/video/`. Both are build output: CI captures the images on every run and
each release attaches them as `creel-store-images.zip`.
`bun test` runs `src/` only (bunfig); `bun run e2e` loads `dist/` in Playwright's
Chromium: `direnv allow` once on NixOS (`flake.nix` provides it), elsewhere
`bunx playwright install chromium` once.

## Rules

- Same-site matching has two parts: `site.ts` `maybeSameSite` (last two labels,
  a superset, the only one allowed in the page and relay scripts) and
  `same-site.ts` (public suffix list via tldts, worker only). Never import
  tldts or `same-site.ts` from `src/capture/`: it would add ~100 kB to every
  recorded page.
- Recording needs the first-run consent (`consent.ts`, versioned): bump
  `CONSENT_VERSION` whenever the notice's meaning changes.
- `@playwright/test` and the nixpkgs commit in `flake.nix` carry the same Playwright
  version: bump them together. Renovate is off for both.
- Releases never publish: `publish.yml` is run by hand. e2e hosts are granted in
  a throwaway copy of `dist/` only.
- The worker is the only writer; popup and offscreen only read.
- Page wrappers never change what the page sees: return the page's own
  Response, swallow every capture error.
- No colour literal outside `src/styles/tokens.css` (the badge colour constant
  is the one exception).
- No `web_accessible_resources`, no static `content_scripts`.
- No `void` operator: oxlint's `no-void` suggestion rewrites it to `undefined`.
  `check` applies safe fixes only.
