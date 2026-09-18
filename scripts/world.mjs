#!/usr/bin/env node
// world.mjs — the globe: every country as plain lon/lat rings (Natural Earth
// 1:50m admin-0, public domain), simplified, with a name and an interior
// anchor. Features sharing an ISO code (Australia's three) are merged — the
// Atlas lost a continent to that once. → web/data/world.js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { polylabel } from './geo.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'data/sources'); mkdirSync(CACHE, { recursive: true });
const f = join(CACHE, 'ne_50m_admin_0_countries.geojson');
if (!existsSync(f)) { const r = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'); writeFileSync(f, await r.text()); }
const g = JSON.parse(readFileSync(f, 'utf8'));
function simplify(ring, tol) { if (ring.length <= 4) return ring; const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1; const st = [[0, ring.length - 1]]; while (st.length) { const [i0, i1] = st.pop(); const [ax, ay] = ring[i0], [bx, by] = ring[i1]; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let dm = 0, im = -1; for (let i = i0 + 1; i < i1; i++) { const [px, py] = ring[i]; let d; if (!l2) d = Math.hypot(px - ax, py - ay); else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); } if (d > dm) { dm = d; im = i; } } if (dm > tol) { keep[im] = 1; st.push([i0, im], [im, i1]); } } return ring.filter((_, i) => keep[i]); }
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [nx, ny] = r[(i + 1) % r.length]; return s + x * ny - nx * y; }, 0) / 2);
const countries = {};
for (const ft of g.features) {
  const p = ft.properties; const cc = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2; if (!cc || cc === '-99') continue;
  const rings = (ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates[0]] : ft.geometry.coordinates.map((x) => x[0])).map((r) => simplify(r, 0.04)).filter((r) => r.length >= 4 && area(r) > 0.02).map((r) => r.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
  if (!rings.length) continue;
  const c = countries[cc] || (countries[cc] = { name: p.NAME_EN || p.NAME, continent: p.CONTINENT, iso3: p.ISO_A3_EH && p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ISO_A3, un: p.UN_A3 && p.UN_A3 !== '-99' ? String(+p.UN_A3) : null, rings: [] }); c.rings.push(...rings);
}
for (const c of Object.values(countries)) {
  const big = c.rings.reduce((a, b) => area(b) > area(a) ? b : a); c.anchor = polylabel(big, 0.05).map((v) => Math.round(v * 100) / 100);
  const bb = (rs) => { let x0 = 180, y0 = 90, x1 = -180, y1 = -90; rs.forEach((r) => r.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })); return [x0, y0, x1, y1]; };
  c.bbox = bb(c.rings);
  // The mainland box: the largest ring plus any ring within 3° of it — so Portugal
  // is Portugal, not the Azores, and Spain does not reach the Canaries unless asked.
  const mb = bb([big]); const near = c.rings.filter((r) => { const b = bb([r]); return b[2] >= mb[0] - 3 && b[0] <= mb[2] + 3 && b[3] >= mb[1] - 3 && b[1] <= mb[3] + 3; });
  c.mainland = bb(near); c.has_far = near.length < c.rings.length;
}
const js = `window.WORLD=${JSON.stringify({ source: 'Natural Earth 1:50m admin-0 (public domain)', countries })};`;
mkdirSync(join(ROOT, 'web/data'), { recursive: true }); writeFileSync(join(ROOT, 'web/data/world.js'), js);
console.log(Object.keys(countries).length, 'countries,', (js.length / 1024).toFixed(0), 'KB');
