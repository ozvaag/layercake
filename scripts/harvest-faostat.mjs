#!/usr/bin/env node
// harvest-faostat.mjs — national harvests anywhere on Earth, from FAOSTAT's
// bulk file (CC BY 4.0; the query API now wants a key, the bulk download
// does not). One 34 MB zip, cached; streamed, never held in memory. Countries
// are matched by their M49 code (Natural Earth's UN_A3, via web/data/world.js).
// Output: food/faostat.json — rows {geo: ISO2, crop: 'fao-<item>', year,
// production_kt, area_kha} in the same shape as the Eurostat reader, national
// only. The build folds them into the study's national series.
// Usage: node scripts/harvest-faostat.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const WORLD = (new Function(readFileSync(join(ROOT, 'web/data/world.js'), 'utf8').replace('window.WORLD=', 'return ')))();
const [Y0, Y1] = study.years;
const ZIP = join(ROOT, 'data/sources/faostat/Production_Crops_Livestock_E_All_Data_(Normalized).zip');
const URL = 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip';
// The crops a study usually wants; add FAO item codes to study.faostat_items to widen.
const ITEMS = study.faostat_items || { 260: 'Olives', 490: 'Oranges', 560: 'Grapes', 15: 'Wheat', 27: 'Rice', 56: 'Maize (corn)', 388: 'Tomatoes', 221: 'Almonds, in shell', 116: 'Potatoes', 44: 'Barley', 156: 'Sugar cane', 157: 'Sugar beet', 515: 'Apples', 495: 'Tangerines, mandarins, clementines', 497: 'Lemons and limes', 403: 'Onions and shallots, dry', 236: 'Soya beans', 267: 'Sunflower seed', 328: 'Seed cotton, unginned', 571: 'Mangoes, guavas and mangosteens', 486: 'Bananas', 656: 'Coffee, green', 661: 'Cocoa beans', 667: 'Tea leaves', 577: 'Dates', 574: 'Pineapples', 449: 'Mushrooms and truffles', 723: 'Spices n.e.c.' };
const ELEM = { 5510: 'production_t', 5312: 'area_ha' };
const m49 = {}; for (const cc of study.frame.mask) { const c = WORLD.countries[cc]; if (!c || !c.un) { console.log(cc, 'has no M49 code in world.js'); continue; } m49[c.un] = cc; }
async function main() {
  if (!existsSync(ZIP)) { mkdirSync(dirname(ZIP), { recursive: true }); console.log('downloading FAOSTAT bulk (34 MB)…'); const r = await fetch(URL); if (!r.ok) throw new Error('faostat ' + r.status); await new Promise((ok, no) => { const w = createWriteStream(ZIP); r.body.pipeTo(new WritableStream({ write(c) { w.write(c); }, close() { w.end(ok); }, abort: no })); }); }
  const proc = spawn('unzip', ['-p', ZIP, '*.csv']); const rl = createInterface({ input: proc.stdout });
  let head = null, idx = {}, n = 0; const rows = {};
  const split = (line) => { const out = []; let cell = '', q = false; for (const ch of line) { if (q) { if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cell); cell = ''; } else cell += ch; } out.push(cell); return out; };
  for await (const line of rl) {
    const c = split(line);
    if (!head) { head = c; head.forEach((h, i) => idx[h] = i); if (idx['Area Code (M49)'] == null) throw new Error('unexpected columns: ' + head.join('|')); continue; }
    const cc = m49[String(+String(c[idx['Area Code (M49)']]).replace(/^'/, ''))]; if (!cc) continue;
    const item = +c[idx['Item Code']]; if (!ITEMS[item]) continue;
    const el = ELEM[+c[idx['Element Code']]]; if (!el) continue;
    const y = +c[idx['Year']]; if (y < Y0 || y > Y1) continue;
    const v = c[idx['Value']] === '' ? null : +c[idx['Value']];
    const k = `${cc}|${item}|${y}`; const r = rows[k] || (rows[k] = { geo: cc, crop: 'fao-' + item, year: y, production_kt: null, area_kha: null });
    if (el === 'production_t' && v != null) r.production_kt = Math.round(v / 100) / 10; if (el === 'area_ha' && v != null) r.area_kha = Math.round(v / 100) / 10; n++;
  }
  const out = { layer: 'faostat', kind: 'marks', national_only: true, unit: { production_kt: 'thousand tonnes', area_kha: 'thousand hectares' }, crops: Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => ['fao-' + k, v])), source: { name: 'FAOSTAT Production: Crops and livestock products (bulk, normalized)', url: 'https://www.fao.org/faostat/en/#data/QCL', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10) }, rows: Object.values(rows).sort((a, b) => a.geo.localeCompare(b.geo) || a.crop.localeCompare(b.crop) || a.year - b.year) };
  const f = join(ROOT, 'studies', study.id, 'food/faostat.json'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(out));
  const per = {}; out.rows.forEach((r) => { if (r.production_kt != null) per[r.crop] = (per[r.crop] || 0) + 1; });
  console.log(`FAOSTAT: ${n} cells → ${out.rows.length} rows for ${Object.values(m49).join(', ')}; crops with data: ${Object.keys(per).length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
