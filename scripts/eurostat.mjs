// eurostat.mjs — a JSON-stat 2.0 decoder for the Eurostat dissemination API.
// Returns rows [{dim1: code, ..., value}] for every non-null cell.
export async function eurostat(dataset, params, { base = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/' } = {}) {
  const qs = Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${k}=${encodeURIComponent(x)}`)).join('&');
  const url = `${base}${dataset}?${qs}`;
  const r = await fetch(url); if (!r.ok) throw new Error(`${dataset} ${r.status} ${url}`);
  const j = await r.json();
  return { rows: decode(j), meta: j, url };
}
export function decode(j) {
  const ids = j.id, size = j.size;
  const cats = ids.map((d) => { const idx = j.dimension[d].category.index; const arr = Array.isArray(idx) ? idx : Object.entries(idx).sort((a, b) => a[1] - b[1]).map((e) => e[0]); return arr; });
  const labels = ids.map((d) => j.dimension[d].category.label || {});
  const rows = [];
  for (const [k, v] of Object.entries(j.value || {})) {
    let n = +k; const row = { value: v };
    for (let i = ids.length - 1; i >= 0; i--) { const c = n % size[i]; n = Math.floor(n / size[i]); row[ids[i]] = cats[i][c]; row[ids[i] + '_label'] = labels[i][cats[i][c]]; }
    rows.push(row);
  }
  return rows;
}
