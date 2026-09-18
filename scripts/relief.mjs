#!/usr/bin/env node
// relief.mjs — the ground under the study: a hypsometric tint with hillshade,
// rendered in the page's own projection so it lies exactly under the vectors.
//
// Source: Mapzen/Nextzen Terrarium terrain tiles on AWS Open Data
// (s3://elevation-tiles-prod, SRTM/GMTED/ETOPO1 compiled; free with
// attribution). Elevation = R·256 + G + B/256 − 32768. Zoom 8 ≈ 0.6 km/px at
// 40° N. Tiles cache under data/sources/terrain/.
//
// Output: web/data/relief.png (2× the sheet) + studies/<id>/geo/relief.json
// (the hypsometric ramp, for the legend). Sea (elevation ≤ 0) is transparent
// so the bathymetry tints beneath show through.
// Usage: node scripts/relief.mjs studies/iberia/study.json [--zoom=8] [--scale=2]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, encode } from './png.mjs';
import { albers } from './proj.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1]);
const Z = arg('zoom', 8), SCALE = arg('scale', 2);
const W = study.frame.window; const CACHE = join(ROOT, 'data/sources/terrain', String(Z)); mkdirSync(CACHE, { recursive: true });
const N = 2 ** Z, R = Math.PI / 180;
const tx = (lon) => (lon + 180) / 360 * N, ty = (lat) => (1 - Math.log(Math.tan(lat * R) + 1 / Math.cos(lat * R)) / Math.PI) / 2 * N;
const x0 = Math.floor(tx(W.lon[0])), x1 = Math.floor(tx(W.lon[1])), y0 = Math.floor(ty(W.lat[1])), y1 = Math.floor(ty(W.lat[0]));
console.log(`tiles z${Z}: x ${x0}–${x1}, y ${y0}–${y1} = ${(x1 - x0 + 1) * (y1 - y0 + 1)}`);

async function tile(x, y) {
  const f = join(CACHE, `${x}_${y}.png`);
  if (!existsSync(f)) { for (let a = 0; a < 4; a++) { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`); if (r.ok) { writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; } await new Promise((s) => setTimeout(s, 2000)); } }
  return decode(readFileSync(f));
}
async function main() {
  // mosaic of elevations, Float32, in tile-pixel space
  const MW = (x1 - x0 + 1) * 256, MH = (y1 - y0 + 1) * 256; const E = new Float32Array(MW * MH);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const t = await tile(x, y); for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const k = (j * 256 + i) * t.ch; E[((y - y0) * 256 + j) * MW + (x - x0) * 256 + i] = t.data[k] * 256 + t.data[k + 1] + t.data[k + 2] / 256 - 32768; } }
  console.log('mosaic', MW, '×', MH);
  const sample = (lon, lat) => { const px = (tx(lon) - x0) * 256, py = (ty(lat) - y0) * 256; const i = Math.floor(px), j = Math.floor(py); if (i < 0 || j < 0 || i >= MW - 1 || j >= MH - 1) return -1e4; const fx = px - i, fy = py - j; const e = (ii, jj) => E[jj * MW + ii]; return (e(i, j) * (1 - fx) + e(i + 1, j) * fx) * (1 - fy) + (e(i, j + 1) * (1 - fx) + e(i + 1, j + 1) * fx) * fy; };
  // Hypsometric ramp in the atlas's inks: paper at the shore, ochre plains,
  // sepia uplands, pale at the summits. Stops in metres → [r,g,b].
  const RAMP = [[0, [236, 228, 212]], [200, [229, 218, 196]], [500, [218, 202, 172]], [900, [203, 181, 146]], [1400, [181, 152, 116]], [2000, [158, 126, 94]], [2600, [186, 170, 150]], [3500, [230, 226, 220]]];
  const tint = (e) => { if (e <= RAMP[0][0]) return RAMP[0][1]; for (let i = 1; i < RAMP.length; i++) if (e <= RAMP[i][0]) { const [e0, c0] = RAMP[i - 1], [e1, c1] = RAMP[i], t = (e - e0) / (e1 - e0); return c0.map((v, k) => v + (c1[k] - v) * t); } return RAMP[RAMP.length - 1][1]; };
  const { fwd, inv } = albers(W); const OW = 760 * SCALE, OH = 560 * SCALE; const out = Buffer.alloc(OW * OH * 4);
  // hillshade: sun from the north-west, 45° up; gradient from neighbouring page pixels (metres per ~pixel)
  const az = 315 * R, alt = 45 * R; const kmPerPx = 1150 / OW;   // rough ground distance per output pixel
  const elev = new Float32Array(OW * OH);
  for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) { const [lon, lat] = inv([i / SCALE, j / SCALE]); elev[j * OW + i] = sample(lon, lat); }
  for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
    const e = elev[j * OW + i], k = (j * OW + i) * 4;
    if (e <= 0 || e < -9000) { out[k + 3] = 0; continue; }
    const ex = (elev[j * OW + Math.min(OW - 1, i + 1)] - elev[j * OW + Math.max(0, i - 1)]) / (2 * kmPerPx * 1000), ey = (elev[Math.min(OH - 1, j + 1) * OW + i] - elev[Math.max(0, j - 1) * OW + i]) / (2 * kmPerPx * 1000);
    const slope = Math.atan(2.2 * Math.hypot(ex, ey)), aspect = Math.atan2(-ey, ex);   // vertical exaggeration 2.2
    let sh = Math.cos(alt) * Math.sin(slope) * Math.cos(aspect - (az - Math.PI / 2)) + Math.sin(alt) * Math.cos(slope); sh = Math.max(0, Math.min(1, sh));
    const c = tint(e), f = 0.62 + 0.55 * sh;
    out[k] = Math.min(255, c[0] * f); out[k + 1] = Math.min(255, c[1] * f); out[k + 2] = Math.min(255, c[2] * f); out[k + 3] = 255;
  }
  mkdirSync(join(ROOT, 'web/data'), { recursive: true });
  writeFileSync(join(ROOT, 'web/data', study.id + '-relief.png'), encode(OW, OH, out));
  writeFileSync(join(ROOT, 'studies', study.id, 'geo/relief.json'), JSON.stringify({ ramp: RAMP, zoom: Z, scale: SCALE, source: 'Terrarium terrain tiles (Mapzen/Nextzen on AWS Open Data; SRTM, GMTED2010, ETOPO1 and others), hillshade from the north-west, vertical exaggeration 2.2', generated: new Date().toISOString().slice(0, 10) }));
  console.log(`wrote web/data/${study.id}-relief.png ${OW}×${OH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
