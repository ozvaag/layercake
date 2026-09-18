#!/usr/bin/env node
// run.mjs — the one command. Reads the manifest and runs, in order, only what
// it asks for: frame → places (if none yet) → relief → drainage → the readers
// named by the layers → own CSVs (if present) → source check → build.
// Every step is its own script and can be re-run alone; raw responses cache.
// Usage: node scripts/run.mjs studies/<id>/study.json [--skip=relief,hydro]
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = process.argv[2]; if (!manifest) { console.error('usage: node scripts/run.mjs studies/<id>/study.json'); process.exit(2); }
const study = JSON.parse(readFileSync(manifest, 'utf8')); const DIR = join(ROOT, 'studies', study.id);
const skip = new Set(((process.argv.find((a) => a.startsWith('--skip=')) || '').split('=')[1] || '').split(',').filter(Boolean));
const files = new Set(study.layers.map((L) => L.file));
const steps = [];
steps.push(['geo', 'geo.mjs']);
if (!existsSync(join(DIR, 'places.json')) || !Object.keys(JSON.parse(readFileSync(join(DIR, 'places.json'), 'utf8')).places || {}).length) steps.push(['places', 'places-from-frame.mjs']);
steps.push(['relief', 'relief.mjs'], ['hydro', 'hydro.mjs'], ['basins', 'basins.mjs']);
if ([...files].some((f) => f.startsWith('natural/'))) steps.push(['climate', 'harvest-climate.mjs']);
if (files.has('food/crops.json')) steps.push(['crops', 'harvest-crops.mjs']);
if (files.has('food/trade.json')) steps.push(['trade', 'harvest-trade.mjs']);
if (files.has('food/faostat.json')) steps.push(['faostat', 'harvest-faostat.mjs']);
if (files.has('series/worldbank.json')) steps.push(['worldbank', 'harvest-worldbank.mjs']);
if (existsSync(join(DIR, 'own'))) steps.push(['own', 'harvest-own.mjs']);
if (files.has('policy/instruments.json')) steps.push(['sources', 'check-sources.mjs', '--write']);
steps.push(['build', 'build.mjs'], ['readme', 'readme.mjs']);
if (!existsSync(join(ROOT, 'web/data/world.js'))) steps.unshift(['world', 'world.mjs']);
console.log(`layercake · ${study.title} · ${steps.length} steps: ${steps.map((s) => s[0]).join(' → ')}`);
const t0 = Date.now();
for (const [name, script, ...args] of steps) {
  if (skip.has(name)) { console.log(`— ${name} skipped`); continue; }
  const t = Date.now(); console.log(`\n▸ ${name}`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...(script === 'world.mjs' ? [] : [manifest]), ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\n✗ ${name} failed (exit ${r.status}). Fix it and re-run; finished steps are cached.`); process.exit(r.status || 1); }
  console.log(`✓ ${name} in ${((Date.now() - t) / 1000).toFixed(0)} s`);
}
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s → open web/study.html?s=${study.id} (or ./deploy.sh)`);
