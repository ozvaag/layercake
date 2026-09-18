# The natural layer's source — decided 2026-09-18

**First choice, abandoned:** Open-Meteo historical archive (ERA5, 0.25°). No key,
but the free tier's *hourly* budget was exhausted after 15 of 242 grid points
at 35 years × 4 daily variables ("Hourly API request limit exceeded"). At that
rate the field is an ~8-day drip. Fine for a re-run of one point; not a reader.

**In use:** NASA POWER daily point API v2 (MERRA-2 reanalysis, native
0.5° × 0.625°, public domain, no key, no hourly cap; 35 years answers in ~2 s).
Coarser than ERA5-Land and MERRA-2 precipitation over complex terrain is known
to be smoother than station truth — say "reanalysis", never "measured".

**ET0** is Hargreaves–Samani (FAO-56 eq. 52) computed here from Tmax/Tmin/Tmean
and extraterrestrial radiation by latitude/day. It runs ~10–15% off
Penman–Monteith in windy or humid regimes; the water balance P−ET0 is a
climatic index, not an irrigation requirement.

**Upgrade path:** Copernicus CDS `reanalysis-era5-land` monthly means with a
CDS key (free registration) — swap the reader, keep the aggregate shape.
