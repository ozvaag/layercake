#!/usr/bin/env node
// check-sources.mjs — does every cited instrument URL still answer? Writes
// `reachable_at` / `http` onto each instrument. It NEVER changes `confidence`:
// a page answering is not the same as a person having read it.
// Usage: node scripts/check-sources.mjs studies/iberia/study.json [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'studies/iberia/study.json'), 'utf8'));
const WRITE = process.argv.includes('--write');
const f = join(ROOT, 'studies', study.id, 'policy/instruments.json');
const pol = JSON.parse(readFileSync(f, 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
async function probe(url) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: ctl.signal });
    clearTimeout(t); const txt = await r.text().catch(() => '');
    return { http: r.status, bytes: txt.length, final: r.url !== url ? r.url : undefined };
  } catch (e) { return { http: 0, error: String(e.cause?.code || e.name) }; }
}
const today = new Date().toISOString().slice(0, 10);
for (const i of pol.instruments) {
  if (!i.source_url) { console.log('—', i.id, 'no url'); continue; }
  const p = await probe(i.source_url);
  // The Atlas's lesson: a 200 under a few KB is a JS shell or a bot wall, not a
  // page; a redirect onto an error path is a dead link wearing a 200.
  const dead = p.final && /error|404/i.test(p.final);
  const thin = (p.bytes ?? 0) < 3000;
  const state = p.http === 0 || p.http >= 400 || dead ? 'dead' : thin ? 'wall' : 'up';
  console.log(state === 'up' ? '✓' : state === 'wall' ? '▒' : '✗', i.id, p.http, p.bytes ?? p.error, p.final ? '→ ' + p.final.slice(0, 80) : '');
  i.source_state = state; i.checked_at = today;
}
if (WRITE) { writeFileSync(f, JSON.stringify(pol, null, 1)); console.log('written'); }
