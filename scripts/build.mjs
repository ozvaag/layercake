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
import { polylabel } from './geo.mjs';

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
  if (p.lon != null && p.lat != null) { places[code] = { code, name: p.name, country: p.country || null, lon: p.lon, lat: p.lat, area: 0 }; continue; }
  let sx = 0, sy = 0, sa = 0;
  for (const u of p.units) { const a1 = geo.admin1[u]; if (!a1) { errors.push(`place ${code}: admin-1 unit ${u} not in frame`); continue; } sx += a1.label[0] * a1.area; sy += a1.label[1] * a1.area; sa += a1.area; }
  places[code] = { code, name: p.name, country: p.country, lon: Math.round(sx / sa * 1e3) / 1e3, lat: Math.round(sy / sa * 1e3) / 1e3, area: Math.round(sa * 1e3) / 1e3 };
}
const alias = placesFile.aliases || {};
const resolvePlace = (g) => places[g] ? g : alias[g] && places[alias[g]] ? alias[g] : null;

// ── generic Eurostat marks (scripts/harvest-eurostat.mjs) ──
const eus = existsSync(join(DIR, 'food/eurostat.json')) ? JSON.parse(readFileSync(join(DIR, 'food/eurostat.json'), 'utf8')) : null;

// ── FAOSTAT (national only) and World Bank (series) ──
const fao = existsSync(join(DIR, 'food/faostat.json')) ? JSON.parse(readFileSync(join(DIR, 'food/faostat.json'), 'utf8')) : null;
const wb = existsSync(join(DIR, 'series/worldbank.json')) ? JSON.parse(readFileSync(join(DIR, 'series/worldbank.json'), 'utf8')) : null;

// ── own data (scripts/harvest-own.mjs) ──
const ownMarks = existsSync(join(DIR, 'own/marks.json')) ? JSON.parse(readFileSync(join(DIR, 'own/marks.json'), 'utf8')) : null;
const ownSeries = existsSync(join(DIR, 'own/series.json')) ? JSON.parse(readFileSync(join(DIR, 'own/series.json'), 'utf8')) : null;
const ownEvents = existsSync(join(DIR, 'own/events.json')) ? JSON.parse(readFileSync(join(DIR, 'own/events.json'), 'utf8')) : null;
if (ownMarks) for (const [code, p] of Object.entries(ownMarks.places)) { if (p.lat == null || p.lon == null) { errors.push(`own marks: place ${code} has no lat/lon`); continue; } places[code] = places[code] || { code, name: p.name, country: null, lon: p.lon, lat: p.lat, area: 0, own: true }; }

// ── events (policy) ──
const pol = layers.policy?.data;
const events = [];
const allInstruments = [...(pol ? pol.instruments : []), ...(ownEvents ? ownEvents.instruments : [])];
const kinds = { ...(pol?.kinds || {}), ...(ownEvents?.kinds || {}) };
for (const i of allInstruments) {
  for (const k of ['id', 'date', 'title', 'citation', 'confidence', 'kind', 'country']) if (!i[k]) errors.push(`instrument ${i.id || '?'}: no ${k}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date || '')) errors.push(`instrument ${i.id}: date not ISO`);
  if (!['recalled', 'cited', 'read'].includes(i.confidence)) errors.push(`instrument ${i.id}: confidence "${i.confidence}"`);
  if (!kinds[i.kind]) errors.push(`instrument ${i.id}: kind "${i.kind}" not declared`);
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
const cropNames = { ...(crops?.crops || {}) }; const markUnits = {};
if (fao) { for (const r of fao.rows) { (national[r.geo] = national[r.geo] || {})[r.crop] = national[r.geo][r.crop] || {}; national[r.geo][r.crop][r.year] = { p: r.production_kt ?? null, a: r.area_kha ?? null }; } for (const [c, n] of Object.entries(fao.crops)) { if (fao.rows.some((r) => r.crop === c && r.production_kt != null)) { cropNames[c] = n + ' — FAOSTAT'; markUnits[c] = 'kt'; } } }
if (eus) { let f2 = 0, d2 = 0; for (const r of eus.rows) { if (placesFile.national[r.geo]) { (national[r.geo] = national[r.geo] || {})[r.crop] = national[r.geo][r.crop] || {}; national[r.geo][r.crop][r.year] = { p: r.production_kt, a: null }; continue; } const pl = resolvePlace(r.geo); if (!pl) { d2++; continue; } if (pl !== r.geo) f2++; const m = (marks[pl] = marks[pl] || {}); const c = (m[r.crop] = m[r.crop] || {}); const cur = c[r.year] || { p: null, a: null }; c[r.year] = { p: r.production_kt == null ? cur.p : (cur.p ?? 0) + r.production_kt, a: null }; regionalCrops.add(r.crop); } for (const [id, sdef] of Object.entries(eus.series)) { cropNames[id] = sdef.label; markUnits[id] = sdef.unit; } console.log(`eurostat marks: ${eus.rows.length} rows (${f2} folded, ${d2} dropped)`); }
if (ownMarks) { for (const r of ownMarks.rows) { const m = (marks[r.place] = marks[r.place] || {}); const c = (m[r.series] = m[r.series] || {}); c[r.year] = { p: r.value, a: null }; regionalCrops.add(r.series); } for (const [id, sdef] of Object.entries(ownMarks.series)) { cropNames[id] = sdef.label; markUnits[id] = sdef.unit; } }

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
  const hasS = rows.every((p) => p.hy[y][5] != null && p.n[5]);
  readings.years[y] = { P: Math.round(mean(0)), P_pct: Math.round(mean(0) / meanN(0) * 100), ET0: Math.round(mean(1)), bal: Math.round(mean(0) - mean(1)), bal_n: Math.round(meanN(0) - meanN(1)), D35: Math.round(mean(2) * 10) / 10, D35_n: Math.round(meanN(2) * 10) / 10, TM: Math.round(mean(4) * 10) / 10, TM_n: Math.round(meanN(4) * 10) / 10, spr_pct: hasS ? Math.round(mean(5) / meanN(5) * 100) : null, rec_pct: hasS ? Math.round(mean(6) / meanN(6) * 100) : null, n: rows.length };
}
const ys = Object.entries(readings.years);
if (ys.length) {
  readings.driest = ys.reduce((a, b) => b[1].P_pct < a[1].P_pct ? b : a)[0];
  readings.wettest = ys.reduce((a, b) => b[1].P_pct > a[1].P_pct ? b : a)[0];
  readings.hottest = ys.reduce((a, b) => b[1].D35 > a[1].D35 ? b : a)[0];
}

const trade = layers.trade?.data;

// ── findings: what the numbers say on their own, as candidate sentences ──
// Each carries its figures and its n; the wording claims a relation, never a
// cause. A researcher deletes what is trivial and keeps what is worth a look.
const findings = [];
const pct = (v) => Math.round(v) + '%';
if (field && ys.length) {
  const yrs = readings.years;
  const wy = (study.hydro_year_start_month || 10) === 1 ? 'year' : 'water year';
  findings.push({ kind: 'field', text: `Driest ${wy} ${readings.driest} (${pct(yrs[readings.driest].P_pct)} of normal), wettest ${readings.wettest} (${pct(yrs[readings.wettest].P_pct)}); most heat-stress days in ${readings.hottest} (${yrs[readings.hottest].D35} per grid point against a normal of ${yrs[readings.hottest].D35_n}).` });
  // runs of dry years
  let run = [], best = []; for (let y = Y0; y <= Y1; y++) { if (yrs[y] && yrs[y].P_pct < 90) { run.push(y); if (run.length > best.length) best = [...run]; } else run = []; }
  if (best.length >= 2) findings.push({ kind: 'field', text: `Longest run of dry ${wy}s (under 90% of normal): ${best[0]}–${best[best.length - 1]}, ${best.length} years, averaging ${pct(best.reduce((a, y) => a + yrs[y].P_pct, 0) / best.length)} of normal.` });
  // heat trend: mean D35 first third vs last third
  const third = Math.max(3, Math.floor(ys.length / 3)); const first = ys.slice(0, third), last = ys.slice(-third); const mD = (arr) => arr.reduce((a, [, r]) => a + r.D35, 0) / arr.length;
  if (mD(first) > 0) findings.push({ kind: 'field', text: `Heat-stress days per grid point averaged ${mD(first).toFixed(1)} over ${first[0][0]}–${first[first.length - 1][0]} and ${mD(last).toFixed(1)} over ${last[0][0]}–${last[last.length - 1][0]} (${mD(last) >= mD(first) ? '+' : ''}${Math.round((mD(last) / mD(first) - 1) * 100)}%).` });
}
// per-place: strongest ground↔harvest relations, r with n ≥ 15
const placeClimate = (code, y) => { const rows = field ? field.points.filter((p) => p.place === code && p.hy[y] && p.n) : []; if (!rows.length) return null; const m = (i) => rows.reduce((s, p) => s + p.hy[y][i], 0) / rows.length, mn = (i) => rows.reduce((s, p) => s + p.n[i], 0) / rows.length; const hasS = rows.every((p) => p.hy[y][5] != null && p.n[5]); return { P_pct: m(0) / mn(0) * 100, D35: m(2), bal: (m(0) - m(1)), spr_pct: hasS ? m(5) / mn(5) * 100 : null }; };
const rels = [];
if (field) for (const [code, m] of Object.entries(marks)) for (const [crop, ysr] of Object.entries(m)) for (const [xk, xl] of [['P_pct', 'rain'], ['spr_pct', 'spring rain'], ['D35', 'heat-stress days'], ['bal', 'water balance']]) {
  const pairs = []; for (let y = Y0; y <= Y1; y++) { const c = placeClimate(code, y); const v = ysr[y]?.p; if (c && v != null && c[xk] != null) pairs.push([c[xk], v]); }
  if (pairs.length < 15) continue; const n = pairs.length, mx = pairs.reduce((s, p) => s + p[0], 0) / n, mv = pairs.reduce((s, p) => s + p[1], 0) / n; let sxx = 0, svv = 0, sxv = 0; for (const [x, v] of pairs) { sxx += (x - mx) ** 2; svv += (v - mv) ** 2; sxv += (x - mx) * (v - mv); } const r = sxx && svv ? sxv / Math.sqrt(sxx * svv) : 0;
  if (Math.abs(r) >= 0.5) rels.push({ code, crop, xl, r, n });
}
rels.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
for (const q of rels.slice(0, 5)) findings.push({ kind: 'relation', place: q.code, crop: q.crop, text: `${places[q.code]?.name || q.code}: ${cropNames[q.crop] || q.crop} against ${q.xl}, r = ${q.r.toFixed(2)} over ${q.n} years (${q.r < 0 ? 'inverse' : 'direct'}).` });
// national harvest extremes vs the field
for (const [cc, m] of Object.entries(national)) for (const [crop, ysr] of Object.entries(m).slice(0, 12)) { const vals = Object.entries(ysr).filter(([, v]) => v.p != null); if (vals.length < 10) continue; const mean = vals.reduce((a, [, v]) => a + v.p, 0) / vals.length; const [minY, minV] = vals.reduce((a, b) => b[1].p < a[1].p ? b : a); if (minV.p / mean < 0.7 && readings.years[minY]) findings.push({ kind: 'harvest', text: `${placesFile.national[cc] || cc}, ${(cropNames[crop] || crop).replace(/ — FAOSTAT/, '')}: lowest year ${minY} at ${Math.round(minV.p / mean * 100)}% of its mean; that ${wy}'s rain was ${pct(readings.years[minY].P_pct)} of normal${readings.years[minY].spr_pct != null ? `, its spring rain ${pct(readings.years[minY].spr_pct)}` : ''}.` }); }


if (crops && !Object.keys(placesFile.places).length && !fao) warnings.push('no places and no FAOSTAT: the harvest layer is national only from Eurostat');
if (errors.length) { console.error('BUILD FAILED\n' + errors.join('\n')); process.exit(1); }
warnings.forEach((w) => console.warn('warn:', w));

const bundle = {
  id: study.id, title: study.title, subtitle: study.subtitle, years: study.years, normal: study.normal, built: new Date().toISOString().slice(0, 10),
  layers: study.layers.map((L) => ({ id: L.id, kind: L.kind, ink: L.ink, label: L.label, unit: L.unit })),
  places, national_names: placesFile.national, place_note: placesFile.note,
  field, marks, national, regional_crops: [...regionalCrops], crop_names: cropNames, mark_units: markUnits, mark_unit_default: crops ? 'kt' : '', crop_source: crops?.source || null,
  own: { marks: ownMarks ? ownMarks.source : null, series: [...(ownSeries ? ownSeries.series : []), ...(wb ? wb.series : [])], series_source: ownSeries ? ownSeries.source : null, events: ownEvents ? ownEvents.source : null, worldbank: wb ? wb.source : null },
  fao_source: fao ? fao.source : null, eurostat_source: eus ? { ...eus.source, series: eus.series } : null,
  trade: trade ? { products: trade.products, prices: trade.prices, sources: trade.sources, trade: trade.trade, price: trade.price } : null,
  events, event_kinds: kinds, confidence_tiers: pol?.confidence_tiers || { recalled: 'written from knowledge, with a citation; nothing opened', cited: 'the citation resolved to an act of that name and date at the publisher', read: 'the source text was read and the summary checked against it' }, readings,
  fade: study.frame.fade || null, market: study.market || {}, hydro_year_start_month: study.hydro_year_start_month || 10,
  notes: study.notes || [], findings: findings.slice(0, 12),
};
mkdirSync(join(ROOT, 'web/data'), { recursive: true });
const js = `// ${study.title} — © ${new Date().getFullYear()} Ozvåag LLC. Sources are named inside; every figure carries its origin.\nwindow.STUDY=${JSON.stringify(bundle)};`;
writeFileSync(join(ROOT, 'web/data', study.id + '.js'), js);
// The physical sheet: frame + HydroRIVERS network + hand-placed features + relief legend.
const net = existsSync(join(DIR, 'geo/rivers.json')) ? JSON.parse(readFileSync(join(DIR, 'geo/rivers.json'), 'utf8')) : null;
const feats = existsSync(join(DIR, 'features.json')) ? JSON.parse(readFileSync(join(DIR, 'features.json'), 'utf8')) : { features: [], peaks: [] };
const basinsFile = existsSync(join(DIR, 'geo/basins.json')) ? JSON.parse(readFileSync(join(DIR, 'geo/basins.json'), 'utf8')) : null;
// frame.basin_names: { "<HYBAS_ID>" | "<current name>": "official name" } — rename basins to the
// units a study's instruments actually use (Portugal's RH1–RH8, Spain's demarcaciones).
const BN = study.frame.basin_names || {};
const basins = basinsFile ? { source: basinsFile.source, level: basinsFile.level, basins: basinsFile.basins.map((b) => ({ ...b, name: BN[b.id] || (b.name && BN[b.name]) || b.name, label: polylabel(b.ring, 0.02).map((v) => Math.round(v * 1e3) / 1e3) })) } : null;
if (basins) for (const k of Object.keys(BN)) if (!basins.basins.some((b) => b.id === k || basinsFile.basins.some((o) => o.id === b.id && o.name === k))) warnings.push(`basin_names: "${k}" matches no basin id or name`);
const relief = existsSync(join(DIR, 'geo/relief.json')) ? JSON.parse(readFileSync(join(DIR, 'geo/relief.json'), 'utf8')) : null;
const peakSeen = new Set(); const peaks = [...(geo.peaks || []), ...(feats.peaks || [])].filter((p) => { const k = p.name.toLowerCase(); if (peakSeen.has(k)) return false; peakSeen.add(k); return true; });
const geoJs = `window.STUDY_GEO=${JSON.stringify({ window: geo.window, land: geo.land, coast: geo.coast, rivers: geo.rivers, named_rivers: geo.named_rivers || [], lakes: geo.lakes, bathy: geo.bathy || {}, peaks, features: feats.features, feature_note: feats.note, network: net ? { source: net.source, min_order: net.min_order, reaches: net.reaches } : null, basins, relief, source: geo.source })};`;
writeFileSync(join(ROOT, 'web/data', study.id + '-geo.js'), geoJs);
// The registry: every built study with content hashes, so the engine and the
// globe can address them and CF's browser cache never serves a stale bundle.
const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const regPath = join(ROOT, 'web/data/studies.js');
const REG = existsSync(regPath) ? JSON.parse(readFileSync(regPath, 'utf8').replace(/^window\.STUDIES=/, '').replace(/;\s*$/, '')) : {};
const reliefPng = join(ROOT, 'web/data', study.id + '-relief.png');
if (study.private) delete REG[study.id]; else REG[study.id] = { title: study.title, subtitle: study.subtitle, years: study.years, countries: study.frame.mask, window: study.frame.window, built: bundle.built, data: h(js), geo: h(geoJs), relief: existsSync(reliefPng) ? h(readFileSync(reliefPng)) : null, counts: { field: field ? field.points.length : 0, places: Object.keys(places).length, events: events.length, trade: trade ? trade.trade.length : 0 } };
writeFileSync(regPath, 'window.STUDIES=' + JSON.stringify(REG) + ';');
// A share page per study: crawlers read the card (title, one line, the relief),
// people are sent on to the engine. /s/<id>
mkdirSync(join(ROOT, 'web/s'), { recursive: true });
for (const [sid, r] of Object.entries(REG)) {
  const site = 'https://layercake.pages.dev';
  writeFileSync(join(ROOT, 'web/s', sid + '.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${r.title} — Layercake</title><meta name="description" content="${(r.subtitle || '').replace(/"/g, '&quot;')}"><meta property="og:type" content="article"><meta property="og:title" content="${r.title} — Layercake"><meta property="og:description" content="${(r.subtitle || '').replace(/"/g, '&quot;')} · ${(r.countries || []).join('+')} · ${r.years[0]}–${r.years[1]} · ${r.counts.field} grid points, ${r.counts.places} places, ${r.counts.events} instruments"><meta property="og:url" content="${site}/study?s=${sid}">${r.relief ? `<meta property="og:image" content="${site}/data/${sid}-relief.png?v=${r.relief}"><meta name="twitter:card" content="summary_large_image">` : ''}<meta http-equiv="refresh" content="0; url=/study?s=${sid}"><link rel="canonical" href="${site}/study?s=${sid}"></head><body style="font-family:Georgia,serif;padding:2em"><p><a href="/study?s=${sid}">${r.title}</a> — a Layercake study.</p></body></html>`);
}
for (const page of ['index.html', 'study.html', 'builder.html']) {
  const f = join(ROOT, 'web', page); if (!existsSync(f)) continue;
  let html = readFileSync(f, 'utf8');
  html = html.replace(/data\/studies\.js(\?v=[0-9a-f]+)?/g, `data/studies.js?v=${h(JSON.stringify(REG))}`).replace(/atlas\.css(\?v=[0-9a-f]+)?/g, `atlas.css?v=${h(readFileSync(join(ROOT, 'web/atlas.css'), 'utf8'))}`);
  if (existsSync(join(ROOT, 'web/data/world.js'))) html = html.replace(/data\/world\.js(\?v=[0-9a-f]+)?/g, `data/world.js?v=${h(readFileSync(join(ROOT, 'web/data/world.js')))}`);
  writeFileSync(f, html);
}
console.log(`built ${study.id}: ${Object.keys(places).length} places · field ${field ? field.points.length : 0} pts · marks ${Object.keys(marks).length} places × ${regionalCrops.size} regional crops (${folded} rows folded by alias, ${dropped} dropped: islands/NUTS-1/extra-regio) · events ${events.length} · trade ${trade ? trade.trade.length : 0} · ${(js.length / 1024).toFixed(0)} KB`);
if (readings.driest) console.log(`readings: driest ${readings.driest} (${readings.years[readings.driest].P_pct}% of normal) · wettest ${readings.wettest} (${readings.years[readings.wettest].P_pct}%) · most ≥35° days ${readings.hottest} (${readings.years[readings.hottest].D35}/pt)`);
