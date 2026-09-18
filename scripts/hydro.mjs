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
// HydroRIVERS ships per region; the study's mask decides which, by Natural Earth's continent.
const WORLD = (new Function(readFileSync(join(ROOT, 'web/data/world.js'), 'utf8').replace('window.WORLD=', 'return ')))();
const REGION = { Europe: 'eu', Africa: 'af', Asia: 'as', 'North America': 'na', 'South America': 'sa', Oceania: 'au' };
const conts = [...new Set(study.frame.mask.map((cc) => WORLD.countries[cc]?.continent).filter(Boolean))];
const regs = [...new Set(conts.map((c) => REGION[c]).filter(Boolean))]; if (!regs.length) regs.push('eu');
import { existsSync, mkdirSync, createWriteStream } from 'node:fs'; import { execSync } from 'node:child_process';
async function ensure(reg) { const dir = join(ROOT, 'data/sources/hydrorivers'); const shp = join(dir, `HydroRIVERS_v10_${reg}_shp/HydroRIVERS_v10_${reg}.shp`); if (existsSync(shp)) return shp; mkdirSync(dir, { recursive: true }); const zip = join(dir, `${reg}.zip`); if (!existsSync(zip)) { console.log(`downloading HydroRIVERS ${reg} (60–110 MB)…`); const r = await fetch(`https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_${reg}_shp.zip`); if (!r.ok) throw new Error('hydrorivers ' + r.status); await new Promise((ok, no) => { const w = createWriteStream(zip); r.body.pipeTo(new WritableStream({ write(c) { w.write(c); }, close() { w.end(ok); }, abort: no })); }); } execSync(`unzip -qo "${zip}" -d "${dir}"`); return shp; }
const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
const inWin = ([x0, y0, x1, y1]) => x1 >= W.lon[0] && x0 <= W.lon[1] && y1 >= W.lat[0] && y0 <= W.lat[1];
const out = [];
for (const reg of regs) {
  const SHP = await ensure(reg);
  const dbf = readDbf(SHP.replace(/\.shp$/, '.dbf'), ['HYRIV_ID', 'ORD_STRA', 'DIS_AV_CMS', 'MAIN_RIV', 'LENGTH_KM']);
  const shapes = readShp(SHP, inWin);
  console.log(`${reg}: ${dbf.n} reaches, ${shapes.length} in window`);
  for (const s of shapes) {
    const a = dbf.row(s.idx); if (a.ORD_STRA < MIN) continue;
    for (const line of s.lines) { if (!line.some((p) => pointInRings(p, mask))) continue; out.push({ o: a.ORD_STRA, q: Math.round(a.DIS_AV_CMS * 10) / 10, m: a.MAIN_RIV, pts: line.map(r4) }); }
  }
}
const byO = {}; out.forEach((r) => byO[r.o] = (byO[r.o] || 0) + 1);
writeFileSync(join(ROOT, 'studies', study.id, 'geo/rivers.json'), JSON.stringify({ source: `HydroRIVERS v1.0 (HydroSHEDS; ${regs.join('+')}), Lehner & Grill 2013 — free with attribution`, min_order: MIN, count: out.length, reaches: out }));
console.log('kept', out.length, 'reaches; by Strahler order', JSON.stringify(byO), '·', (JSON.stringify(out).length / 1024).toFixed(0), 'KB');
