# Iberia

Rain, law and harvest on one peninsula, 2000–2025

**Mask:** Spain (ES), Portugal (PT) · **Years:** 2000–2025 · **Normal:** 1991–2020 · **Built:** 2026-09-24
**Live:** https://layercake.pages.dev/study?s=iberia

The three layers are read against each other, never merged: a dry year on the field, an instrument on the strip and a fall in the harvest are three facts from three sources on one axis, and the page prints the correlation without claiming the cause.

What the data said first: the driest hydrological year was 2005 (63% of normal) and the wettest 2010; 2022 carried the most days at or above 35 °C. Portugal's olive harvest rose from 174 kt in 2000 to 1,376 kt in 2021 — the Alqueva irrigation perimeter in one number. In Andalucía in 2022 the irrigated crops fell first: rice at 87 kt against a mean of 298, maize at 50 against 225.

Eurostat publishes olives, citrus and grapes for Spain and Portugal nationally only; the regional marks are cereals, maize, rice, sunflower and potatoes. FAOSTAT's national series fill two Spanish olive years Eurostat lacks. Thirty-seven instruments are on file, fourteen resolved at their publisher; Portugal's gazette cannot be checked by script.

## What it holds

20 places · 242 grid points · 37 instruments · 1352 trade rows · 16 series

## Sources

- **Ground (field):** NASA POWER daily API v2 (MERRA-2 / GEOS), parameters PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, community AG — public domain (NASA); fetched 2026-09-24; 242 grid points at 0.5°; Oct–Sep, named by the year it ends; ET₀ Hargreaves–Samani (FAO-56 eq. 52) from MERRA-2 Tmax/Tmin/Tmean; normals 1991–2020.
- **Harvest (marks, regional):** Eurostat apro_cpshr — Crop production in EU standard humidity by NUTS 2 region — CC BY 4.0; source updated 2026-09-08, fetched 2026-09-24; regional series for Cereals (grain), Grain maize, Rice, Sunflower seed, Potatoes, Cereal yield, Rice yield.
- **Harvest (national):** FAOSTAT Production: Crops and livestock products (bulk, normalized) — CC BY 4.0; fetched 2026-09-24.
- **Market (series):** Eurostat Comext ds-045409 — EU trade since 1988 by HS2-4-6 and CN8 — CC BY 4.0; fetched 2026-09-24.
- **Market (series):** Eurostat apri_ap_crpouta — Selling prices of crop products (absolute prices) — CC BY 4.0; fetched 2026-09-24.
- **Indicators (series):** World Bank Indicators API v2 — CC BY 4.0; fetched 2026-09-24; 16 series.
- **Law (events):** 37 instruments, hand-curated with a citation each — 23 recalled, 14 cited.
- **Frame:** Natural Earth 1:10m (public domain) coast, lakes, bathymetry, named rivers, peaks; HydroRIVERS v1.0 (free with attribution) drainage; Terrarium terrain tiles (AWS Open Data) relief.

A reanalysis is a model fitted to observations, not a rain gauge. Correlation printed on the plate is not attribution.

## Files

- `study.json` — the manifest (where, what, when)
- `places.json` — the marks' atoms
- `policy/instruments.json` — the events, cited
- `geo/`, `natural/`, `food/`, `series/`, `own/` — reader outputs, regenerable with `node scripts/run.mjs studies/iberia/study.json`

## Cite

> *Iberia* — a Layercake study, built 2026-09-24. https://layercake.pages.dev/study?s=iberia · https://github.com/ozvaag/layercake/tree/main/studies/iberia

Engine © Ozvåag LLC, MIT. Each source keeps its own licence, listed above.
