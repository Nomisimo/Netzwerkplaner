/* ── Anordnung auf der Zeichenfläche ────────────────────────────────────────
   Nachbearbeitung eines berechneten Layouts (Mindmap oder Frontplatten):
   - Ziele: feste Positionen je Gerät (angepinnt, oder alle Geräte bei
     ausgeschaltetem Auto-Anordnen). Nicht fixierte Geräte wandern mit dem
     nächsten fixierten Vorfahren mit, damit Äste zusammenbleiben.
   - Stapel: rein grafische Gruppen (Rack, Tower). Das erste Gerät ist der
     Anker, die übrigen stehen lückenlos darunter.
   Port-Slots der Frontplatten verschieben sich mit ihrem Gerät. */
import { NODE_W, NODE_H } from "./layout.js";

export const STAPEL_GAP = 6;
export const STAPEL_PAD = 10;
export const STAPEL_KOPF = 18;

const hoehe = (p, tab) => (p.h || NODE_H) + (p.kind === "card" ? tab : 0);
const oben = (p, tab) => p.y - (p.h || NODE_H) / 2 - (p.kind === "card" ? tab : 0);

// Anker (erstes Gerät) des Stapels, in dem ein Gerät steckt
export const stapelVon = (stapel = [], id) => stapel.find((s) => s.ids.includes(id)) || null;
export const stapelAnker = (stapel, id) => stapelVon(stapel, id)?.ids[0] || id;

/* Gerät b auf den Stapel von a legen (legt einen Stapel an, wenn a keinen hat) */
export const stapeln = (stapel = [], a, b, neueId) => {
  if (a === b) return stapel;
  let out = stapel.map((s) => ({ ...s, ids: s.ids.filter((x) => x !== b) })).filter((s) => s.ids.length > 1);
  const s = out.find((x) => x.ids.includes(a));
  if (s) s.ids = [...s.ids, b];
  else out = [...out, { id: neueId, name: "", ids: [a, b] }];
  return out;
};
/* Gezogenes Gerät oben auf den Stapel des Ziels legen. Hat das Ziel keinen
   Stapel, entsteht einer mit dem gezogenen Gerät oben. Das gezogene Gerät
   verlässt dabei seinen bisherigen Stapel; der Zielstapel bleibt erhalten. */
export const obenAufStapel = (stapel = [], gezogen, ziel, neueId) => {
  if (gezogen === ziel) return stapel;
  let out = stapel.map((s) => ({ ...s, ids: s.ids.filter((x) => x !== gezogen) }));
  const s = out.find((x) => x.ids.includes(ziel));
  if (s) s.ids = [gezogen, ...s.ids];
  else out = [...out, { id: neueId, name: "", ids: [gezogen, ziel] }];
  return out.filter((x) => x.ids.length > 1);
};
export const entstapeln = (stapel = [], id) =>
  stapel.map((s) => ({ ...s, ids: s.ids.filter((x) => x !== id) })).filter((s) => s.ids.length > 1);

export const anordnen = (L, { ziele = {}, eltern = new Map(), stapel = [], tab = 0, kopf = STAPEL_KOPF } = {}) => {
  const pos = new Map([...L.pos].map(([id, p]) => [id, { ...p }]));
  const slots = L.slots ? new Map([...L.slots].map(([id, m]) => [id, new Map(m)])) : null;
  const schiebe = (id, dx, dy) => {
    const p = pos.get(id);
    if (!p || (!dx && !dy)) return;
    p.x += dx; p.y += dy;
    const m = slots?.get(id);
    if (m) for (const [k, s] of m) m.set(k, { ...s, ax: s.ax + dx, ay: s.ay + dy });
  };

  // 1. Verschiebung je fixiertem Gerät
  const delta = new Map();
  for (const [id, z] of Object.entries(ziele)) {
    const p = pos.get(id);
    if (p && z && Number.isFinite(z.x) && Number.isFinite(z.y)) delta.set(id, { dx: z.x - p.x, dy: z.y - p.y });
  }
  // 2. Nicht fixierte Geräte folgen dem nächsten fixierten Vorfahren
  const geerbt = (id) => {
    const seen = new Set();
    let v = eltern.get(id);
    while (v && !seen.has(v)) {
      if (delta.has(v)) return delta.get(v);
      seen.add(v); v = eltern.get(v);
    }
    return null;
  };
  for (const id of pos.keys()) {
    const d = delta.get(id) || geerbt(id);
    if (d) schiebe(id, d.dx, d.dy);
  }

  // 3. Stapel: Anker bleibt, die übrigen stehen darunter
  const boxen = [];
  for (const s of stapel) {
    const ids = s.ids.filter((id) => pos.has(id));
    if (ids.length < 2) continue;
    const a = pos.get(ids[0]);
    let y = oben(a, tab) + hoehe(a, tab);
    for (const id of ids.slice(1)) {
      const p = pos.get(id);
      const soll = y + STAPEL_GAP + hoehe(p, tab) - (p.h || NODE_H) / 2;
      schiebe(id, a.x - p.x, soll - p.y);
      y += STAPEL_GAP + hoehe(p, tab);
    }
    const w = Math.max(...ids.map((id) => pos.get(id).w || NODE_W));
    const top = oben(a, tab);
    boxen.push({ id: s.id, name: s.name, ids, x: a.x - w / 2 - STAPEL_PAD, y: top - STAPEL_PAD - kopf, w: w + STAPEL_PAD * 2, h: y - top + STAPEL_PAD * 2 + kopf });
  }

  // 4. Grenzen neu
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    const w = p.w || NODE_W, h = hoehe(p, tab);
    minX = Math.min(minX, p.x - w / 2); maxX = Math.max(maxX, p.x + w / 2);
    minY = Math.min(minY, oben(p, tab)); maxY = Math.max(maxY, oben(p, tab) + h);
  }
  for (const b of boxen) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  const bounds = pos.size ? { minX, minY, maxX, maxY } : L.bounds;
  return { ...L, pos, slots: slots || L.slots, bounds, stapel: boxen };
};

// Aktuelle Positionen aller Geräte (für „Auto-Anordnen aus“)
export const positionenSichern = (L) => Object.fromEntries([...L.pos].map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }]));

/* Verbindungslinie über einen verschobenen Knickpunkt m. dir "h": Enden
   waagrecht, "v": senkrecht. form "rund" oder "eckig". */
export const knickPfad = (x1, y1, x2, y2, m, dir, form) => {
  if (form === "eckig") {
    if (dir === "h") return `M${x1},${y1} L${m.x},${y1} L${m.x},${y2} L${x2},${y2}`;
    return `M${x1},${y1} L${x1},${m.y} L${x2},${m.y} L${x2},${y2}`;
  }
  if (dir === "h") {
    const a = (x1 + m.x) / 2, b = (m.x + x2) / 2;
    return `M${x1},${y1} C${a},${y1} ${a},${m.y} ${m.x},${m.y} C${b},${m.y} ${b},${y2} ${x2},${y2}`;
  }
  const a = (y1 + m.y) / 2, b = (m.y + y2) / 2;
  return `M${x1},${y1} C${x1},${a} ${m.x},${a} ${m.x},${m.y} C${m.x},${b} ${x2},${b} ${x2},${y2}`;
};

/* Kabel nebeneinander statt übereinander. kabel: [{ id, von, nach, seite,
   start, ziel }] mit seite = Richtung ab dem Quellgerät ("h1", "h-1", "v1", "v-1"),
   start/ziel = Lage quer zur Laufrichtung (bei "h" die y-Werte).
   modus:
   - "paare":   mehrere Kabel zwischen denselben Geräten liegen parallel (runde Linien)
   - "spuren":  jedes Kabel eigene Spur, auch am Abzweig (eckige Linien, einzeln)
   - "buendel": Kabel teilen sich den Weg, parallele Kabel werden eine Linie mit Anzahl
   Ergebnis je id: { start, ende, spur } als Versatz in px, dazu anzahl und versteckt. */
export const KABEL_ABSTAND = 7;
export const kabelSpuren = (kabel, modus, { abstand = KABEL_ABSTAND, breite = 40 } = {}) => {
  const out = new Map(kabel.map((k) => [k.id, { start: 0, ende: 0, spur: 0, anzahl: 1, versteckt: false }]));
  const gruppe = (key) => { const m = new Map(); for (const k of kabel) { const g = key(k); if (!m.has(g)) m.set(g, []); m.get(g).push(k); } return [...m.values()]; };
  const paar = (k) => [k.von, k.nach].sort().join("|");
  const mitte = (i, n, a) => (i - (n - 1) / 2) * a;
  if (modus === "buendel") {
    for (const g of gruppe(paar)) g.forEach((k, i) => { if (i === 0) out.get(k.id).anzahl = g.length; else out.get(k.id).versteckt = true; });
    return out;
  }
  if (modus === "paare") {
    for (const g of gruppe(paar)) g.forEach((k, i) => { const o = out.get(k.id); o.start = o.ende = mitte(i, g.length, abstand); });
    return out;
  }
  for (const g of gruppe((k) => `${k.von}|${k.seite}`)) {
    const s = [...g].sort((a, b) => a.ziel - b.ziel || String(a.id).localeCompare(String(b.id)));
    const a = Math.min(abstand, breite / Math.max(1, s.length));
    s.forEach((k, i) => { out.get(k.id).start = mitte(i, s.length, a); });
    // Abzweig: nach oben laufende biegen von oben nach unten ab, nach unten laufende umgekehrt, so kreuzt nichts
    const hoch = s.filter((k) => k.ziel < k.start), runter = s.filter((k) => k.ziel >= k.start).reverse();
    for (const t of [hoch, runter]) t.forEach((k, i) => { out.get(k.id).spur = mitte(i, t.length, abstand); });
    const paare = new Map();
    for (const k of s) { const p = paar(k); if (!paare.has(p)) paare.set(p, []); paare.get(p).push(k); }
    for (const p of paare.values()) p.forEach((k, i) => { out.get(k.id).ende = mitte(i, p.length, a); });
  }
  return out;
};
