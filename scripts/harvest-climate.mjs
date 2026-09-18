#!/usr/bin/env node
// harvest-climate.mjs — the natural layer: a field of grid points over the
// study's landmass, each carrying per-year aggregates of daily reanalysis.
//
// Source: NASA POWER daily point API (MERRA-2 native ~0.5°×0.625°; public
// domain, no key, no hourly cap). Open-Meteo's ERA5 archive was the first
// choice and reads 242 points × 35 years as ~8 days of hourly-limit drip —
// see research/climate-source.md. Raw daily responses are cached under
// data/sources/power/ so a re-run costs nothing; only the aggregate ships.
//
// Per point, per year, five figures — for the hydrological year (Oct–Sep,
// the water year Iberia lives by; named by the year it ends) and the
// calendar year:
//   P     precipitation, mm (PRECTOTCORR)
//   ET0   reference evapotranspiration, mm — Hargreaves–Samani (FAO-56 eq. 52)
//         from Tmax/Tmin/Tmean and extraterrestrial radiation by latitude,
//         so P−ET0 is a climatic water balance
//   D35   days with Tmax ≥ 35 °C   (heat stress)
//   D40   days with Tmax ≥ 40 °C
//   TM    mean temperature, °C
// plus the 1991–2020 normal of each, so anomalies are against the WMO period.
//
// Usage: node scripts/harvest-climate.mjs studies/iberia/study.json [--step=0.5]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointInRings } from './geo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const studyPath = process.argv[2] || join(ROOT, 'studies/iberia/study.json');
const study = JSON.parse(readFileSync(studyPath, 'utf8'));
// Grid step: given, or in the manifest, or chosen so the field holds ~250 points
// (0.5° for a peninsula; coarser for a continent — POWER's own grid is 0.5°×0.625°).
const stepArg = process.argv.find((a) => a.startsWith('--step='));
const geo = JSON.parse(readFileSync(join(ROOT, 'studies', study.id, 'geo/frame.json'), 'utf8'));
const CACHE = join(ROOT, 'data/sources/power'); mkdirSync(CACHE, { recursive: true });
const [Y0, Y1] = study.years, [N0, N1] = study.normal;

const HM = study.hydro_year_start_month || 10;
const START = `${Math.min(Y0, N0) - 1}${String(HM).padStart(2, '0')}01`, END = `${Y1}1231`;
const PARAMS = 'PRECTOTCORR,T2M_MAX,T2M_MIN,T2M';
const mask = Object.values(geo.mask);
const countAt = (st) => { let n = 0; for (let lat = Math.ceil(W0.lat[0] / st) * st; lat <= W0.lat[1]; lat += st) for (let lon = Math.ceil(W0.lon[0] / st) * st; lon <= W0.lon[1]; lon += st) if (pointInRings([Math.round(lon * 100) / 100, Math.round(lat * 100) / 100], mask)) n++; return n; };
const W0 = study.frame.window;
const STEP = stepArg ? Number(stepArg.slice(7)) : study.frame.field_step || [0.5, 0.75, 1, 1.5, 2, 3].find((st) => countAt(st) <= 320) || 3;
const excluded = (p) => (study.frame.exclude_boxes || []).some((b) => p[0] >= b.lon[0] && p[0] <= b.lon[1] && p[1] >= b.lat[0] && p[1] <= b.lat[1]);

const pts = [];
const W = study.frame.window;
for (let lat = Math.ceil(W.lat[0] / STEP) * STEP; lat <= W.lat[1]; lat += STEP)
  for (let lon = Math.ceil(W.lon[0] / STEP) * STEP; lon <= W.lon[1]; lon += STEP) {
    const p = [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
    if (pointInRings(p, mask) && !excluded(p)) pts.push(p);
  }
console.log(`${pts.length} grid points at ${STEP}°`);
const keyOf = (p) => `${p[1].toFixed(2)}_${p[0].toFixed(2)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPoint(p) {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${PARAMS}&community=AG&longitude=${p[0]}&latitude=${p[1]}&start=${START}&end=${END}&format=JSON`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 429) { await sleep(30000); continue; }
      if (!r.ok) { await sleep(3000 * (attempt + 1)); continue; }
      const j = await r.json(); if (!j.properties?.parameter?.PRECTOTCORR) throw new Error('shape');
      return j;
    } catch (e) { await sleep(3000 * (attempt + 1)); }
  }
  throw new Error('gave up on ' + keyOf(p));
}

// Hargreaves–Samani: ET0 = 0.0023 · Ra · (Tmean + 17.8) · √(Tmax − Tmin), Ra in mm/day.
function Ra(latDeg, doy) {
  const phi = latDeg * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365), dec = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
  const raMJ = 24 * 60 / Math.PI * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
  return raMJ * 0.408;   // MJ m⁻² d⁻¹ → mm d⁻¹
}
const doyOf = (s) => { const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))); return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5); };

function aggregate(j, lat) {
  const q = j.properties.parameter, P = q.PRECTOTCORR, X = q.T2M_MAX, N = q.T2M_MIN, M = q.T2M;
  const hy = {}, cy = {};
  const add = (o, y, k) => {
    const r = o[y] || (o[y] = [0, 0, 0, 0, 0, 0]);
    const p = P[k], x = X[k], n = N[k], m = M[k]; if (p === -999 || x === -999 || n === -999 || m === -999) return;
    r[0] += p; r[1] += Math.max(0, 0.0023 * Ra(lat, doyOf(k)) * (m + 17.8) * Math.sqrt(Math.max(0, x - n)));
    if (x >= 35) r[2]++; if (x >= 40) r[3]++; r[4] += m; r[5]++;
  };
  for (const k of Object.keys(P)) { const y = +k.slice(0, 4), mo = +k.slice(4, 6); add(cy, y, k); add(hy, HM === 1 ? y : (mo >= HM ? y + 1 : y), k); }
  const fin = (o) => { const out = {}; for (const y in o) { const r = o[y]; if (r[5] < 360) continue; out[y] = [Math.round(r[0]), Math.round(r[1]), r[2], r[3], Math.round(r[4] / r[5] * 10) / 10]; } return out; };
  return { hy: fin(hy), cy: fin(cy) };
}
const normalOf = (rows) => { const ys = Object.keys(rows).map(Number).filter((y) => y >= N0 && y <= N1); if (ys.length < 25) return null; const n = [0, 0, 0, 0, 0]; ys.forEach((y) => rows[y].forEach((v, i) => n[i] += v)); return n.map((v, i) => Math.round(v / ys.length * 10) / 10); };

async function main() {
  const todo = pts.filter((p) => !existsSync(join(CACHE, keyOf(p) + '.json')));
  console.log(`${todo.length} to fetch, ${pts.length - todo.length} cached`);
  let done = 0; const C = 4;
  await Promise.all(Array.from({ length: C }, async (_, w) => {
    for (let i = w; i < todo.length; i += C) {
      const j = await fetchPoint(todo[i]); writeFileSync(join(CACHE, keyOf(todo[i]) + '.json'), JSON.stringify(j));
      if (++done % 20 === 0) console.log(`${done}/${todo.length}`);
    }
  }));
  const points = pts.map((p) => {
    const j = JSON.parse(readFileSync(join(CACHE, keyOf(p) + '.json'), 'utf8'));
    const a = aggregate(j, p[1]);
    const yrs = {}; for (let y = Y0; y <= Y1; y++) if (a.hy[y]) yrs[y] = a.hy[y];
    const cal = {}; for (let y = Y0; y <= Y1; y++) if (a.cy[y]) cal[y] = a.cy[y];
    return { lon: p[0], lat: p[1], normal: normalOf(a.hy), normal_cal: normalOf(a.cy), hy: yrs, cy: cal };
  });
  const out = {
    layer: 'climate', kind: 'field', step: STEP, columns: ['P_mm', 'ET0_mm', 'D35', 'D40', 'TM_c'],
    normal_period: [N0, N1], hydro_year: HM === 1 ? 'calendar year' : `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][HM]}–${['', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][HM]}, named by the year it ends`, et0_method: 'Hargreaves–Samani (FAO-56 eq. 52) from MERRA-2 Tmax/Tmin/Tmean',
    source: { name: 'NASA POWER daily API v2 (MERRA-2 / GEOS), parameters PRECTOTCORR, T2M_MAX, T2M_MIN, T2M, community AG', url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/', licence: 'public domain (NASA)', fetched_at: new Date().toISOString().slice(0, 10) },
    points,
  };
  const f = join(ROOT, 'studies', study.id, 'natural/climate.json'); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(out));
  console.log(`wrote ${points.length} points → ${f}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
