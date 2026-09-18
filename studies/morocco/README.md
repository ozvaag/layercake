# Morocco

A non-EU study, one command — rain, heat, national harvest, indicators, water law, 2000–2025

**Mask:** Morocco (MA) · **Years:** 2000–2025 · **Normal:** 1991–2020 · **Built:** 2026-09-18
**Live:** https://layercake.pages.dev/study?s=morocco


## What it holds

15 places · 162 grid points · 4 instruments · 0 trade rows · 6 series

## Sources

- **Ground (field):** NASA POWER daily API v2 (MERRA-2 / GEOS), parameters PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, community AG — public domain (NASA); fetched 2026-09-18; 162 grid points at 0.5°; Sep–Aug, named by the year it ends; ET₀ Hargreaves–Samani (FAO-56 eq. 52) from MERRA-2 Tmax/Tmin/Tmean; normals 1991–2020.
- **Harvest (national):** FAOSTAT Production: Crops and livestock products (bulk, normalized) — CC BY 4.0; fetched 2026-09-18.
- **Indicators (series):** World Bank Indicators API v2 — CC BY 4.0; fetched 2026-09-18; 6 series.
- **Law (events):** 4 instruments, hand-curated with a citation each — 4 recalled.
- **Frame:** Natural Earth 1:10m (public domain) coast, lakes, bathymetry, named rivers, peaks; HydroRIVERS v1.0 (free with attribution) drainage; Terrarium terrain tiles (AWS Open Data) relief.

A reanalysis is a model fitted to observations, not a rain gauge. Correlation printed on the plate is not attribution.

## Files

- `study.json` — the manifest (where, what, when)
- `places.json` — the marks' atoms
- `policy/instruments.json` — the events, cited
- `geo/`, `natural/`, `food/`, `series/`, `own/` — reader outputs, regenerable with `node scripts/run.mjs studies/morocco/study.json`

## Cite

> *Morocco* — a Layercake study, built 2026-09-18. https://layercake.pages.dev/study?s=morocco · https://github.com/ozvaag/layercake/tree/main/studies/morocco

Engine © Ozvåag LLC, MIT. Each source keeps its own licence, listed above.
