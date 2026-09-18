# Italy

Begun from the builder — rain, heat, harvest and market, 2000–2025

**Mask:** Italy (IT) · **Years:** 2000–2025 · **Normal:** 1991–2020 · **Built:** 2026-09-18
**Live:** https://layercake.pages.dev/study?s=italy

This study was begun from the builder's own output and built with the printed commands, as a check that they work; its instruments are a beginning, not a record.

On the sheet the rice marks sit where rice is grown — the Po plain, Piemonte and Lombardia — and in 2022, the year the basin's drought emergency was declared, the national rice harvest reads 85% of its mean with 16 heat days per grid point against a normal of 6.

## What it holds

21 places · 113 grid points · 2 instruments · 676 trade rows · 8 series

## Sources

- **Ground (field):** NASA POWER daily API v2 (MERRA-2 / GEOS), parameters PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, community AG — public domain (NASA); fetched 2026-09-18; 113 grid points at 0.5°; Oct–Sep, named by the year it ends; ET₀ Hargreaves–Samani (FAO-56 eq. 52) from MERRA-2 Tmax/Tmin/Tmean; normals 1991–2020.
- **Harvest (marks, regional):** Eurostat apro_cpshr — Crop production in EU standard humidity by NUTS 2 region — CC BY 4.0; source updated 2026-09-08, fetched 2026-09-18; regional series for Cereals (grain), Grain maize, Rice, Sunflower seed, Potatoes.
- **Harvest (national):** FAOSTAT Production: Crops and livestock products (bulk, normalized) — CC BY 4.0; fetched 2026-09-18.
- **Market (series):** Eurostat Comext ds-045409 — EU trade since 1988 by HS2-4-6 and CN8 — CC BY 4.0; fetched 2026-09-18.
- **Market (series):** Eurostat apri_ap_crpouta — Selling prices of crop products (absolute prices) — CC BY 4.0; fetched 2026-09-18.
- **Indicators (series):** World Bank Indicators API v2 — CC BY 4.0; fetched 2026-09-18; 8 series.
- **Law (events):** 2 instruments, hand-curated with a citation each — 2 recalled.
- **Frame:** Natural Earth 1:10m (public domain) coast, lakes, bathymetry, named rivers, peaks; HydroRIVERS v1.0 (free with attribution) drainage; Terrarium terrain tiles (AWS Open Data) relief.

A reanalysis is a model fitted to observations, not a rain gauge. Correlation printed on the plate is not attribution.

## Files

- `study.json` — the manifest (where, what, when)
- `places.json` — the marks' atoms
- `policy/instruments.json` — the events, cited
- `geo/`, `natural/`, `food/`, `series/`, `own/` — reader outputs, regenerable with `node scripts/run.mjs studies/italy/study.json`

## Cite

> *Italy* — a Layercake study, built 2026-09-18. https://layercake.pages.dev/study?s=italy · https://github.com/ozvaag/layercake/tree/main/studies/italy

Engine © Ozvåag LLC, MIT. Each source keeps its own licence, listed above.
