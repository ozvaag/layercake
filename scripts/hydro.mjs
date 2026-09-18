#!/usr/bin/env node
// hydro.mjs — the river network: HydroRIVERS v1.0 (HydroSHEDS; Lehner &
// Grill 2013; free with attribution) clipped to the study window and kept
// where it touches the masked land. No names — HydroRIVERS has none; the
// names come from Natural Earth and the study's own features file. Each
// reach keeps its Strahler order (ORD_STRA) and mean discharge (DIS_AV_CMS)
// so the page can weight the line.
// Usage: node scripts/hydro.mjs studies/iberia/study.json [--min-order=4]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShp, readDbf } from './shp.mjs';
import { pointInRings } from './geo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const MIN = Number((process.argv.find((a) => a.startsWith('--min-order=')) || '--min-order=4').split('=')[1]);
const W = study.frame.window;
const geo = JSON.parse(readFileSync(join(ROOT, 'studies', study.id, 'geo/frame.json'), 'utf8')); const mask = Object.values(geo.mask);
const SHP = join(ROOT, 'data/sources/hydrorivers/HydroRIVERS_v10_eu_shp/HydroRIVERS_v10_eu.shp');
const dbf = readDbf(SHP.replace(/\.shp$/, '.dbf'), ['HYRIV_ID', 'ORD_STRA', 'DIS_AV_CMS', 'MAIN_RIV', 'LENGTH_KM']);
console.log(dbf.n, 'reaches in Europe; columns', dbf.cols.join(','));
const inWin = ([x0, y0, x1, y1]) => x1 >= W.lon[0] && x0 <= W.lon[1] && y1 >= W.lat[0] && y0 <= W.lat[1];
const shapes = readShp(SHP, inWin);
console.log(shapes.length, 'reaches in window');
const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
const out = [];
for (const s of shapes) {
  const a = dbf.row(s.idx); if (a.ORD_STRA < MIN) continue;
  for (const line of s.lines) { if (!line.some((p) => pointInRings(p, mask))) continue; out.push({ o: a.ORD_STRA, q: Math.round(a.DIS_AV_CMS * 10) / 10, m: a.MAIN_RIV, pts: line.map(r4) }); }
}
const byO = {}; out.forEach((r) => byO[r.o] = (byO[r.o] || 0) + 1);
writeFileSync(join(ROOT, 'studies', study.id, 'geo/rivers.json'), JSON.stringify({ source: 'HydroRIVERS v1.0 (HydroSHEDS), Lehner & Grill 2013 — free with attribution', min_order: MIN, count: out.length, reaches: out }));
console.log('kept', out.length, 'reaches; by Strahler order', JSON.stringify(byO), '·', (JSON.stringify(out).length / 1024).toFixed(0), 'KB');
