# seta

A minimal gallery of vectorized trademarks & symbols, traced from classic
design reference books — free to browse, compare and download.

Currently holding **2,870 marks** from two books, each traced twice:

- Yasaburo Kuwayama — *Trade Marks & Symbols, Vol. 2 — Symbolical Designs*
  (1973): 1,502 marks (plates, editorial, cover)
- Alan Cooper — *World of Logotypes*: 1,368 marks

- **raw** — maximally faithful to the scan
- **smooth** — same geometry, gently smoothed curves

The design follows Maximilian Berndt's photography site: a quiet grid of
marks, a thin ruler slider to choose how many columns, and a click-to-zoom
detail view. In the detail view you can flip between raw/smooth to compare
the two tracings and download either one.

## Layout

```
static/sources/<book-slug>/     one folder per book, served as-is
  source.json                   title, author, year, optional groupOrder
  order.json                    display order: [{ "page", "group", "name" }]
  raw/*.svg                     faithful SVGs (groups = subfolders)
  smooth/*.svg                  smoothed SVGs, same names
scripts/build-manifest.mjs      scans sources/ -> src/lib/data/manifest.json
src/                            SvelteKit app (single route)
build/                         static build output — deploy this
```

## Adding a book

1. `mkdir static/sources/<slug>/smooth` and drop the SVGs in
   (subfolders like `editorial/` or `cover/` become groups shown after the
   top-level marks). An optional `raw/` sibling gets the compare toggle.
2. Write `source.json`:

   ```json
   {
     "title": "Trade Marks & Symbols, Vol. 2 — Symbolical Designs",
     "author": "Yasaburo Kuwayama",
     "year": 1973
   }
   ```

3. Optionally write `order.json` to control display order
   (`[{ "page": 13, "group": "", "name": "logo-100" }]` — page + reading
   order; without it, marks sort naturally per group).
4. `npm run manifest` — regenerates `src/lib/data/manifest.json`
5. `npm run build`

## Developing

```sh
npm install
npm run dev        # local dev server
npm run build      # static site in build/
npm run preview    # serve build/ locally
npm run qa         # screenshots of the built site into .qa/ (headless Chromium)
```

## Deploying

The build is fully static (`@sveltejs/adapter-static`) with relative asset
paths, so `build/` drops onto any static host and also works under a
subpath such as a GitHub Pages project site (`/seta/`).

## Notes

- The source book was published in 1973; the marks are shown for study and
  reference. Individual marks may still be protected trademarks of their
  respective owners.
- `npm run qa` needs a headless Chromium with system fonts available. On a
  minimal server without fonts (like a bare homelab), text measures 0×0 and
  the layout will look collapsed — that's the environment, not the site.
