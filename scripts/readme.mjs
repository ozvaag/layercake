#!/usr/bin/env node
// readme.mjs — a study's README, written from its built bundle: what it holds,
// where every layer came from and when, and how to cite it. Runs after build.
// Usage: node scripts/readme.mjs studies/<id>/study.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const bf = join(ROOT, 'web/data', study.id + '.js'); if (!existsSync(bf)) { console.error('build first'); process.exit(1); }
const S = (new Function(readFileSync(bf, 'utf8').replace(/^\/\/.*\n/, '').replace('window.STUDY=', 'return ')))();
const src = [];
if (S.field) src.push(`- **Ground (field):** ${S.field.source.name} — ${S.field.source.licence}; fetched ${S.field.source.fetched_at}; ${S.field.points.length} grid points at ${S.field.step}°; ${S.field.hydro_year}; ET₀ ${S.field.et0_method}; normals ${S.field.normal_period.join('–')}.`);
if (S.crop_source) src.push(`- **Harvest (marks, regional):** ${S.crop_source.name} — ${S.crop_source.licence}; source updated ${String(S.crop_source.updated).slice(0, 10)}, fetched ${S.crop_source.fetched_at}; regional series for ${S.regional_crops.filter((c) => !c.startsWith('fao-')).map((c) => S.crop_names[c]).join(', ')}.`);
if (S.fao_source) src.push(`- **Harvest (national):** ${S.fao_source.name} — ${S.fao_source.licence}; fetched ${S.fao_source.fetched_at}.`);
if (S.trade) S.trade.sources.forEach((s) => src.push(`- **Market (series):** ${s.name} — ${s.licence}; fetched ${s.fetched_at}.`));
if (S.own?.worldbank) src.push(`- **Indicators (series):** ${S.own.worldbank.name} — ${S.own.worldbank.licence}; fetched ${S.own.worldbank.fetched_at}; ${S.own.series.filter((x) => x.source === 'World Bank').length} series.`);
if (S.own?.marks || S.own?.series_source || S.own?.events) src.push(`- **Own data:** ${[S.own.marks && 'marks', S.own.series_source && 'series', S.own.events && 'events'].filter(Boolean).join(', ')} from CSV in \`own/\`.`);
if (S.events.length) { const c = {}; S.events.forEach((e) => c[e.confidence] = (c[e.confidence] || 0) + 1); src.push(`- **Law (events):** ${S.events.length} instruments, hand-curated with a citation each — ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ')}.`); }
src.push(`- **Frame:** Natural Earth 1:10m (public domain) coast, lakes, bathymetry, named rivers, peaks; HydroRIVERS v1.0 (free with attribution) drainage; Terrarium terrain tiles (AWS Open Data) relief.`);
const md = `# ${S.title}

${S.subtitle || ''}

**Mask:** ${Object.entries(S.national_names).map(([k, v]) => `${v} (${k})`).join(', ') || study.frame.mask.join(', ')} · **Years:** ${S.years[0]}–${S.years[1]} · **Normal:** ${S.normal[0]}–${S.normal[1]} · **Built:** ${S.built}
**Live:** https://layercake.pages.dev/study?s=${S.id}

${(S.notes || []).map((n) => n + '\n').join('\n')}
## What it holds

${Object.keys(S.places).length} places · ${S.field ? S.field.points.length : 0} grid points · ${S.events.length} instruments · ${S.trade ? S.trade.trade.length : 0} trade rows · ${(S.own?.series || []).length} series

## Sources

${src.join('\n')}

A reanalysis is a model fitted to observations, not a rain gauge. Correlation printed on the plate is not attribution.

## Files

- \`study.json\` — the manifest (where, what, when)
- \`places.json\` — the marks' atoms
- \`policy/instruments.json\` — the events, cited
- \`geo/\`, \`natural/\`, \`food/\`, \`series/\`, \`own/\` — reader outputs, regenerable with \`node scripts/run.mjs studies/${S.id}/study.json\`

## Cite

> *${S.title}* — a Layercake study, built ${S.built}. https://layercake.pages.dev/study?s=${S.id} · https://github.com/ozvaag/layercake/tree/main/studies/${S.id}

Engine © Ozvåag LLC, MIT. Each source keeps its own licence, listed above.
`;
writeFileSync(join(ROOT, 'studies', S.id, 'README.md'), md);
console.log(`wrote studies/${S.id}/README.md`);
