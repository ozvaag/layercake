#!/usr/bin/env node
// places-from-frame.mjs — propose places.json from the frame.
// Natural Earth's admin-1 units carry their parent region's name; Eurostat's
// NUTS-2 labels are fetched for the masked countries and matched by name
// (accents stripped, a few known synonyms). What matches is written as a
// place with its units; what does not is listed under `unmatched` for a
// person to place. Never overwrites a places.json that already has places.
// Usage: node scripts/places-from-frame.mjs studies/<id>/study.json [--force]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const DIR = join(ROOT, 'studies', study.id); const out = join(DIR, 'places.json');
const existing = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
if (existing && Object.keys(existing.places || {}).length && !process.argv.includes('--force')) { console.log(`places.json already has ${Object.keys(existing.places).length} places — pass --force to regenerate`); process.exit(0); }
const geo = JSON.parse(readFileSync(join(DIR, 'geo/frame.json'), 'utf8'));
const EU = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS NO CH'.split(' '));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(di|de|del|della|provincia|autonoma|autonomous|province|region|regione|comunidad|comunitat|regiao|area metropolitana)\b/g, ' ').replace(/\s+/g, ' ').trim();
const SYN = { apulia: 'puglia', sicily: 'sicilia', lisbon: 'lisboa', 'foral de navarra': 'navarra', 'canary is': 'canarias', 'islas baleares': 'illes balears', valenciana: 'comunitat valenciana', 'trentino alto adige': null, 'valle d aosta': 'valle d aosta', bozen: 'bolzano', 'lombardia': 'lombardia', 'friuli venezia giulia': 'friuli venezia giulia' };
async function nuts2(cc) {
  try { const r = await fetch(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apro_cpshr?crops=C0000&strucpro=AR_THS_HA&time=2020`); const j = await r.json(); return Object.entries(j.dimension.geo.category.label).filter(([k]) => k.startsWith(cc) && k.length === 4).map(([code, label]) => ({ code, label, n: norm(label.replace(/ \(NUTS \d+\)/, '')) })); } catch (e) { return []; }
}
const places = {}, unmatched = {}, national = {}, ALIASES = {};
for (const cc of study.frame.mask) {
  national[cc] = cc;
  const units = Object.entries(geo.admin1).filter(([code]) => code.startsWith(cc + '-'));
  if (!units.length) { console.log(cc, 'no admin-1 units in the frame'); continue; }
  let labels = EU.has(cc) ? await nuts2(cc) : [];
  // Eurostat keeps retired NUTS codes beside current ones under the same label
  // (ITD1 and ITH1 are both "Provincia Autonoma Bolzano"); keep the newest code
  // and alias the rest to it so the older rows fold onto the same place.
  const aliases = {}; const byLabel = {}; labels.forEach((l) => (byLabel[l.n] = byLabel[l.n] || []).push(l));
  labels = Object.values(byLabel).map((ls) => { ls.sort((a, b) => a.code.localeCompare(b.code)); const keep = ls[ls.length - 1]; ls.slice(0, -1).forEach((o) => aliases[o.code] = keep.code); return keep; });
  Object.assign(ALIASES, aliases);
  const byRegion = {}; for (const [code, u] of units) (byRegion[u.region || u.name] = byRegion[u.region || u.name] || []).push([code, u]);
  const find = (name) => { const n = norm(name); const key = SYN[n] === undefined ? n : SYN[n]; if (key === null) return null; return labels.find((l) => l.n === key) || labels.find((l) => l.n.includes(key) || key.includes(l.n)) || null; };
  for (const [region, us] of Object.entries(byRegion)) {
    const hit = labels.length ? find(region) : null;
    if (hit) { const pl = places[hit.code] || (places[hit.code] = { name: hit.label.replace(/ \(NUTS \d+\)/, ''), country: cc, units: [] }); pl.units.push(...us.map(([c]) => c)); continue; }
    // try each unit on its own (Bolzano / Trento inside Trentino-Alto Adige)
    let any = false;
    for (const [c, u] of us) { const h = labels.length ? find(u.name) : null; if (h) { const pl = places[h.code] || (places[h.code] = { name: h.label.replace(/ \(NUTS \d+\)/, ''), country: cc, units: [] }); pl.units.push(c); any = true; } }
    if (any) continue;
    // No statistical region list to match (outside the EU, or no label answered): the
    // frame's own regions become the places, coded by Natural Earth's region code.
    if (!labels.length) { const rc = us[0][1].region_code; const code = rc || `${cc}-${norm(region).replace(/ /g, '-').slice(0, 24)}`; places[code] = { name: region, country: cc, units: us.map(([c]) => c) }; continue; }
    unmatched[`${cc}:${region}`] = us.map(([c, u]) => `${c} ${u.name}`);
  }
  console.log(`${cc}: ${units.length} units → ${Object.values(places).filter((p) => p.country === cc).length} places, ${Object.keys(unmatched).filter((k) => k.startsWith(cc + ':')).length} unmatched`);
}
const doc = { note: 'Proposed by scripts/places-from-frame.mjs from Natural Earth admin-1 regions matched to Eurostat NUTS-2 labels. Check the units of each place; move anything under `unmatched` by hand; add `aliases` for older NUTS codes the source still uses.', places, aliases: ALIASES, national: existing?.national || national, unmatched };
writeFileSync(out, JSON.stringify(doc, null, 1));
console.log(`wrote ${out}: ${Object.keys(places).length} places, ${Object.keys(unmatched).length} unmatched`);
