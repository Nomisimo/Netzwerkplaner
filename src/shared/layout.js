import { astKlappbar, astVersteckt } from "./model.js";
import { STAPEL_GAP, STAPEL_PAD } from "./anordnung.js";
/* ── Mindmap-Layout ───────────────────────────────────────────────────────
   Immer automatisch: der Hauptswitch in der Mitte, die Äste nach links und rechts
   verteilt, jede Ebene eine eigene Spalte. Von Hand verschoben wird hier nichts.

   Baustein des Layouts ist die Einheit: ein Gerät oder ein ganzer Stapel (Rack, Tower).
   Ein Stapel steht dort, wo sein am höchsten im Baum hängendes Gerät stehen würde, und
   nimmt so viel Platz ein, wie er braucht. Die Geräte, die an seinen Mitgliedern hängen,
   stehen in der Spalte dahinter. So überlappt nichts, und jede Verbindung im Baum läuft
   von einer Spalte in die nächste.

   - Geschwister stehen in Port-Reihenfolge des Elternteils untereinander (Port 1 oben).
   - Ein Elternteil steht mittig vor seinen Kindern.
   - Jeder Ast belegt einen eigenen waagerechten Streifen über alle Spalten hinweg.
   - Nicht verbundene Geräte stehen als Raster darunter. */
export const NODE_W = 224, NODE_H = 58, HGAP = 290, VGAP = 74;
const ABSTAND_Y = VGAP - NODE_H; // zwischen zwei Einheiten untereinander
const ABSTAND_X = HGAP - NODE_W; // zwischen zwei Spalten
const RASTER_SPALTEN = 5;

export const layoutMindmap = (P, T) => {
  const collapsed = P.layout?.collapsed || {};
  const kids = (id) => (collapsed[id] && astKlappbar(T, id) ? [] : T.children.get(id) || []);

  // Sichtbare Geräte und ihre Tiefe im Baum
  const tiefe = new Map();
  const eltern = new Map();
  const reihe = []; // Breitensuche: Wurzeln, dann Ebene für Ebene
  for (const r of T.roots) if (!tiefe.has(r)) { tiefe.set(r, 0); reihe.push(r); }
  for (let i = 0; i < reihe.length; i++) {
    for (const k of kids(reihe[i])) if (!tiefe.has(k)) { tiefe.set(k, tiefe.get(reihe[i]) + 1); eltern.set(k, reihe[i]); reihe.push(k); }
  }
  const sichtbar = (id) => tiefe.has(id) || T.lose.includes(id);

  // Einheiten: sichtbare Stapel (mind. zwei sichtbare Geräte) oder einzelne Geräte
  const einheitVon = new Map();
  const einheiten = [];
  for (const s of P.layout?.stapel || []) {
    const ids = s.ids.filter((id) => sichtbar(id) && !einheitVon.has(id));
    if (ids.length < 2) continue;
    const quer = s.richtung === "h";
    const e = { ids, quer, w: 0, h: 0 };
    e.w = quer ? ids.length * NODE_W + (ids.length - 1) * STAPEL_GAP + 2 * STAPEL_PAD : NODE_W + 2 * STAPEL_PAD;
    e.h = quer ? NODE_H + 2 * STAPEL_PAD : ids.length * NODE_H + (ids.length - 1) * STAPEL_GAP + 2 * STAPEL_PAD;
    einheiten.push(e);
    for (const id of ids) einheitVon.set(id, e);
  }
  for (const id of [...reihe, ...T.lose]) if (!einheitVon.has(id)) {
    const e = { ids: [id], quer: false, w: NODE_W, h: NODE_H };
    einheiten.push(e);
    einheitVon.set(id, e);
  }

  /* Baum der Einheiten: eine Einheit hängt an der Einheit des Elternteils ihres am höchsten
     hängenden Geräts. Die Tiefe sinkt dabei immer, so entstehen keine Kreise. Die Kinder
     kommen in der Reihenfolge der Breitensuche, also in Port-Reihenfolge je Elternteil. */
  const minTiefe = (e) => Math.min(...e.ids.map((id) => tiefe.get(id) ?? Infinity));
  const kinder = new Map(einheiten.map((e) => [e, []]));
  const hatEltern = new Set();
  for (const id of reihe) {
    const e = einheitVon.get(id);
    if (hatEltern.has(e) || tiefe.get(id) !== minTiefe(e)) continue;
    const pe = eltern.has(id) ? einheitVon.get(eltern.get(id)) : null;
    if (!pe || pe === e) continue;
    hatEltern.add(e);
    kinder.get(pe).push(e);
  }
  const wurzeln = [...new Set(reihe.map((id) => einheitVon.get(id)))].filter((e) => !hatEltern.has(e) && Number.isFinite(minTiefe(e)));

  // Höhe eines ganzen Asts (für das Aufteilen nach links und rechts)
  const astHoehe = new Map();
  const hoeheVon = (e) => {
    if (astHoehe.has(e)) return astHoehe.get(e);
    const k = kinder.get(e);
    const summe = k.reduce((s, c) => s + hoeheVon(c), 0) + Math.max(0, k.length - 1) * ABSTAND_Y;
    const h = Math.max(e.h, summe);
    astHoehe.set(e, h);
    return h;
  };

  const lage = new Map(); // Einheit → { y (Mitte), ebene, seite }
  const verschiebe = (e, dy) => {
    const st = [e];
    while (st.length) { const x = st.pop(); lage.get(x).y += dy; st.push(...kinder.get(x)); }
  };
  // Einen Ast ab cursor.y platzieren; danach steht cursor.y unter dem ganzen Ast
  const platziere = (e, ebene, seite, cursor) => {
    const start = cursor.y;
    const k = kinder.get(e);
    if (!k.length) {
      lage.set(e, { y: start + e.h / 2, ebene, seite });
      cursor.y = start + e.h + ABSTAND_Y;
      return;
    }
    for (const c of k) platziere(c, ebene + 1, seite, cursor);
    const mitte = (lage.get(k[0]).y + lage.get(k[k.length - 1]).y) / 2;
    lage.set(e, { y: mitte, ebene, seite });
    // Ragt die Einheit über den Ast der Kinder hinaus, rückt der ganze Ast nach unten
    const dy = Math.max(0, start - (mitte - e.h / 2));
    if (dy) { verschiebe(e, dy); cursor.y += dy; }
    cursor.y = Math.max(cursor.y, lage.get(e).y + e.h / 2 + ABSTAND_Y);
  };

  // Spaltenbreite je Seite und Ebene: so breit wie die breiteste Einheit darin
  const gruppen = []; // je Wurzel alle Einheiten, für das Untereinanderstellen
  wurzeln.forEach((w, wi) => {
    const k = kinder.get(w);
    let rechts = k, links = [];
    if (wi === 0 && k.length > 1) {
      const gesamt = k.reduce((s, c) => s + hoeheVon(c), 0);
      let summe = 0, teil = k.length;
      for (let i = 0; i < k.length; i++) {
        summe += hoeheVon(k[i]);
        if (summe >= gesamt / 2) { teil = i + 1; break; }
      }
      rechts = k.slice(0, teil);
      links = k.slice(teil);
    }
    const cR = { y: 0 }, cL = { y: 0 };
    for (const c of rechts) platziere(c, 1, 1, cR);
    for (const c of links) platziere(c, 1, -1, cL);
    const hR = Math.max(0, cR.y - ABSTAND_Y), hL = Math.max(0, cL.y - ABSTAND_Y);
    for (const c of rechts) verschiebe(c, -hR / 2);
    for (const c of links) verschiebe(c, -hL / 2);
    lage.set(w, { y: 0, ebene: 0, seite: 0 });
    gruppen.push(w);
  });

  /* Spalten je Seite und Ebene, so breit wie die breiteste Einheit darin. Einheiten stehen bündig
     an der Innenkante ihrer Spalte (rechts: links bündig, links: rechts bündig), so bleibt der
     Zwischenraum zur vorigen Spalte frei für die Kabel. */
  const breite = new Map(); // "seite:ebene" → max. Breite
  for (const [e, l] of lage) {
    const key = l.ebene ? `${l.seite}:${l.ebene}` : "0:0";
    breite.set(key, Math.max(breite.get(key) || 0, e.w));
  }
  const innenkante = (seite, ebene) => {
    let x = (breite.get("0:0") || NODE_W) / 2 + ABSTAND_X;
    for (let i = 1; i < ebene; i++) x += (breite.get(`${seite}:${i}`) || NODE_W) + ABSTAND_X;
    return x;
  };
  const mitteX = (e, l) => (l.x ?? (l.ebene ? l.seite * (innenkante(l.seite, l.ebene) + e.w / 2) : 0));

  // Mehrere Netze (Inseln) untereinander
  const astVon = (w) => { const out = [w]; for (let i = 0; i < out.length; i++) out.push(...kinder.get(out[i])); return out; };
  let unten = null;
  for (const w of gruppen) {
    const alle = astVon(w);
    const oben = Math.min(...alle.map((e) => lage.get(e).y - e.h / 2));
    if (unten !== null) verschiebe(w, unten + VGAP * 2 - oben);
    unten = Math.max(...alle.map((e) => lage.get(e).y + e.h / 2));
  }

  // Nicht verbundene Geräte (und Stapel daraus) als Raster darunter
  const lose = einheiten.filter((e) => !lage.has(e));
  if (lose.length) {
    const zellB = Math.max(...lose.map((e) => e.w)) + 30;
    let y = unten === null ? 0 : unten + VGAP * 2;
    for (let i = 0; i < lose.length; i += RASTER_SPALTEN) {
      const zeile = lose.slice(i, i + RASTER_SPALTEN);
      const h = Math.max(...zeile.map((e) => e.h));
      zeile.forEach((e, j) => lage.set(e, { y: y + e.h / 2, ebene: 0, seite: 0, lose: true, x: (j - (RASTER_SPALTEN - 1) / 2) * zellB }));
      y += h + ABSTAND_Y;
    }
  }

  // Geräte in ihren Einheiten: Stapel wie in anordnen (erstes Gerät oben bzw. links)
  const pos = new Map();
  for (const [e, l] of lage) {
    const cx = mitteX(e, l);
    const oben = l.y - e.h / 2, links = cx - e.w / 2;
    e.ids.forEach((id, i) => {
      const einzeln = e.ids.length === 1;
      const x = einzeln || !e.quer ? cx : links + STAPEL_PAD + NODE_W / 2 + i * (NODE_W + STAPEL_GAP);
      const y = einzeln ? l.y : e.quer ? oben + STAPEL_PAD + NODE_H / 2 : oben + STAPEL_PAD + NODE_H / 2 + i * (NODE_H + STAPEL_GAP);
      pos.set(id, { x, y, depth: l.ebene, side: l.seite, ...(l.lose ? { lose: true } : {}) });
    });
  }

  const hidden = astVersteckt(T, collapsed);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [e, l] of lage) {
    const cx = mitteX(e, l);
    minX = Math.min(minX, cx - e.w / 2); maxX = Math.max(maxX, cx + e.w / 2);
    minY = Math.min(minY, l.y - e.h / 2); maxY = Math.max(maxY, l.y + e.h / 2);
  }
  const bounds = pos.size ? { minX, minY, maxX, maxY } : { minX: -300, minY: -200, maxX: 300, maxY: 200 };
  return { pos, hidden, bounds };
};
