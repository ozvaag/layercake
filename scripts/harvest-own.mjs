#!/usr/bin/env node
// harvest-own.mjs — your own data, in the study's shapes. Reads CSV files
// from studies/<id>/own/ and writes JSON the build understands:
//   marks.csv   place,name,lat,lon,series,year,value[,unit]   → own/marks.json
//   series.csv  series,year,value[,unit][,label]              → own/series.json
//   events.csv  id,date,title,citation,source_url,lat,lon,scope,kind,summary → own/events.json
// A header row is required; commas inside quotes are fine; blank cells are null.
// Usage: node scripts/harvest-own.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const DIR = join(ROOT, 'studies', study.id, 'own');

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((v) => v.trim() !== '')).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim() === '' ? null : r[i].trim()])));
}
const num = (v) => v == null ? null : Number(String(v).replace(/[ ,]/g, '')) ;
const need = (rows, cols, f) => { const miss = cols.filter((c) => !(c in rows[0])); if (miss.length) throw new Error(`${f}: missing column(s) ${miss.join(', ')}`); };
let did = 0;
if (existsSync(join(DIR, 'marks.csv'))) {
  const rows = parseCsv(readFileSync(join(DIR, 'marks.csv'), 'utf8')); need(rows, ['place', 'lat', 'lon', 'year', 'value'], 'marks.csv');
  const places = {}, series = {}, out = [];
  for (const r of rows) { const s = r.series || 'value'; places[r.place] = { name: r.name || r.place, lat: num(r.lat), lon: num(r.lon) }; series[s] = { label: r.label || s, unit: r.unit || '' }; out.push({ place: r.place, series: s, year: +r.year, value: num(r.value) }); }
  writeFileSync(join(DIR, 'marks.json'), JSON.stringify({ layer: 'own-marks', kind: 'marks', places, series, rows: out, source: { name: 'own data (marks.csv)', fetched_at: new Date().toISOString().slice(0, 10) } }));
  console.log(`marks: ${out.length} rows · ${Object.keys(places).length} places · ${Object.keys(series).length} series`); did++;
}
if (existsSync(join(DIR, 'series.csv'))) {
  const rows = parseCsv(readFileSync(join(DIR, 'series.csv'), 'utf8')); need(rows, ['series', 'year', 'value'], 'series.csv');
  const series = {};
  for (const r of rows) { const s = series[r.series] || (series[r.series] = { id: r.series, label: r.label || r.series, unit: r.unit || '', values: {} }); s.values[+r.year] = num(r.value); }
  writeFileSync(join(DIR, 'series.json'), JSON.stringify({ layer: 'own-series', kind: 'series', series: Object.values(series), source: { name: 'own data (series.csv)', fetched_at: new Date().toISOString().slice(0, 10) } }));
  console.log(`series: ${Object.keys(series).length} series, ${rows.length} rows`); did++;
}
if (existsSync(join(DIR, 'events.csv'))) {
  const rows = parseCsv(readFileSync(join(DIR, 'events.csv'), 'utf8')); need(rows, ['id', 'date', 'title', 'citation'], 'events.csv');
  const instruments = rows.map((r) => ({ id: r.id, date: r.date, country: r.country || (study.frame.mask[0] || 'XX'), kind: r.kind || 'event', title: r.title, citation: r.citation, summary: r.summary || '', scope: { regions: r.scope ? r.scope.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : ['all'], basins: [] }, lat: num(r.lat), lon: num(r.lon), source_url: r.source_url || null, confidence: r.confidence || 'recalled', verified_at: null, own: true }));
  writeFileSync(join(DIR, 'events.json'), JSON.stringify({ layer: 'own-events', kind: 'events', kinds: { event: 'your own dated events' }, instruments, source: { name: 'own data (events.csv)', fetched_at: new Date().toISOString().slice(0, 10) } }));
  console.log(`events: ${instruments.length}`); did++;
}
if (!did) console.log(`nothing in ${DIR} — expected marks.csv, series.csv or events.csv`);
