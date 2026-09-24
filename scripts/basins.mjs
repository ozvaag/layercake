#!/usr/bin/env node
// basins.mjs — drainage basins for the sheet, from HydroBASINS (HydroSHEDS;
// Lehner & Grill 2013; free with attribution), Pfafstetter level 4 by default.
// HydroBASINS carries no names, so each basin is named after the largest
// named river (Natural Earth) whose lowest point lies inside it; the rest keep
// their HYBAS_ID and stay nameless. A study's instruments can then scope to a
// basin by name and the sheet will find it. → studies/<id>/geo/basins.json
// Usage: node scripts/basins.mjs studies/<id>/study.json [--level=4]
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShpPolygons, readDbf } from './shp.mjs';
import { pointInRings } from './geo.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const LEV = String((process.argv.find((a) => a.startsWith('--level=')) || `--level=${study.frame.basin_level || 5}`).split('=')[1]).padStart(2, '0');
const W = study.frame.window;
const geo = JSON.parse(readFileSync(join(ROOT, 'studies', study.id, 'geo/frame.json'), 'utf8')); const mask = Object.values(geo.mask);
const WORLD = (new Function(readFileSync(join(ROOT, 'web/data/world.js'), 'utf8').replace('window.WORLD=', 'return ')))();
const REGION = { Europe: 'eu', Africa: 'af', Asia: 'as', 'North America': 'na', 'South America': 'sa', Oceania: 'au' };
const regs = [...new Set(study.frame.mask.map((cc) => REGION[WORLD.countries[cc]?.continent]).filter(Boolean))]; if (!regs.length) regs.push('eu');
async function ensure(reg) { const dir = join(ROOT, 'data/sources/hydrobasins'); const shp = join(dir, `hybas_${reg}_lev${LEV}_v1c.shp`); if (existsSync(shp)) return shp; mkdirSync(dir, { recursive: true }); const zip = join(dir, `${reg}_${LEV}.zip`); if (!existsSync(zip)) { console.log(`downloading HydroBASINS ${reg} level ${LEV}…`); const r = await fetch(`https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_${reg}_lev${LEV}_v1c.zip`, { headers: { 'user-agent': 'Mozilla/5.0 (layercake)' } }); if (!r.ok) throw new Error('hydrobasins ' + r.status); await new Promise((ok, no) => { const w = createWriteStream(zip); r.body.pipeTo(new WritableStream({ write(c) { w.write(c); }, close() { w.end(ok); }, abort: no })); }); } execSync(`unzip -qo "${zip}" -d "${dir}"`); return shp; }
function simplify(ring, tol) { if (ring.length <= 4) return ring; const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1; const st = [[0, ring.length - 1]]; while (st.length) { const [i0, i1] = st.pop(); const [ax, ay] = ring[i0], [bx, by] = ring[i1]; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let dm = 0, im = -1; for (let i = i0 + 1; i < i1; i++) { const [px, py] = ring[i]; let d; if (!l2) d = Math.hypot(px - ax, py - ay); else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); } if (d > dm) { dm = d; im = i; } } if (dm > tol) { keep[im] = 1; st.push([i0, im], [im, i1]); } } return ring.filter((_, i) => keep[i]); }
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [nx, ny] = r[(i + 1) % r.length]; return s + x * ny - nx * y; }, 0) / 2);
const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];
const inWin = ([x0, y0, x1, y1]) => x1 >= W.lon[0] && x0 <= W.lon[1] && y1 >= W.lat[0] && y0 <= W.lat[1];
const out = [];
for (const reg of regs) {
  const SHP = await ensure(reg); const dbf = readDbf(SHP.replace(/\.shp$/, '.dbf'), ['HYBAS_ID', 'MAIN_BAS', 'SUB_AREA', 'UP_AREA']);
  const polys = readShpPolygons(SHP, inWin); console.log(`${reg} lev${LEV}: ${polys.length} basins in window`);
  for (const b of polys) { const a = dbf.row(b.idx); const outer = b.rings.reduce((x, y) => area(y) > area(x) ? y : x); if (!outer.some((p) => pointInRings(p, mask))) continue; out.push({ id: String(a.HYBAS_ID), main: String(a.MAIN_BAS), area_km2: Math.round(a.SUB_AREA), ring: simplify(outer, 0.006).map(r4), name: null }); }
}
// Name basins after the named rivers: a river's lowest point (its last vertex,
// west→east ordered lines are re-checked by elevation-free heuristic: the end
// nearest the coast) sits in the basin it drains. Largest river wins a basin.
const coast = geo.coast.flat(); const nearCoast = (p) => Math.min(...coast.map((c) => Math.hypot(c[0] - p[0], c[1] - p[1])));
const rivers = (geo.named_rivers || []).map((r) => { const a = r.pts[0], b = r.pts[r.pts.length - 1]; return { name: r.name, rank: r.rank, mouth: nearCoast(a) < nearCoast(b) ? a : b, len: r.pts.length }; }).sort((a, b) => a.rank - b.rank || b.len - a.len);
const SYN = { Tajo: 'Tajo · Tejo', Tejo: 'Tajo · Tejo', Duero: 'Duero · Douro', Miño: 'Miño · Minho', Minho: 'Miño · Minho' };
const mainName = {};
for (const r of rivers) { const b = out.find((b) => !b.name && pointInRings(r.mouth, [b.ring])); if (!b) continue; if (mainName[b.main]) { b.tributary = SYN[r.name] || r.name; continue; } b.name = SYN[r.name] || r.name; mainName[b.main] = b.name; }
// Sub-basins of one main basin share its name where they have none of their own.
out.forEach((b) => { if (!b.name && mainName[b.main]) b.name = mainName[b.main]; });
const f = join(ROOT, 'studies', study.id, 'geo/basins.json'); writeFileSync(f, JSON.stringify({ source: `HydroBASINS v1c level ${LEV} (HydroSHEDS; ${regs.join('+')}), Lehner & Grill 2013 — free with attribution; names from Natural Earth rivers`, level: +LEV, basins: out }));
console.log(`kept ${out.length} basins, ${out.filter((b) => b.name).length} named: ${[...new Set(out.map((b) => b.name).filter(Boolean))].join(', ')} · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
