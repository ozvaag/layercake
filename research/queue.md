# What a person still has to do — 2026-09-18

## Policy
- Open every `wall` citation (Portugal, DRE) in a browser and set `confidence` by hand; the four RCMs (83/2005, 113/2005, 52/2016, 80/2017) did not resolve through DRE's ELI redirect at all — confirm the numbers.
- `es-donana-bill-2022`, `pt-drought-2022`: no primary URL on file.
- EUR-Lex answers 202 with a challenge page to scripts; the six EU citations are `recalled`.
- Missing instruments worth adding: Spain's Ley de Aguas consolidated text (RDL 1/2001), RDL 3/2008 mini-transfer as its own row, Portugal's PNRegadios (2017/18), Portugal's third-cycle PGRH (2023), Catalonia's 2024 emergency lift, the Doñana 2023 framework's Consejo de Ministros reference.

## Harvest
- Regional olive, citrus, grape, almond series: Eurostat carries none for ES/PT. Readers to write: Spain MAPA *Anuario de Estadística* (provincial XLSX per year) and Portugal INE (indicator API, NUTS-2/3). Until then those crops are national on the strip and absent from the sheet.
- Cork production: not in Eurostat or FAOSTAT crops. APCOR yearbook / INE "cortiça" — a reader per source. Exports (HS 4501–4504) are in.
- Eurostat's NUTS-2024 recode of Portugal from 2023: PT1D (Oeste e Vale do Tejo) folded into Centro — printed as a discontinuity, not repaired.

## Natural
- Reservoir storage: MITECO's BD-Embalses.zip is an Access database behind a 302 (needs a browser + mdbtools or a converted CSV); SNIRH for Portugal. The state variable the drought decrees watch — still the biggest missing layer for the water-law argument.
- Reservoir storage per basin (MITECO Boletín Hidrológico; SNIRH) — the state variable the drought decrees actually watch. Not read.
- ERA5-Land via a CDS key would replace MERRA-2 at 0.1°; keep the aggregate shape.
- Heat stress is a Tmax-day count; a crop-specific index (olive flowering window, citrus) is a later refinement.

## Engine
- Mobile layout not verified on a real phone (the browser tool renders wide).
- A second study is the test of the module: nothing in `web/index.html` should need to change beyond `MARKET` (crop → HS map), which belongs in the study manifest.
