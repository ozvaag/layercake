#!/usr/bin/env node
// harvest-eurostat.mjs — ANY Eurostat dataset as a marks layer, declared in
// the manifest rather than coded:
//   "eurostat": [{ "id": "deaths-summer", "dataset": "demo_r_mwk2_ts",
//                  "filters": { "sex": "T" }, "label": "Deaths, June–August",
//                  "unit": "deaths", "months": [6,7,8], "agg": "sum" }]
// Time may be annual (2005), monthly (2005-07) or ISO-weekly (2005-W28); it is
// folded to the year (ISO weeks by their Thursday), keeping only the months
// listed (all if none), summed or averaged. Regions are whatever geo codes the
// dataset carries for the masked countries; the build resolves them through
// places.json exactly as it does for crops. Output: food/eurostat.json.
// Usage: node scripts/harvest-eurostat.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eurostat } from './eurostat.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const [Y0, Y1] = study.years; const cc = study.frame.mask;
const specs = study.eurostat || []; if (!specs.length) { console.log('no study.eurostat entries'); process.exit(0); }
const yearOf = (t) => { let m = t.match(/^(\d{4})-W(\d{2})$/); if (m) { const y = +m[1], w = +m[2]; const jan4 = new Date(Date.UTC(y, 0, 4)); const thu = new Date(jan4.getTime() + ((w - 1) * 7 - ((jan4.getUTCDay() + 6) % 7) + 3) * 864e5); return [thu.getUTCFullYear(), thu.getUTCMonth() + 1]; } m = t.match(/^(\d{4})-(\d{2})$/); if (m) return [+m[1], +m[2]]; m = t.match(/^(\d{4})$/); if (m) return [+m[1], null]; return [null, null]; };
const out = { layer: 'eurostat', kind: 'marks', series: {}, rows: [], source: { name: 'Eurostat (dissemination API)', url: 'https://ec.europa.eu/eurostat/data/database', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10), datasets: [] } };
for (const sp of specs) {
  const acc = {}; let cells = 0, updated = null;
  // The whole dataset is too many cells for one answer (413); list the geos with
  // a one-period probe, then fetch each region's full series on its own.
  let geos = []; try { const probe = await eurostat(sp.dataset, { ...(sp.filters || {}), time: sp.probe_time || `${Y1 - 1}-W20` }); geos = Object.keys(probe.meta.dimension.geo.category.label).filter((g) => cc.some((c) => g.startsWith(c)) && (sp.geo_length ? g.length === sp.geo_length : g.length === 4 || g.length === 2)); } catch (e) { try { const probe = await eurostat(sp.dataset, { ...(sp.filters || {}), time: String(Y1 - 1) }); geos = Object.keys(probe.meta.dimension.geo.category.label).filter((g) => cc.some((c) => g.startsWith(c)) && (g.length === 4 || g.length === 2)); } catch (e2) { console.log(sp.id, 'probe failed:', e2.message.slice(0, 120)); } }
  for (const g of geos) {
    let rows; try { const r = await eurostat(sp.dataset, { ...(sp.filters || {}), geo: g }); rows = r.rows; updated = r.meta.updated; } catch (e) { console.log(sp.id, g, 'failed:', e.message.slice(0, 80)); continue; }
    for (const r of rows) { const [y, mo] = yearOf(r.time); if (y == null || y < Y0 || y > Y1) continue; if (sp.months && mo != null && !sp.months.includes(mo)) continue; const k = `${r.geo}|${y}`; const a = acc[k] || (acc[k] = { geo: r.geo, name: r.geo_label, year: y, sum: 0, n: 0 }); if (r.value != null) { a.sum += r.value; a.n++; cells++; } }
    await new Promise((res) => setTimeout(res, 120));
  }
  const scale = sp.scale || 1;
  for (const a of Object.values(acc)) { if (!a.n) continue; if (sp.min_n && a.n < sp.min_n) continue; out.rows.push({ geo: a.geo, name: a.name, crop: sp.id, year: a.year, production_kt: Math.round(((sp.agg === 'mean' ? a.sum / a.n : a.sum) * scale) * 100) / 100, area_kha: null, n: a.n }); }
  out.series[sp.id] = { label: sp.label || sp.id, unit: sp.unit || '', dataset: sp.dataset, filters: sp.filters || {}, months: sp.months || null, agg: sp.agg || 'sum' };
  out.source.datasets.push({ dataset: sp.dataset, updated });
  console.log(`${sp.id}: ${sp.dataset} → ${out.rows.filter((r) => r.crop === sp.id).length} region-years from ${cells} cells`);
}
const f = join(ROOT, 'studies', study.id, 'food/eurostat.json'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(out));
console.log(`wrote ${out.rows.length} rows, ${Object.keys(out.series).length} series`);
