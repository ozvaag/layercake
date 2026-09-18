# Layercake — a place, its layers, its years

**Live:** https://layercake.pages.dev · MIT · © Ozvåag LLC

Spin the globe, click where you work, answer three questions — *where, what,
when* — and Layercake writes a study manifest, previews the frame, fetches a
first field live, and (after five commands on your machine) renders a plate:
one sheet, one time axis, every figure with its source.

**Studies:** `studies/morocco/` (non-EU, built with one command: field, FAOSTAT, World Bank, African drainage) · `studies/iberia/` (rain, law and harvest on one peninsula, 2000–2025) · `studies/italy/` (begun from the builder's own output, the proof the printed commands work) · `studies/_smoke/` (own-CSV fixture, private).

| page | what |
|---|---|
| `web/index.html` | the globe: pick a place (one country or a region), open a study |
| `web/builder.html` | the three questions → `study.json`, `places.json`, `instruments.json` + the commands; live NASA POWER preview |
| `web/study.html?s=<id>` | the engine: renders any built study |

Built on the Film Commission Atlas's pattern (`~/dev/film-commission-atlas`):
Natural Earth geometry as plain lon/lat rings projected in the browser, a
`build.mjs` that validates and hash-stamps one bundle, the Atlas's ink-on-paper
chrome (`web/atlas.css`; its `DESIGN.md` governs here too), no framework, no
tile service, Cloudflare Pages at zero cost.

## The idea, generalised

A **study** is a question of the form *"how did these factors move over this
land, across these years, and against each other?"* The engine knows three
shapes of factor and nothing else:

| kind | atom | example here | drawn as |
|---|---|---|---|
| `field` | a grid point with a value per year (and a normal) | rain, heat days, water balance | a dot field — size = magnitude, ink = sign against normal |
| `marks` | a place with a value per year | crop production by NUTS-2 region | a proportional mark at the place's interior point; dashed ring = the period mean |
| `events` | a dated instrument with a scope | laws, decrees, plans, dams | ticks on the axis; rings on the scoped places |
| `series` | a national figure per year | exports, producer prices | a lane on the axis and a row in the cartouche |

The frame is physical: relief (Terrarium), the drainage (HydroRIVERS), coast, lakes, bathymetry, named rivers and surveyed peaks (Natural Earth), and a hand-placed `features.json` of ranges, plateaus, basins, capes, seas, wetlands, reservoirs, peaks and one schematic canal — each class in its own cartographic register.

Everything joins on **one frame** (`geo/frame.json`) and **one year axis**
(`study.years`). No region outlines, no political lines: a place is a point,
a grid cell is a dot, the coast and the rivers are the only lines.

To pose a new question: the builder at `/builder` writes `study.json`,
`places.json` and `instruments.json`; then `node scripts/run.mjs studies/<id>/study.json`.
Or copy a study folder and edit by hand — `SCHEMA.md` is the contract.

## Scripts

| script | does |
|---|---|
| `scripts/geo.mjs` | Natural Earth 10m land, coast, rivers, lakes, admin-0 mask, admin-1 label points → `studies/<id>/geo/frame.json` |
| `scripts/relief.mjs` | Terrarium terrain tiles (AWS Open Data, z8) → hypsometric tint + hillshade PNG rendered in the page's own Albers projection (`scripts/proj.mjs`, `scripts/png.mjs`) |
| `scripts/hydro.mjs` | HydroRIVERS v1.0 Europe shapefile (`scripts/shp.mjs`) → every reach of Strahler order ≥ 4 touching the landmass, with order and discharge |
| `scripts/places-from-frame.mjs` | proposes `places.json`: Natural Earth admin-1 units grouped by their region, matched to Eurostat NUTS-2 labels (EU); unmatched listed for a person |
| `scripts/harvest-own.mjs` | your CSVs in `studies/<id>/own/` (marks, series, events) → JSON in the study's shapes |
| `scripts/run.mjs` | **the one command**: runs, in order, only what the manifest asks for; every step re-runnable alone; raw responses cached |
| `scripts/harvest-faostat.mjs` | FAOSTAT bulk file (34 MB, cached, streamed) → national harvests for ~28 crops, any country |
| `scripts/harvest-worldbank.mjs` | World Bank API → any national indicator per year (`study.worldbank` list) |
| `scripts/harvest-climate.mjs` | NASA POWER daily (MERRA-2) → per-point per-year P, ET₀ (Hargreaves), D35, D40, Tmean; hydrological + calendar year; 1991–2020 normals |
| `scripts/harvest-crops.mjs` | Eurostat `apro_cpshr` NUTS-2 crop production and area |
| `scripts/harvest-trade.mjs` | Eurostat Comext HS exports/imports + `apri_ap_crpouta` producer prices |
| `scripts/check-sources.mjs` | probes every instrument URL; stamps `source_state` up / wall / dead; never touches `confidence` |
| `scripts/build.mjs` | validate → `web/data/<id>.js` + `web/data/<id>-geo.js`; registers the study in `web/data/studies.js`; hash-stamps the pages |
| `scripts/world.mjs` | Natural Earth 50m → `web/data/world.js` for the globe and the builder |
| `deploy.sh` | build → Cloudflare Pages |

Raw source responses cache under `data/sources/` (gitignored); re-runs are free.

## Rules carried over from the Atlas

1. Never show a volatile value without its date and source.
2. Draw absence: a missing year is a gap, not a zero (a national sum with one country missing is `null`).
3. Confidence is a stamp a person sets (`recalled` → `cited` → `read`); a script can only say whether a URL answered.
4. Cite on the face of the plate.
5. Legible in greyscale.

© Ozvåag LLC.
