# Iberia — heat and deaths

A second question on the same sheet: heat-stress days against summer deaths by region, 2000–2025

**Mask:** Spain (ES), Portugal (PT) · **Years:** 2000–2025 · **Normal:** 1991–2020 · **Built:** 2026-09-18
**Live:** https://layercake.pages.dev/study?s=iberia-heat

The same frame as the Iberia study — the same relief, drainage, basins and grid — asked a different question: do the summers with more days at or above 35 °C carry more deaths, region by region? The marks are Eurostat's weekly deaths by NUTS-2 region, folded to June–August and to the whole year; the ground is the calendar-year field. Correlation is not attribution: an ageing population raises both the baseline and the vulnerability, and the pandemic years sit inside the span.

This study exists to test the module beyond agriculture. Nothing in the engine changed to make it; the reader was declared in the manifest.

## What it holds

20 places · 242 grid points · 10 instruments · 0 trade rows · 2 series

## Sources

- **Ground (field):** NASA POWER daily API v2 (MERRA-2 / GEOS), parameters PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, community AG — public domain (NASA); fetched 2026-09-18; 242 grid points at 0.5°; calendar year; ET₀ Hargreaves–Samani (FAO-56 eq. 52) from MERRA-2 Tmax/Tmin/Tmean; normals 1991–2020.
- **Indicators (series):** World Bank Indicators API v2 — CC BY 4.0; fetched 2026-09-18; 2 series.
- **Law (events):** 10 instruments, hand-curated with a citation each — 6 recalled, 4 cited.
- **Frame:** Natural Earth 1:10m (public domain) coast, lakes, bathymetry, named rivers, peaks; HydroRIVERS v1.0 (free with attribution) drainage; Terrarium terrain tiles (AWS Open Data) relief.

A reanalysis is a model fitted to observations, not a rain gauge. Correlation printed on the plate is not attribution.

## Files

- `study.json` — the manifest (where, what, when)
- `places.json` — the marks' atoms
- `policy/instruments.json` — the events, cited
- `geo/`, `natural/`, `food/`, `series/`, `own/` — reader outputs, regenerable with `node scripts/run.mjs studies/iberia-heat/study.json`

## Cite

> *Iberia — heat and deaths* — a Layercake study, built 2026-09-18. https://layercake.pages.dev/study?s=iberia-heat · https://github.com/ozvaag/layercake/tree/main/studies/iberia-heat

Engine © Ozvåag LLC, MIT. Each source keeps its own licence, listed above.
