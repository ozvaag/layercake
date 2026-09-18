#!/usr/bin/env node
// build.mjs — compile a study into the bundle the engine renders.
//   studies/<id>/study.json + geo/frame.json + the layer files
//   → web/data/<id>.js  (window.STUDY = {...})
// Validates on the way: an instrument without a date, citation or confidence
// fails the build; a scope naming a place that does not exist fails; a layer
// file the manifest names but that is missing fails. A build that passes is a
// study every number of which can be traced to a source line.
// Usage: node scripts/build.mjs studies/iberia/study.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const studyPath = process.argv[2] || join(ROOT, 'studies/iberia/study.json');
const study = JSON.parse(readFileSync(studyPath, 'utf8'));
const DIR = join(ROOT, 'studies', study.id);
const errors = [], warnings = [];
const need = (f) => { const p = join(DIR, f); if (!existsSync(p)) { errors.push(`missing ${f}`); return null; } return JSON.parse(readFileSync(p, 'utf8')); };

const geo = need('geo/frame.json');
const placesFile = need('places.json');
const layers = {};
for (const L of study.layers) { const d = need(L.file); if (d) layers[L.id] = { manifest: L, data: d }; }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ── places: interior points from admin-1 poles, area-weighted ──
const places = {};
for (const [code, p] of Object.entries(placesFile.places)) {
  let sx = 0, sy = 0, sa = 0;
  for (const u of p.units) { const a1 = geo.admin1[u]; if (!a1) { errors.push(`place ${code}: admin-1 unit ${u} not in frame`); continue; } sx += a1.label[0] * a1.area; sy += a1.label[1] * a1.area; sa += a1.area; }
  places[code] = { code, name: p.name, country: p.country, lon: Math.round(sx / sa * 1e3) / 1e3, lat: Math.round(sy / sa * 1e3) / 1e3, area: Math.round(sa * 1e3) / 1e3 };
}
const alias = placesFile.aliases || {};
const resolvePlace = (g) => places[g] ? g : alias[g] && places[alias[g]] ? alias[g] : null;

// ── events (policy) ──
const pol = layers.policy?.data;
const events = [];
if (pol) for (const i of pol.instruments) {
  for (const k of ['id', 'date', 'title', 'citation', 'confidence', 'kind', 'country']) if (!i[k]) errors.push(`instrument ${i.id || '?'}: no ${k}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date || '')) errors.push(`instrument ${i.id}: date not ISO`);
  if (!['recalled', 'cited', 'read'].includes(i.confidence)) errors.push(`instrument ${i.id}: confidence "${i.confidence}"`);
  if (!pol.kinds[i.kind]) errors.push(`instrument ${i.id}: kind "${i.kind}" not declared`);
  const regs = (i.scope?.regions || []);
  const bad = regs.filter((r) => r !== 'all' && !places[r]); if (bad.length) errors.push(`instrument ${i.id}: scope names unknown place(s) ${bad.join(',')}`);
  if (!i.source_url) warnings.push(`instrument ${i.id}: no source_url (${i.note || 'no note'})`);
  events.push({ ...i, year: +i.date.slice(0, 4) });
}
events.sort((a, b) => a.date.localeCompare(b.date));

// ── marks (crops by place) and national series ──
const crops = layers.crops?.data;
const marks = {}, national = {}; let dropped = 0, folded = 0;
if (crops) for (const r of crops.rows) {
  if (placesFile.national[r.geo]) { (national[r.geo] = national[r.geo] || {})[r.crop] = national[r.geo][r.crop] || {}; national[r.geo][r.crop][r.year] = { p: r.production_kt ?? null, a: r.area_kha ?? null }; continue; }
  const pl = resolvePlace(r.geo); if (!pl) { dropped++; continue; }
  if (pl !== r.geo) folded++;
  const m = (marks[pl] = marks[pl] || {}); const c = (m[r.crop] = m[r.crop] || {});
  const cur = c[r.year] || { p: null, a: null };
  c[r.year] = { p: r.production_kt == null ? cur.p : (cur.p ?? 0) + r.production_kt, a: r.area_kha == null ? cur.a : (cur.a ?? 0) + r.area_kha };
}
// Which crops have a REGIONAL series at all (Eurostat carries olives, citrus,
// grapes, fruit and vegetables at national level only for ES/PT).
const regionalCrops = new Set(); Object.values(marks).forEach((m) => Object.entries(m).forEach(([c, ys]) => { if (Object.values(ys).some((v) => v.p != null)) regionalCrops.add(c); }));

// ── field ──
const clim = layers.rain?.data;
const field = clim ? { step: clim.step, columns: clim.columns, normal_period: clim.normal_period, hydro_year: clim.hydro_year, et0_method: clim.et0_method, source: clim.source, points: clim.points.map((p) => ({ lon: p.lon, lat: p.lat, n: p.normal, hy: p.hy })) } : null;
if (field && !field.points.length) errors.push('field has no points');
// Assign each grid point to the nearest place interior point — the honest
// approximation for "this region's rain" without region polygons on the sheet.
if (field) for (const p of field.points) { let best = null, bd = 1e9; for (const pl of Object.values(places)) { const d = Math.hypot((p.lon - pl.lon) * Math.cos(p.lat * Math.PI / 180), p.lat - pl.lat); if (d < bd) { bd = d; best = pl.code; } } p.place = best; }

// ── readings: peninsula-wide figures the cartouche prints, from the data ──
const [Y0, Y1] = study.years;
const readings = { years: {} };
if (field) for (let y = Y0; y <= Y1; y++) {
  const rows = field.points.filter((p) => p.hy[y] && p.n); if (!rows.length) continue;
  const mean = (i) => rows.reduce((s, p) => s + p.hy[y][i], 0) / rows.length;
  const meanN = (i) => rows.reduce((s, p) => s + p.n[i], 0) / rows.length;
  readings.years[y] = { P: Math.round(mean(0)), P_pct: Math.round(mean(0) / meanN(0) * 100), ET0: Math.round(mean(1)), bal: Math.round(mean(0) - mean(1)), bal_n: Math.round(meanN(0) - meanN(1)), D35: Math.round(mean(2) * 10) / 10, D35_n: Math.round(meanN(2) * 10) / 10, TM: Math.round(mean(4) * 10) / 10, TM_n: Math.round(meanN(4) * 10) / 10, n: rows.length };
}
const ys = Object.entries(readings.years);
if (ys.length) {
  readings.driest = ys.reduce((a, b) => b[1].P_pct < a[1].P_pct ? b : a)[0];
  readings.wettest = ys.reduce((a, b) => b[1].P_pct > a[1].P_pct ? b : a)[0];
  readings.hottest = ys.reduce((a, b) => b[1].D35 > a[1].D35 ? b : a)[0];
}

const trade = layers.trade?.data;

if (errors.length) { console.error('BUILD FAILED\n' + errors.join('\n')); process.exit(1); }
warnings.forEach((w) => console.warn('warn:', w));

const bundle = {
  id: study.id, title: study.title, subtitle: study.subtitle, years: study.years, normal: study.normal, built: new Date().toISOString().slice(0, 10),
  layers: study.layers.map((L) => ({ id: L.id, kind: L.kind, ink: L.ink, label: L.label, unit: L.unit })),
  places, national_names: placesFile.national, place_note: placesFile.note,
  field, marks, national, regional_crops: [...regionalCrops], crop_names: crops?.crops || {}, crop_source: crops?.source || null,
  trade: trade ? { products: trade.products, prices: trade.prices, sources: trade.sources, trade: trade.trade, price: trade.price } : null,
  events, event_kinds: pol?.kinds || {}, confidence_tiers: pol?.confidence_tiers || {}, readings,
};
mkdirSync(join(ROOT, 'web/data'), { recursive: true });
const js = `// ${study.title} — © ${new Date().getFullYear()} Ozvåag LLC. Sources are named inside; every figure carries its origin.\nwindow.STUDY=${JSON.stringify(bundle)};`;
writeFileSync(join(ROOT, 'web/data', study.id + '.js'), js);
const geoJs = `window.STUDY_GEO=${JSON.stringify({ window: geo.window, land: geo.land, coast: geo.coast, rivers: geo.rivers, lakes: geo.lakes, source: geo.source })};`;
writeFileSync(join(ROOT, 'web/data/geo.js'), geoJs);
// Hash-stamp the asset URLs in index.html (the Atlas's rule: CF's browser-cache TTL outlives a deploy).
const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const idx = join(ROOT, 'web/index.html');
if (existsSync(idx)) {
  let html = readFileSync(idx, 'utf8');
  html = html.replace(/data\/geo\.js(\?v=[0-9a-f]+)?/g, `data/geo.js?v=${h(geoJs)}`).replace(new RegExp(`data/${study.id}\\.js(\\?v=[0-9a-f]+)?`, 'g'), `data/${study.id}.js?v=${h(js)}`).replace(/atlas\.css(\?v=[0-9a-f]+)?/g, `atlas.css?v=${h(readFileSync(join(ROOT, 'web/atlas.css'), 'utf8'))}`);
  writeFileSync(idx, html);
}
console.log(`built ${study.id}: ${Object.keys(places).length} places · field ${field ? field.points.length : 0} pts · marks ${Object.keys(marks).length} places × ${regionalCrops.size} regional crops (${folded} rows folded by alias, ${dropped} dropped: islands/NUTS-1/extra-regio) · events ${events.length} · trade ${trade ? trade.trade.length : 0} · ${(js.length / 1024).toFixed(0)} KB`);
if (readings.driest) console.log(`readings: driest ${readings.driest} (${readings.years[readings.driest].P_pct}% of normal) · wettest ${readings.wettest} (${readings.years[readings.wettest].P_pct}%) · most ≥35° days ${readings.hottest} (${readings.years[readings.hottest].D35}/pt)`);
