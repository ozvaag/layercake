# SCHEMA — the Layercake study contract

The builder (`web/builder.html`) writes `study.json` from three answers: where (mask + window), what (layers), when (years + normal). Everything below is what those files must hold.

## study.json
```
id, title, subtitle
years:  [Y0, Y1]           the axis; every layer is read on it
normal: [N0, N1]           the reference period for anomalies (WMO 1991–2020)
frame:  { window:{lon:[a,b], lat:[c,d]}, mask:[ISO-2…], admin1_countries:[ISO-2…],
          river_scalerank, exclude_boxes:[{name, lon, lat}] }
layers: [{ id, kind: field|marks|events|series, file, ink, label, unit }]
hydro_year_start_month: 10       the water year's first month (1 = calendar year)
fade: { from:[lon,lat], to:[lon,lat] } | null   land beyond this line fades (Iberia: the Pyrenees)
market: { <crop>: { hs:[…], price, pl, label? } }  ties a crop to its HS products and price code
worldbank: [indicator codes]     for scripts/harvest-worldbank.mjs (defaults if absent)
faostat_items: { itemCode: name } for scripts/harvest-faostat.mjs (defaults if absent)
notes: [paragraphs]              printed under the title — the author's reading of the plate
private: true                    build, but keep off the site's registry
```
`mask` = the admin-0 rings whose mainland defines "inside the study" (grid
points, marks). Borders are used for that and never drawn.

## field — `natural/climate.json`
```
points[]: { lon, lat, normal:[P, ET0, D35, D40, TM] | null,
            hy: { "2000":[P, ET0, D35, D40, TM], … },   hydrological year (Oct–Sep, named by end year)
            cy: { … } }                                   calendar year
columns, normal_period, hydro_year, et0_method, source{name,url,licence,fetched_at}
```
build.mjs adds `place` (nearest marks atom) to each point.

## marks — `food/crops.json` + `places.json`
```
rows[]: { geo (NUTS code), name, crop, year, production_kt, area_kha }
crops: { code: label }      source{…}
places.json: { places: { code: {name, country, units:[admin-1 iso_3166_2…]} }, aliases: {recode → code}, national: {ISO-2: name} }
```
Rows whose `geo` is national go to `national`; regional rows resolve through
`aliases`; anything else (islands, NUTS-1, extra-regio) is dropped and counted.

## events — `policy/instruments.json`
```
instruments[]: { id, date (ISO), country, kind, title, citation, summary,
                 scope:{ regions:[code|"all"], basins:[name] },
                 source_url|null, confidence: recalled|cited|read, verified_at|null,
                 note?, wall?, related?[], check?, source_state?, checked_at? }
kinds: { kind: description }
```
Build fails on: missing id/date/title/citation/confidence/kind/country, a
non-ISO date, an undeclared kind, a scope naming a place not in `places.json`.

## own data — `own/*.csv` → `own/*.json` (scripts/harvest-own.mjs)
```
marks.csv   place,name,lat,lon,series,year,value[,unit][,label]   places are created from lat/lon
series.csv  series,year,value[,unit][,label]                    drawn as a "Yours" lane
events.csv  id,date,title,citation,source_url,lat,lon,scope,kind,summary   lat/lon → a pin; scope → region codes split by ;
```
`places.json` entries may carry `lon`/`lat` directly instead of `units`.
`study.private: true` builds the study but keeps it out of the site's registry.

## series — `food/trade.json`
```
trade[]: { country, product (HS), flow: export|import, year, eur, q_100kg }
price[]: { country, product (Eurostat prod_veg), year, eur }
products, prices: { code: label }   sources[]
```
The page's `MARKET` map ties a crop to its HS products and price code.

## The bundle — `web/data/<id>.js`
`window.STUDY = { id, title, subtitle, years, normal, built, layers, places,
national_names, place_note, field, marks, national, regional_crops, crop_names,
crop_source, trade, events, event_kinds, confidence_tiers, readings }`.
`readings.years[y]` = study-wide means of the field for the cartouche and
the strip; `driest/wettest/hottest` = the years those extremes fall in.
