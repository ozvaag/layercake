// shp.mjs — a minimal ESRI shapefile reader: polylines (type 3/13) and the
// DBF attribute table. Enough for HydroRIVERS; nothing more.
import { readFileSync } from 'node:fs';
export function readShp(path, keep = () => true) {
  const b = readFileSync(path); const type = b.readInt32LE(32); if (type !== 3 && type !== 13) throw new Error('shp: not a polyline file (type ' + type + ')');
  const out = []; let p = 100, idx = 0;
  while (p < b.length) {
    const len = b.readInt32BE(p + 4) * 2; const q = p + 8; const st = b.readInt32LE(q);
    if (st === 3 || st === 13) {
      const bbox = [b.readDoubleLE(q + 4), b.readDoubleLE(q + 12), b.readDoubleLE(q + 20), b.readDoubleLE(q + 28)];
      if (keep(bbox, idx)) { const nParts = b.readInt32LE(q + 36), nPts = b.readInt32LE(q + 40); const parts = []; for (let i = 0; i < nParts; i++) parts.push(b.readInt32LE(q + 44 + i * 4)); const pts = []; const base = q + 44 + nParts * 4; for (let i = 0; i < nPts; i++) pts.push([b.readDoubleLE(base + i * 16), b.readDoubleLE(base + i * 16 + 8)]); const lines = parts.map((s, i) => pts.slice(s, parts[i + 1] ?? nPts)); out.push({ idx, bbox, lines }); }
    }
    p += 8 + len; idx++;
  }
  return out;
}
export function readShpPolygons(path, keep = () => true) {
  const b = readFileSync(path); const type = b.readInt32LE(32); if (type !== 5 && type !== 15) throw new Error('shp: not a polygon file (type ' + type + ')');
  const out = []; let p = 100, idx = 0;
  while (p < b.length) {
    const len = b.readInt32BE(p + 4) * 2; const q = p + 8; const st = b.readInt32LE(q);
    if (st === 5 || st === 15) {
      const bbox = [b.readDoubleLE(q + 4), b.readDoubleLE(q + 12), b.readDoubleLE(q + 20), b.readDoubleLE(q + 28)];
      if (keep(bbox, idx)) { const nParts = b.readInt32LE(q + 36), nPts = b.readInt32LE(q + 40); const parts = []; for (let i = 0; i < nParts; i++) parts.push(b.readInt32LE(q + 44 + i * 4)); const pts = []; const base = q + 44 + nParts * 4; for (let i = 0; i < nPts; i++) pts.push([b.readDoubleLE(base + i * 16), b.readDoubleLE(base + i * 16 + 8)]); out.push({ idx, bbox, rings: parts.map((s, i) => pts.slice(s, parts[i + 1] ?? nPts)) }); }
    }
    p += 8 + len; idx++;
  }
  return out;
}
export function readDbf(path, fields) {
  const b = readFileSync(path); const n = b.readUInt32LE(4), hdr = b.readUInt16LE(8), rec = b.readUInt16LE(10);
  const cols = []; for (let p = 32; b[p] !== 0x0D; p += 32) cols.push({ name: b.toString('latin1', p, p + 11).replace(/\0.*$/, ''), type: String.fromCharCode(b[p + 11]), len: b[p + 16] });
  const want = cols.map((c, i) => ({ ...c, off: cols.slice(0, i).reduce((s, x) => s + x.len, 1) })).filter((c) => !fields || fields.includes(c.name));
  return { n, cols: cols.map((c) => c.name), row: (i) => { const p = hdr + i * rec; const o = {}; for (const c of want) { const s = b.toString('latin1', p + c.off, p + c.off + c.len).trim(); o[c.name] = c.type === 'N' || c.type === 'F' ? Number(s) : s; } return o; } };
}
