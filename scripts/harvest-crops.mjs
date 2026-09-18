#!/usr/bin/env node
// harvest-crops.mjs — the harvest layer: crop production and area by NUTS-2
// region, from Eurostat apro_cpshr (CC BY 4.0). One request per crop; every
// region of the study's countries; the raw Eurostat codes are kept and the
// study's place map (study.json → places) resolves recodes at build time.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eurostat } from './eurostat.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const [Y0, Y1] = study.years;
const CROPS = { O1000: 'Olives', T0000: 'Citrus fruits', W1000: 'Grapes', C0000: 'Cereals (grain)', C1100: 'Wheat and spelt', C1500: 'Grain maize', C2000: 'Rice', F0000: 'Fruits, berries and nuts (excl. citrus, grapes, strawberries)', 'V0000_S0000': 'Fresh vegetables and strawberries', I1120: 'Sunflower seed', R1000: 'Potatoes' };
const STRUC = { HPRD_HUMD_EU_THS_T: 'production_kt', AR_THS_HA: 'area_kha' };
const years = []; for (let y = Y0; y <= Y1; y++) years.push(String(y));
const cc = study.frame.mask;

async function main() {
  const out = { layer: 'crops', kind: 'marks', unit: { production_kt: 'thousand tonnes (EU standard humidity)', area_kha: 'thousand hectares' }, crops: CROPS, source: { name: 'Eurostat apro_cpshr — Crop production in EU standard humidity by NUTS 2 region', url: 'https://ec.europa.eu/eurostat/databrowser/view/apro_cpshr/', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10), updated: null }, rows: [] };
  for (const crop of Object.keys(CROPS)) {
    const { rows, meta } = await eurostat('apro_cpshr', { crops: crop, strucpro: Object.keys(STRUC), time: years });
    out.source.updated = meta.updated;
    let n = 0;
    for (const r of rows) {
      if (!cc.some((c) => r.geo.startsWith(c))) continue;
      out.rows.push({ geo: r.geo, name: r.geo_label, crop, year: +r.time, [STRUC[r.strucpro]]: r.value }); n++;
    }
    console.log(crop, CROPS[crop], n, 'cells');
  }
  // fold production+area cells into one row per geo×crop×year
  const key = (r) => `${r.geo}|${r.crop}|${r.year}`; const m = new Map();
  for (const r of out.rows) { const k = key(r); m.set(k, Object.assign(m.get(k) || {}, r)); }
  out.rows = [...m.values()].sort((a, b) => a.geo.localeCompare(b.geo) || a.crop.localeCompare(b.crop) || a.year - b.year);
  const f = join(ROOT, 'studies', study.id, 'food/crops.json'); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(out));
  const geos = [...new Set(out.rows.map((r) => r.geo))];
  console.log(`wrote ${out.rows.length} rows, ${geos.length} geos: ${geos.join(' ')}`);
  // year coverage per PT code — the NUTS recode question
  for (const g of geos.filter((g) => g.startsWith('PT'))) { const ys = out.rows.filter((r) => r.geo === g && r.production_kt != null).map((r) => r.year); console.log(g, ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '—'); }
}
main().catch((e) => { console.error(e); process.exit(1); });
