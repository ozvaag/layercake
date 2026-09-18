// POST /api/submit — a study proposed from the builder becomes a pull request.
// Body: { study, places, instruments, note } (JSON). The function writes the
// three files to a new branch of the repo through the GitHub API and opens a
// PR; a person merges it; CI (build-study.yml) runs the readers and deploys.
// Nothing reaches the site without that merge. Needs the Pages secret
// GITHUB_TOKEN (fine-grained PAT: contents + pull requests on the repo) and
// optionally GITHUB_REPO (default ozvaag/layercake). Without the token it
// answers 503 and the builder falls back to downloads.
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export async function onRequestPost({ request, env }) {
  if (!env.GITHUB_TOKEN) return json({ error: 'submissions are not switched on yet — download the files and run the command' }, 503);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (body.website) return json({ ok: true, pr: null });   // honeypot
  const study = body.study; if (!study || typeof study !== 'object') return json({ error: 'no study' }, 400);
  const id = slug(study.id || study.title); if (!id || id === 'my-study') return json({ error: 'give the study a name first' }, 400);
  const mask = Array.isArray(study.frame?.mask) ? study.frame.mask.filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 8) : [];
  if (!mask.length) return json({ error: 'pick at least one country' }, 400);
  const [y0, y1] = Array.isArray(study.years) ? study.years.map(Number) : [];
  if (!(y0 >= 1950 && y1 <= 2030 && y1 - y0 >= 1 && y1 - y0 <= 80)) return json({ error: 'years out of range' }, 400);
  const files = { [`studies/${id}/study.json`]: { ...study, id, frame: { ...study.frame, mask } }, [`studies/${id}/places.json`]: body.places || { places: {}, aliases: {}, national: {} }, [`studies/${id}/policy/instruments.json`]: body.instruments || { layer: 'policy', kind: 'events', kinds: { event: 'event' }, instruments: [] } };
  for (const [p, o] of Object.entries(files)) { const s = JSON.stringify(o); if (s.length > 200000) return json({ error: `${p} is too large` }, 413); }
  const repo = env.GITHUB_REPO || 'ozvaag/layercake', api = `https://api.github.com/repos/${repo}`;
  const gh = async (path, init = {}) => { const r = await fetch(api + path, { ...init, headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'layercake-submit', 'content-type': 'application/json', ...(init.headers || {}) } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } if (!r.ok) throw new Error(`${path}: ${r.status} ${j.message || t.slice(0, 120)}`); return j; };
  try {
    const main = await gh('/git/ref/heads/main'); const sha = main.object.sha;
    const branch = `study/${id}-${Date.now().toString(36)}`;
    await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) });
    for (const [path, o] of Object.entries(files)) {
      let existing = null; try { existing = await gh(`/contents/${path}?ref=${branch}`); } catch {}
      await gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: `study ${id}: ${path.split('/').pop()} from the builder`, content: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 2) + '\n'))), branch, ...(existing?.sha ? { sha: existing.sha } : {}) }) });
    }
    const pr = await gh('/pulls', { method: 'POST', body: JSON.stringify({ title: `Study: ${study.title || id} (${mask.join('+')}, ${y0}–${y1})`, head: branch, base: 'main', body: `Submitted from the builder.\n\n**Mask:** ${mask.join(', ')} · **Years:** ${y0}–${y1} · **Layers:** ${(study.layers || []).map((l) => l.id).join(', ')}\n\n${body.note ? String(body.note).slice(0, 2000) : ''}\n\nMerging runs \`node scripts/run.mjs studies/${id}/study.json\` in CI and deploys the study.` }) });
    return json({ ok: true, pr: pr.html_url, branch });
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
export async function onRequestGet() { return json({ ok: true, how: 'POST { study, places, instruments, note }' }); }
