// proj.mjs — the study's projection, shared by the relief renderer and the
// page (index.html carries the same lines; keep them identical).
// Albers equal-area conic on the study window: standard parallels one degree
// inside the window's south and north edges, origin at its centre.
export function albers(W, VW = 760, VH = 560, PAD = 6) {
  const R = Math.PI / 180;
  const φ1 = (W.lat[0] + 1) * R, φ2 = (W.lat[1] - 1) * R, φ0 = (W.lat[0] + W.lat[1]) / 2 * R, λ0 = (W.lon[0] + W.lon[1]) / 2 * R;
  const n = (Math.sin(φ1) + Math.sin(φ2)) / 2, C = Math.cos(φ1) ** 2 + 2 * n * Math.sin(φ1), ρ0 = Math.sqrt(C - 2 * n * Math.sin(φ0)) / n;
  const raw = ([lon, lat]) => { const ρ = Math.sqrt(C - 2 * n * Math.sin(lat * R)) / n, θ = n * (lon * R - λ0); return [ρ * Math.sin(θ), ρ0 - ρ * Math.cos(θ)]; };
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (let i = 0; i <= 40; i++) { const t = i / 40; [[W.lon[0] + t * (W.lon[1] - W.lon[0]), W.lat[0]], [W.lon[0] + t * (W.lon[1] - W.lon[0]), W.lat[1]], [W.lon[0], W.lat[0] + t * (W.lat[1] - W.lat[0])], [W.lon[1], W.lat[0] + t * (W.lat[1] - W.lat[0])]].forEach((p) => { const [x, y] = raw(p); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }); }
  const sc = Math.min((VW - 2 * PAD) / (bx1 - bx0), (VH - 2 * PAD) / (by1 - by0));
  const ox = (VW - sc * (bx1 - bx0)) / 2, oy = (VH - sc * (by1 - by0)) / 2;
  const fwd = (p) => { const [x, y] = raw(p); return [ox + (x - bx0) * sc, oy + (by1 - y) * sc]; };
  // inverse: page pixel → lon/lat
  const inv = ([px, py]) => {
    const x = (px - ox) / sc + bx0, y = by1 - (py - oy) / sc;
    const ρ = Math.sign(n) * Math.hypot(x, ρ0 - y), θ = Math.atan2(x, ρ0 - y);
    const lat = Math.asin((C - ρ * ρ * n * n) / (2 * n)) / R, lon = (λ0 + θ / n) / R;
    return [lon, lat];
  };
  return { fwd, inv, VW, VH };
}
