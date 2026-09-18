#!/usr/bin/env node
// geo.mjs — the frame of a study, from Natural Earth (public domain).
//
// A study declares a WINDOW (lon/lat) and a MASK (the admin-0 codes whose
// mainland rings make the landmass under study). Political lines are never
// drawn: the sheet shows land, coast and rivers only. Borders exist here for
// one purpose — to know which land is inside the study (grid points, marks).
//
// Output: web/data/geo.js → window.STUDY_GEO = {window, land, coast, rivers,
// lakes, mask, admin1}. All rings are plain [lon,lat] arrays, projected in the
// browser (the Atlas's pattern — geometry is data, not a tile service).
//
// Usage: node scripts/geo.mjs studies/iberia/study.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const CACHE = join(ROOT, 'data/sources');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const { window: W, mask: MASK, admin1_countries: A1 = [] } = study.frame;

async function ne(name) {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, name + '.geojson');
  if (!existsSync(f)) {
    console.log('fetching', name);
    const r = await fetch(NE + name + '.geojson'); if (!r.ok) throw new Error(name + ' ' + r.status);
    writeFileSync(f, await r.text());
  }
  return JSON.parse(readFileSync(f, 'utf8'));
}

// ── clipping (Sutherland–Hodgman) and simplification (Douglas–Peucker), from the Atlas ──
function clipRing(ring, { lon: [x0, x1], lat: [y0, y1] }) {
  const edges = [(p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1];
  const cross = [
    (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])],
    (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1],
  ];
  let out = ring;
  for (let e = 0; e < 4; e++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ain = edges[e](a), bin = edges[e](b);
      if (ain) { out.push(a); if (!bin) out.push(cross[e](a, b)); } else if (bin) out.push(cross[e](a, b));
    }
    if (out.length < 3) return null;
  }
  return out;
}
const inWin = (p) => p[0] >= W.lon[0] && p[0] <= W.lon[1] && p[1] >= W.lat[0] && p[1] <= W.lat[1];
// Clip a LINE to the window: split into runs of inside points (good enough for hairlines).
function clipLine(line) {
  const runs = []; let cur = [];
  for (const p of line) { if (inWin(p)) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length > 1);
}
function simplify(ring, tol) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop(); const [ax, ay] = ring[i0], [bx, by] = ring[i1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy; let dmax = 0, imax = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = ring[i]; let d;
      if (!len2) d = Math.hypot(px - ax, py - ay);
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)); d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
      if (d > dmax) { dmax = d; imax = i; }
    }
    if (dmax > tol) { keep[imax] = 1; stack.push([i0, imax], [imax, i1]); }
  }
  return ring.filter((_, i) => keep[i]);
}
const ringArea = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [nx, ny] = r[(i + 1) % r.length]; return s + x * ny - nx * y; }, 0) / 2);
const rings = (g) => g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];
const lines = (g) => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

// ── pole of inaccessibility (polylabel), for placing a region's mark ──
const segDist2 = (px, py, ax, ay, bx, by) => { let dx = bx - ax, dy = by - ay; if (dx || dy) { const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy); if (t > 1) { ax = bx; ay = by; } else if (t > 0) { ax += dx * t; ay += dy * t; } } dx = px - ax; dy = py - ay; return dx * dx + dy * dy; };
function pointToRing(px, py, ring) {
  let inside = false, d2 = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
    d2 = Math.min(d2, segDist2(px, py, ax, ay, bx, by));
  }
  return (inside ? 1 : -1) * Math.sqrt(d2);
}
export function polylabel(ring, precision = 0.01) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const w = maxX - minX, h = maxY - minY, size = Math.min(w, h); if (!size) return [minX, minY];
  let cell = size / 2; const cells = [];
  const mk = (x, y, hh) => { const d = pointToRing(x, y, ring); return { x, y, h: hh, d, max: d + hh * Math.SQRT2 }; };
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) cells.push(mk(x + cell, y + cell, cell));
  let best = mk(minX + w / 2, minY + h / 2, 0);
  while (cells.length) {
    cells.sort((a, b) => a.max - b.max); const c = cells.pop();
    if (c.d > best.d) best = c; if (c.max - best.d <= precision) continue;
    const hh = c.h / 2; cells.push(mk(c.x - hh, c.y - hh, hh), mk(c.x + hh, c.y - hh, hh), mk(c.x - hh, c.y + hh, hh), mk(c.x + hh, c.y + hh, hh));
  }
  return [best.x, best.y];
}
export const pointInRings = (p, rs) => rs.some((r) => pointToRing(p[0], p[1], r) > 0);

async function main() {
  const [land, coast, rivers, lakes, admin0, admin1, riversEU, lakesEU, bK, bJ, bI, peaks] = await Promise.all([
    ne('ne_10m_land'), ne('ne_10m_coastline'), ne('ne_10m_rivers_lake_centerlines'), ne('ne_10m_lakes'), ne('ne_10m_admin_0_countries'), ne('ne_10m_admin_1_states_provinces'),
    ne('ne_10m_rivers_europe'), ne('ne_10m_lakes_europe'), ne('ne_10m_bathymetry_K_200'), ne('ne_10m_bathymetry_J_1000'), ne('ne_10m_bathymetry_I_2000'), ne('ne_10m_geography_regions_elevation_points'),
  ]);
  const TOL = 0.004;
  const out = { window: W, generated: new Date().toISOString().slice(0, 10), source: 'Natural Earth 1:10m (public domain)' };
  out.land = land.features.flatMap((f) => rings(f.geometry)).map((r) => clipRing(r, W)).filter(Boolean).map((r) => simplify(r, TOL)).filter((r) => ringArea(r) > 0.002).map((r) => r.map(r4));
  out.coast = coast.features.flatMap((f) => lines(f.geometry)).flatMap(clipLine).map((l) => simplify(l, TOL)).filter((l) => l.length > 2).map((l) => l.map(r4));
  // Rivers: only those that run through the masked land — the window also holds
  // the Garonne, which is not the study's.
  const maskRings = () => Object.values(out.mask);
  out.rivers = rivers.features.filter((f) => (f.properties.scalerank ?? 9) <= (study.frame.river_scalerank ?? 8)).flatMap((f) => lines(f.geometry).flatMap(clipLine).map((l) => ({ name: f.properties.name_en || f.properties.name || '', rank: f.properties.scalerank, pts: simplify(l, TOL).map(r4) }))).filter((l) => l.pts.length > 1);
  out.lakes = lakes.features.flatMap((f) => rings(f.geometry).map((r) => ({ name: f.properties.name || '', ring: clipRing(r, W) }))).filter((l) => l.ring).map((l) => ({ name: l.name, ring: simplify(l.ring, TOL / 2).map(r4) })).filter((l) => ringArea(l.ring) > 0.0005);
  // The MASK: the mainland ring of each masked country (largest ring in window).
  out.mask = {};
  for (const f of admin0.features) {
    const cc = f.properties.ISO_A2_EH || f.properties.ISO_A2; if (!MASK.includes(cc)) continue;
    const rs = rings(f.geometry).map((r) => clipRing(r, W)).filter(Boolean).sort((a, b) => ringArea(b) - ringArea(a));
    if (rs[0]) out.mask[cc] = simplify(rs[0], TOL).map(r4);
  }
  out.rivers = out.rivers.filter((l) => l.pts.some((p) => pointInRings(p, maskRings())));
  // Named rivers for labels: base + Europe supplement, the longest in-window
  // line per name that touches the land, laid west→east so text reads forward.
  const NAME_FIX = { Zncara: 'Záncara', Tagus: 'Tejo', Mio: 'Miño' };
  const named = {};
  for (const f of [...rivers.features, ...riversEU.features]) {
    if (f.properties.featurecla && /Lake Centerline/.test(f.properties.featurecla)) continue;
    let nm = f.properties.name_en || f.properties.name || ''; nm = NAME_FIX[nm] || nm; nm = nm.charAt(0).toUpperCase() + nm.slice(1); if (!nm || nm === '?') continue;
    for (const l of lines(f.geometry).flatMap(clipLine)) { if (l.filter((p) => pointInRings(p, maskRings())).length < l.length * 0.6) continue; const sl = simplify(l, TOL).map(r4); if (!named[nm] || sl.length > named[nm].pts.length) named[nm] = { name: nm, rank: f.properties.scalerank, pts: sl }; }
  }
  out.named_rivers = Object.values(named).map((r) => ({ ...r, pts: r.pts[0][0] > r.pts[r.pts.length - 1][0] ? [...r.pts].reverse() : r.pts }));
  // The full network (HydroRIVERS) is built by scripts/hydro.mjs into geo/rivers.json; the page draws both.
  out.lakes.push(...lakesEU.features.flatMap((f) => rings(f.geometry).map((r) => ({ name: f.properties.name || '', ring: clipRing(r, W) }))).filter((l) => l.ring).map((l) => ({ name: l.name, ring: simplify(l.ring, TOL / 2).map(r4) })).filter((l) => ringArea(l.ring) > 0.0003));
  // Bathymetry tints: each Natural Earth file is the area DEEPER than its depth.
  out.bathy = {};
  for (const [k, g] of [['200', bK], ['1000', bJ], ['2000', bI]]) out.bathy[k] = g.features.flatMap((f) => rings(f.geometry)).map((r) => clipRing(r, W)).filter(Boolean).map((r) => simplify(r, TOL * 2).map(r4)).filter((r) => ringArea(r) > 0.01);
  // Peaks with a surveyed elevation (Natural Earth), inside the land.
  out.peaks = peaks.features.filter((f) => f.geometry && inWin(f.geometry.coordinates) && pointInRings(f.geometry.coordinates, maskRings())).map((f) => ({ name: f.properties.name, elev: f.properties.elevation, lon: r4(f.geometry.coordinates)[0], lat: r4(f.geometry.coordinates)[1] }));
  // Admin-1 interior points: where a region's mark sits. Not drawn as lines.
  out.admin1 = {};
  for (const f of admin1.features) {
    const cc = f.properties.iso_a2; if (!A1.includes(cc)) continue;
    const code = f.properties.iso_3166_2; if (!code) continue;
    const rs = rings(f.geometry).map((r) => clipRing(r, W)).filter(Boolean).sort((a, b) => ringArea(b) - ringArea(a));
    if (!rs[0]) continue;
    out.admin1[code] = { name: f.properties.name, region: f.properties.region || null, region_code: f.properties.region_cod || null, type: f.properties.type_en || null, label: polylabel(rs[0]).map((v) => Math.round(v * 1e3) / 1e3), area: Math.round(ringArea(rs[0]) * 1e4) / 1e4 };
  }
  const dir = join(ROOT, 'studies', study.id); mkdirSync(join(dir, 'geo'), { recursive: true });
  writeFileSync(join(dir, 'geo/frame.json'), JSON.stringify(out));
  console.log(`named rivers ${out.named_rivers.length} · bathy ${Object.values(out.bathy).map((b) => b.length).join('/')} · peaks ${out.peaks.length}`);
  console.log(`land ${out.land.length} rings · coast ${out.coast.length} · rivers ${out.rivers.length} · lakes ${out.lakes.length} · mask ${Object.keys(out.mask).join(',')} · admin1 ${Object.keys(out.admin1).length}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
