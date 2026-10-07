/* ── Frontplatten-Ansicht (Stil Luminex Araneo) ──────────────────────────────
   Switches erscheinen als Frontplatte mit ihrer echten Portzahl, die Ports sind
   in der Farbe ihres VLANs eingefärbt. Endgeräte hängen als Karten mit der
   Portnummer darunter. Jeder Switch bildet mit seinen Endgeräten eine Gruppe;
   Gruppen werden als Baum von oben nach unten angeordnet und lassen sich frei
   verschieben (Offsets in layout.fpOffsets). */

import { portSeiten, steckerTyp } from "./anschluesse.js";
import { astKlappbar, astVersteckt } from "./model.js";

// Endgeräte-Karte: oben Name/IP, unten eine Leiste mit den Anschlüssen (Name bis 10 Zeichen)
export const CARD_W = 204, CARD_H = 96, TAB_H = 15, CARD_PORT_Y = 46; // Anschlussleiste ab CARD_PORT_Y bis 5 px vor Unterkante
const PW = 20, PH = 18, PG = 3, BLOCK_GAP = 10, LOGO_W = 44, RIGHT_W = 30, PAD_Y = 9;
const MAX_COLS = 6, CARD_GAP_X = 16, CARD_GAP_Y = 26, CARDS_TOP = 44, LABEL_H = 18, LAYER_GAP = 90, CLUSTER_GAP = 60;

export const familie = (typ) => (/etherCON|opticalCON/i.test(typ || "") ? "ec" : /SFP/i.test(typ || "") ? "sfp" : "cu");
const SEITEN_GAP = 26; // Abstand zwischen Vorder- und Rückseite auf der Platte
const EC = 26; // etherCON-Buchse (rund, einreihig)

/* Geometrie einer Frontplatte: Ports in Blöcken je Bauform. RJ45/SFP bei mehr
   als 6 Ports zweireihig (ungerade oben, gerade unten, max. 8 Spalten je Block),
   etherCON einreihig und größer. */
export const plattenGeometrie = (dev) => {
  const alle = (dev.ports || []).filter((p) => !p.virtuell); // virtuelle Anschlüsse (Management) haben keine Buchse
  // Vorderseite links, Rückseite rechts daneben (nur wenn das Gerät Buchsen hinten hat)
  const seiteVon = portSeiten(dev);
  const hinten = alle.filter((p) => seiteVon.get(p.id) === "hinten");
  const vorne = alle.filter((p) => seiteVon.get(p.id) !== "hinten");
  const ports = [...vorne, ...hinten];
  const zweiSeiten = vorne.length > 0 && hinten.length > 0;
  const rows = Math.max(vorne.filter((p) => familie(p.typ) !== "ec").length, hinten.filter((p) => familie(p.typ) !== "ec").length) > 6 ? 2 : 1;
  const bloecke = [];
  for (const p of ports) {
    const f = familie(p.typ);
    const seite = seiteVon.get(p.id) === "hinten" ? "hinten" : "vorne";
    const last = bloecke[bloecke.length - 1];
    const max = f === "ec" ? 12 : 8 * rows;
    if (last && last.f === f && last.seite === seite && last.ports.length < max) last.ports.push(p);
    else bloecke.push({ f, seite, ports: [p] });
  }
  const gridH = rows * PH + (rows - 1) * PG;
  const innerH = Math.max(gridH, bloecke.some((b) => b.f === "ec") ? EC : 0);
  const slots = new Map();
  const seiten = []; // [{ seite, x0, x1 }] für die Beschriftung
  let x = LOGO_W;
  for (const b of bloecke) {
    if (zweiSeiten && b.seite === "hinten" && !seiten.some((t) => t.seite === "hinten")) {
      seiten.push({ seite: "vorne", x0: LOGO_W, x1: x - BLOCK_GAP });
      x += SEITEN_GAP - BLOCK_GAP + 10;
      seiten.push({ seite: "hinten", x0: x, x1: null });
    }
    const extra = (p) => ({ seite: zweiSeiten || seiteVon.get(p.id) ? (b.seite) : null, stecker: steckerTyp(p), nr: alle.indexOf(p) + 1 });
    if (b.f === "ec") {
      b.ports.forEach((p, k) => slots.set(p.id, { x: x + k * (EC + PG) + EC / 2, y: PAD_Y + innerH / 2, row: 0, w: EC, h: EC, fam: "ec", ...extra(p) }));
      x += b.ports.length * (EC + PG) - PG + BLOCK_GAP;
      continue;
    }
    const r = b.ports.length > 1 ? rows : 1;
    const top = PAD_Y + (innerH - (r * PH + (r - 1) * PG)) / 2;
    const cols = Math.ceil(b.ports.length / r);
    b.ports.forEach((p, k) => {
      const col = r === 2 ? Math.floor(k / 2) : k;
      const row = r === 2 ? k % 2 : 0;
      slots.set(p.id, { x: x + col * (PW + PG) + PW / 2, y: top + row * (PH + PG) + PH / 2, row, w: PW, h: PH, fam: b.f, ...extra(p) });
    });
    x += cols * (PW + PG) - PG + BLOCK_GAP;
  }
  if (seiten.length) seiten[seiten.length - 1].x1 = x - BLOCK_GAP;
  const w = Math.max(x - BLOCK_GAP + RIGHT_W, 150);
  const h = PAD_Y * 2 + innerH;
  return { w, h, rows, slots, seiten };
};

/* Layout: liefert pos (Mittelpunkt, Breite, Höhe je Gerät), Slot-Positionen je Switch und Bounds */
export const layoutFrontplatten = (P, T, X) => {
  const collapsed = P.layout.collapsed || {};
  const off = P.layout.fpOffsets || {};
  const pinned = P.layout.pinned || {};
  const isSw = (id) => !!X.devById.get(id)?.isSwitch;
  const kids = (id) => (collapsed[id] && astKlappbar(T, id) ? [] : T.children.get(id) || []);
  const versteckt = astVersteckt(T, collapsed);

  // Gruppen bilden: Kopf (Switch oder Endgerät-Wurzel) + alle Endgeräte darunter bis zum nächsten Switch
  const cluster = new Map(); // headId → { head, cards: [], childHeads: [] }
  const make = (head) => {
    const c = { head, cards: [], childHeads: [] };
    cluster.set(head, c);
    const st = [...kids(head)];
    const order = new Map();
    const sw = X.devById.get(head);
    if (sw?.isSwitch) sw.ports.filter((p) => !p.virtuell).forEach((p, i) => order.set(p.id, i));
    const portIdx = (id) => {
      const conn = T.treeConn.get(id);
      if (!conn) return 9999;
      const end = conn.a.dev === head ? conn.a : conn.b.dev === head ? conn.b : null;
      return end ? order.get(end.port) ?? 9999 : 9999;
    };
    const direct = st.filter((id) => !isSw(id)).sort((a, b) => portIdx(a) - portIdx(b));
    // Karten an Ports der oberen Reihe hängen über der Platte, alle anderen darunter (wie in Araneo)
    const geo = sw?.isSwitch ? plattenGeometrie(sw) : null;
    const seite = new Map();
    for (const id of direct) {
      const conn = T.treeConn.get(id);
      const end = conn && (conn.a.dev === head ? conn.a : conn.b);
      const slot = end && geo?.slots.get(end.port);
      seite.set(id, geo?.rows === 2 && slot?.row === 0 ? "oben" : "unten");
    }
    c.oben = []; c.unten = [];
    const queue = [...direct];
    while (queue.length) {
      const id = queue.shift();
      c.cards.push(id);
      c[seite.get(id)].push(id);
      for (const k of kids(id)) {
        if (isSw(k)) c.childHeads.push(k);
        else { seite.set(k, seite.get(id)); queue.push(k); }
      }
    }
    for (const k of st) if (isSw(k)) c.childHeads.push(k);
    for (const k of c.childHeads) make(k);
  };
  T.roots.forEach(make);

  // Größe jeder Gruppe
  const geo = new Map();
  for (const [head, c] of cluster) {
    const d = X.devById.get(head);
    const plate = d?.isSwitch ? plattenGeometrie(d) : { w: CARD_W, h: CARD_H, rows: 0, slots: new Map() };
    const seite = (ids) => {
      const cols = ids.length ? Math.min(ids.length, MAX_COLS) : 0;
      const rows = cols ? Math.ceil(ids.length / cols) : 0;
      return { ids, cols, rows, w: cols ? cols * (CARD_W + CARD_GAP_X) - CARD_GAP_X : 0, h: rows ? CARDS_TOP + rows * (CARD_H + TAB_H + CARD_GAP_Y) - CARD_GAP_Y : 0 };
    };
    const oben = seite(c.oben), unten = seite(c.unten);
    const w = Math.max(plate.w, oben.w, unten.w);
    const h = oben.h + plate.h + LABEL_H + unten.h;
    geo.set(head, { plate, oben, unten, w, h });
  }

  // Baum der Gruppen: Breite je Teilbaum
  const sub = new Map();
  const subW = (head) => {
    const c = cluster.get(head);
    const ch = c.childHeads.reduce((s, k) => s + subW(k), 0) + Math.max(0, c.childHeads.length - 1) * CLUSTER_GAP;
    const w = Math.max(geo.get(head).w, ch);
    sub.set(head, w);
    return w;
  };
  const pos = new Map();
  const slotsAbs = new Map();
  const place = (head, cx, top) => {
    const c = cluster.get(head), g = geo.get(head);
    const o = off[head] || { dx: 0, dy: 0 };
    const px = cx + (o.dx || 0), py = top + g.oben.h + (o.dy || 0);
    pos.set(head, { x: px, y: py + g.plate.h / 2, w: g.plate.w, h: g.plate.h, kind: X.devById.get(head)?.isSwitch ? "switch" : "card", head, hidden: versteckt.get(head) || 0 });
    if (g.plate.slots.size) {
      const m = new Map();
      for (const [pid, s] of g.plate.slots) m.set(pid, { ...s, ax: px - g.plate.w / 2 + s.x, ay: py + s.y });
      slotsAbs.set(head, m);
    }
    const reihe = (S, y0, dir) => S.ids.forEach((id, i) => {
      const col = i % S.cols, row = Math.floor(i / S.cols);
      const inRow = Math.min(S.cols, S.ids.length - row * S.cols);
      const rowW = inRow * (CARD_W + CARD_GAP_X) - CARD_GAP_X;
      const x = px - rowW / 2 + col * (CARD_W + CARD_GAP_X) + CARD_W / 2;
      const y = y0 + dir * (row * (CARD_H + TAB_H + CARD_GAP_Y) + TAB_H + CARD_H / 2) + (dir < 0 ? TAB_H : 0);
      const co = off[id] || { dx: 0, dy: 0 };
      pos.set(id, { x: x + (co.dx || 0), y: y + (co.dy || 0), w: CARD_W, h: CARD_H, kind: "card", head });
    });
    reihe(g.unten, py + g.plate.h + LABEL_H + CARDS_TOP, 1);
    reihe(g.oben, py - CARDS_TOP, -1);
    // Kind-Gruppen darunter (ohne Offset der Eltern: frei verschiebbar wie in Araneo)
    const childTop = top + g.h + LAYER_GAP;
    const total = c.childHeads.reduce((s, k) => s + sub.get(k), 0) + Math.max(0, c.childHeads.length - 1) * CLUSTER_GAP;
    let x = cx - total / 2;
    for (const k of c.childHeads) {
      place(k, x + sub.get(k) / 2, childTop);
      x += sub.get(k) + CLUSTER_GAP;
    }
  };
  let cursorX = 0, maxBottom = 0;
  T.roots.forEach((r, i) => {
    const w = subW(r);
    const cx = i === 0 ? 0 : cursorX + w / 2;
    place(r, cx, 0);
    cursorX = (i === 0 ? w / 2 : cursorX + w) + CLUSTER_GAP * 2;
  });
  for (const p of pos.values()) maxBottom = Math.max(maxBottom, p.y + p.h / 2);

  // Lose Geräte als Kartenraster darunter
  const cols = 5;
  let gi = 0;
  for (const id of T.lose) {
    const d = X.devById.get(id);
    const plate = d?.isSwitch ? plattenGeometrie(d) : null;
    const w = plate ? plate.w : CARD_W, h = plate ? plate.h : CARD_H;
    let x, y;
    if (pinned[id]) ({ x, y } = pinned[id]);
    else { x = (gi % cols - (cols - 1) / 2) * (CARD_W + 60); y = maxBottom + 120 + Math.floor(gi / cols) * (CARD_H + 60); gi++; }
    const o = off[id] || { dx: 0, dy: 0 };
    x += o.dx || 0; y += o.dy || 0;
    pos.set(id, { x, y, w, h, kind: plate ? "switch" : "card", head: id, lose: true });
    if (plate) {
      const m = new Map();
      for (const [pid, s] of plate.slots) m.set(pid, { ...s, ax: x - w / 2 + s.x, ay: y - h / 2 + s.y });
      slotsAbs.set(id, m);
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x - p.w / 2); maxX = Math.max(maxX, p.x + p.w / 2);
    minY = Math.min(minY, p.y - p.h / 2 - TAB_H); maxY = Math.max(maxY, p.y + p.h / 2 + LABEL_H + 4);
  }
  const bounds = pos.size ? { minX, minY, maxX, maxY } : { minX: -300, minY: -200, maxX: 300, maxY: 200 };
  const members = new Map([...cluster].map(([h, c]) => [h, [h, ...c.cards]]));
  return { pos, slots: slotsAbs, bounds, members, hidden: versteckt };
};

// Ankerpunkt einer Verbindung: p = Geräteposition, s = absoluter Port-Slot (oder null), toward = Gegenstelle
export const anker = (p, s, toward) => {
  if (s) {
    const unten = toward ? toward.y > s.ay : true;
    return { x: s.ax, y: unten ? s.ay + s.h / 2 : s.ay - s.h / 2, dir: unten ? 1 : -1 };
  }
  const oben = toward ? toward.y < p.y : true;
  return { x: p.x, y: oben ? p.y - p.h / 2 - (p.kind === "card" ? TAB_H : 0) : p.y + p.h / 2, dir: oben ? -1 : 1 };
};
