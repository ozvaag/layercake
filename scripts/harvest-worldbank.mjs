#!/usr/bin/env node
// harvest-worldbank.mjs — national indicators for any country, per year, from
// the World Bank API (CC BY 4.0, no key). Which indicators: study.worldbank
// (a list of indicator codes) or the defaults below — the ones a study of
// land, water and harvest usually wants. Output: series/worldbank.json in
// the own-series shape, one series per indicator per country.
// Usage: node scripts/harvest-worldbank.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const [Y0, Y1] = study.years;
const DEFAULT = ['SP.POP.TOTL', 'NY.GDP.PCAP.KD', 'NV.AGR.TOTL.ZS', 'AG.LND.IRIG.AG.ZS', 'ER.H2O.FWAG.ZS', 'AG.YLD.CREL.KG', 'AG.LND.AGRI.ZS', 'SP.RUR.TOTL.ZS'];
const codes = study.worldbank || DEFAULT;
const series = [];
for (const cc of study.frame.mask) for (const ind of codes) {
  const url = `https://api.worldbank.org/v2/country/${cc}/indicator/${ind}?format=json&per_page=200&date=${Y0}:${Y1}`;
  try {
    const j = await (await fetch(url)).json(); const rows = j[1] || []; if (!rows.length) { console.log(cc, ind, 'no rows'); continue; }
    const values = {}; let label = ind, unit = ''; for (const r of rows) { if (r.value != null) values[+r.date] = r.value; label = r.indicator.value; unit = r.unit || ''; }
    const m = label.match(/\((.*)\)\s*$/); if (m && !unit) { unit = m[1]; }
    series.push({ id: `wb-${ind}-${cc}`, label: `${label.replace(/\s*\(.*\)\s*$/, '')} — ${cc}`, unit, indicator: ind, country: cc, values, source: 'World Bank' });
    console.log(cc, ind, Object.keys(values).length, 'years');
  } catch (e) { console.log('skip', cc, ind, e.message); }
  await new Promise((r) => setTimeout(r, 150));
}
const f = join(ROOT, 'studies', study.id, 'series/worldbank.json'); mkdirSync(dirname(f), { recursive: true });
writeFileSync(f, JSON.stringify({ layer: 'worldbank', kind: 'series', series, source: { name: 'World Bank Indicators API v2', url: 'https://data.worldbank.org/', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10) } }));
console.log(`wrote ${series.length} series`);
