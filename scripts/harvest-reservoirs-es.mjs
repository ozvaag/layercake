#!/usr/bin/env node
// harvest-reservoirs-es.mjs — reservoir storage by basin district, Spain, from
// MITECO's Boletín Hidrológico historical database (BD-Embalses.mdb, weekly
// since 1988, every peninsular reservoir over 5 hm³; catalogued on datos.gob.es,
// reuse permitted with attribution). Read with mdb-reader (pure JS).
// Per district (ámbito) per water year: capacity, mean % full over the year,
// % full at the end of September (the low point), the minimum week, and the
// same for the whole set weighted by capacity. → natural/reservoirs.json
// Usage: node scripts/harvest-reservoirs-es.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
if (!study.frame.mask.includes('ES')) { console.log('Spain is not in the mask — MITECO covers Spain only'); process.exit(0); }
const [Y0, Y1] = study.years; const HM = study.hydro_year_start_month || 10;
const DIR = join(ROOT, 'data/sources/miteco'); const MDB = join(DIR, 'BD-Embalses.mdb');
const URL = 'https://www.miteco.gob.es/content/dam/miteco/es/agua/temas/evaluacion-de-los-recursos-hidricos/boletin-hidrologico/Historico-de-embalses/BD-Embalses.zip';
if (!existsSync(MDB)) { mkdirSync(DIR, { recursive: true }); console.log('downloading BD-Embalses.zip (10 MB)…'); const r = await fetch(URL, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('miteco ' + r.status); await new Promise((ok, no) => { const w = createWriteStream(join(DIR, 'BD-Embalses.zip')); r.body.pipeTo(new WritableStream({ write(c) { w.write(c); }, close() { w.end(ok); }, abort: no })); }); execSync(`unzip -qo "${join(DIR, 'BD-Embalses.zip')}" -d "${DIR}"`); }
const MDBReader = (await import('mdb-reader')).default;
const db = new MDBReader(readFileSync(MDB)); const t = db.getTable(db.getTableNames()[0]);
const num = (v) => v == null ? null : Number(String(v).replace(/\./g, '').replace(',', '.'));
const acc = {};   // ambito|year → { cap:Map(res→cap), weeks: [{date, total, actual}] }
for (const r of t.getData()) {
  const d = new Date(r.FECHA); const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1; const wy = HM === 1 ? y : (m >= HM ? y + 1 : y); if (wy < Y0 || wy > Y1) continue;
  const total = num(r.AGUA_TOTAL), actual = num(r.AGUA_ACTUAL); if (!total || actual == null) continue;
  const k = `${r.AMBITO_NOMBRE}|${wy}`; const a = acc[k] || (acc[k] = { ambito: r.AMBITO_NOMBRE, year: wy, byWeek: {} });
  const wk = d.toISOString().slice(0, 10); const w = a.byWeek[wk] || (a.byWeek[wk] = { total: 0, actual: 0, n: 0 }); w.total += total; w.actual += actual; w.n++;
}
const out = { layer: 'reservoirs', kind: 'basin-series', country: 'ES', unit: '% of capacity', water_year: HM === 1 ? 'calendar year' : `starts month ${HM}`, source: { name: 'MITECO — Boletín Hidrológico, base de datos histórica de embalses (BD-Embalses.mdb), weekly since 1988, reservoirs > 5 hm³', url: 'https://datos.gob.es/en/catalogo/e05068001-boletin-hidrologico-semanal', licence: 'datos.gob.es open data (attribution)', fetched_at: new Date().toISOString().slice(0, 10) }, ambitos: {}, all: {} };
const allYears = {};
for (const a of Object.values(acc)) {
  const weeks = Object.entries(a.byWeek).sort(([x], [z]) => x.localeCompare(z)).map(([date, w]) => ({ date, pct: w.actual / w.total * 100, total: w.total, actual: w.actual }));
  if (weeks.length < 20) continue;
  const mean = weeks.reduce((s, w) => s + w.pct, 0) / weeks.length; const min = weeks.reduce((m, w) => w.pct < m.pct ? w : m); const endMonth = HM === 1 ? 12 : HM - 1; const sep = [...weeks].reverse().find((w) => +w.date.slice(5, 7) === endMonth) || weeks[weeks.length - 1]; const cap = Math.round(weeks[weeks.length - 1].total);
  (out.ambitos[a.ambito] = out.ambitos[a.ambito] || {})[a.year] = { cap_hm3: cap, mean_pct: Math.round(mean * 10) / 10, end_pct: Math.round(sep.pct * 10) / 10, min_pct: Math.round(min.pct * 10) / 10, min_week: min.date, weeks: weeks.length };
  const ay = allYears[a.year] || (allYears[a.year] = { cap: 0, meanW: 0, endW: 0 }); ay.cap += cap; ay.meanW += mean * cap; ay.endW += sep.pct * cap;
}
for (const [y, v] of Object.entries(allYears)) out.all[y] = { cap_hm3: Math.round(v.cap), mean_pct: Math.round(v.meanW / v.cap * 10) / 10, end_pct: Math.round(v.endW / v.cap * 10) / 10 };
const f = join(ROOT, 'studies', study.id, 'natural/reservoirs.json'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(out));
console.log(`${Object.keys(out.ambitos).length} districts: ${Object.keys(out.ambitos).join(' · ')}`);
console.log(`all Spain, end of water year % full: ${Object.entries(out.all).map(([y, v]) => y + ':' + v.end_pct).join(' ')}`);
