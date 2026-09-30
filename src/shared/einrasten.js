/* Einrasten beim Ziehen in der Topologie: Die gezogene Box richtet sich an Kanten und
   Mitten anderer Geräte aus, sonst rastet ihre linke obere Ecke im Raster ein.
   Boxen sind mittig angegeben: { x, y, w, h }. */
export const RASTER = 20;

const kanten = (m, g) => [m - g / 2, m, m + g / 2];

function achse(box, andere, a, raster, fang) {
  const g = a === "x" ? "w" : "h", q = a === "x" ? "y" : "x", qg = a === "x" ? "h" : "w";
  const eigene = kanten(box[a], box[g]);
  let best = null;
  for (const o of andere) for (const ok of kanten(o[a], o[g])) for (const ek of eigene) {
    const d = ok - ek;
    if (Math.abs(d) <= fang && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, wert: ok };
  }
  if (!best) {
    const lo = eigene[0];
    return { d: Math.round(lo / raster) * raster - lo, linien: [] };
  }
  // Hilfslinie über alle Geräte, die nach dem Einrasten auf dieser Linie liegen
  const neu = kanten(box[a] + best.d, box[g]);
  const treffer = andere.filter((o) => kanten(o[a], o[g]).some((k) => Math.abs(k - best.wert) < 0.5));
  let von = box[q] - box[qg] / 2, bis = box[q] + box[qg] / 2;
  for (const o of treffer) { von = Math.min(von, o[q] - o[qg] / 2); bis = Math.max(bis, o[q] + o[qg] / 2); }
  return { d: best.d, linien: neu.some((k) => Math.abs(k - best.wert) < 0.5) ? [{ achse: a, wert: best.wert, von, bis }] : [] };
}

export function einrasten(box, andere = [], { raster = RASTER, fang = 8 } = {}) {
  const x = achse(box, andere, "x", raster, fang), y = achse(box, andere, "y", raster, fang);
  return { dx: x.d, dy: y.d, linien: [...x.linien, ...y.linien] };
}

/* Geräte, die beim Ziehen von `id` mitwandern: sein Ast, soweit nicht fest (ziele),
   sowie alle Geräte in denselben Stapeln. */
export function mitlaeufer(id, { kinder = new Map(), ziele = {}, stapel = [], dazu = [] } = {}) {
  const out = new Set([id, ...dazu]);
  const offen = [...out];
  while (offen.length) {
    const n = offen.pop();
    for (const s of stapel) if (s.ids.includes(n)) for (const m of s.ids) if (!out.has(m)) { out.add(m); offen.push(m); }
    for (const c of kinder.get(n) || []) if (!ziele[c] && !out.has(c)) { out.add(c); offen.push(c); }
  }
  return out;
}
