#!/usr/bin/env node
// harvest-trade.mjs — the market side of the food layer, national by nature:
//   · exports (and imports) by HS product, reporter = each masked country,
//     partner = world — Eurostat Comext ds-045409 (CC BY 4.0), € and 100 kg;
//   · producer prices per 100 kg / 100 l — Eurostat apri_ap_crpouta.
// Kept apart from the regional harvest because a customs return has no region.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eurostat } from './eurostat.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const [Y0, Y1] = study.years; const years = []; for (let y = Y0; y <= Y1; y++) years.push(String(y));
const cc = study.frame.mask;
const PRODUCTS = { 1509: 'Olive oil', '0805': 'Citrus fruit', '080510': 'Oranges', 2204: 'Wine', 4501: 'Natural cork, raw', 4502: 'Natural cork, debacked or roughly squared', 4503: 'Articles of natural cork', 4504: 'Agglomerated cork', '080212': 'Almonds, shelled', 1001: 'Wheat', 1006: 'Rice', '0702': 'Tomatoes', '081010': 'Strawberries' };
const PRICES = { '08100000': 'Extra virgin olive oil, €/100 l', '06590000': 'Olives (other than table), €/100 kg', '06510000': 'Table olives, €/100 kg', '06210000': 'Oranges, €/100 kg', '06490000': 'Wine grapes, €/100 kg', '06194130': 'Almonds, €/100 kg', '01110000': 'Soft wheat, €/100 kg', '01600000': 'Rice, €/100 kg', '06193000': 'Strawberries, €/100 kg', '04121000': 'Tomatoes in the open, €/100 kg' };
const COMEXT = 'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const out = { layer: 'trade', kind: 'series', products: PRODUCTS, prices: PRICES,
    sources: [
      { name: 'Eurostat Comext ds-045409 — EU trade since 1988 by HS2-4-6 and CN8', url: 'https://ec.europa.eu/eurostat/web/international-trade-in-goods/data/database', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10) },
      { name: 'Eurostat apri_ap_crpouta — Selling prices of crop products (absolute prices)', url: 'https://ec.europa.eu/eurostat/databrowser/view/apri_ap_crpouta/', licence: 'CC BY 4.0', fetched_at: new Date().toISOString().slice(0, 10) },
    ], trade: [], price: [] };
  for (const c of cc) for (const p of Object.keys(PRODUCTS)) {
    for (const flow of ['1', '2']) {
      try {
        const { rows } = await eurostat('ds-045409', { reporter: c, partner: 'WORLD', product: p, flow, freq: 'A', indicators: ['VALUE_IN_EUROS', 'QUANTITY_IN_100KG'], time: years }, { base: COMEXT });
        const by = {};
        for (const r of rows) { const k = r.time; by[k] = by[k] || { country: c, product: p, flow: flow === '2' ? 'export' : 'import', year: +r.time }; by[k][r.indicators === 'VALUE_IN_EUROS' ? 'eur' : 'q_100kg'] = r.value; }
        out.trade.push(...Object.values(by));
        console.log(c, p, flow === '2' ? 'X' : 'M', Object.keys(by).length, 'years');
      } catch (e) { console.log('skip', c, p, flow, e.message.slice(0, 80)); }
      await sleep(300);
    }
  }
  for (const c of cc) {
    const { rows } = await eurostat('apri_ap_crpouta', { geo: c, currency: 'EUR', prod_veg: Object.keys(PRICES), time: years });
    for (const r of rows) out.price.push({ country: c, product: r.prod_veg, year: +r.time, eur: r.value });
    console.log(c, 'prices', rows.length, 'cells');
  }
  const f = join(ROOT, 'studies', study.id, 'food/trade.json'); mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(out));
  console.log(`wrote ${out.trade.length} trade rows, ${out.price.length} price rows`);
}
main().catch((e) => { console.error(e); process.exit(1); });
