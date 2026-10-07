import { astKlappbar, astVersteckt } from "./model.js";
/* ── Mindmap-Layout ───────────────────────────────────────────────────────
   Core-Switch in der Mitte, Äste nach links und rechts verteilt.
   Manuelle Verschiebungen werden als Offset je Gerät gespeichert und wirken
   auf den ganzen Ast darunter (Ast zieht beim Verschieben mit). */
export const NODE_W = 224, NODE_H = 58, HGAP = 290, VGAP = 74;

export const layoutMindmap = (P, T) => {
  const collapsed = P.layout.collapsed || {};
  const offsets = P.layout.offsets || {};
  const kids = (id) => (collapsed[id] && astKlappbar(T, id) ? [] : T.children.get(id) || []);
  const pos = new Map();

  const leaves = new Map();
  const countLeaves = (id) => {
    const k = kids(id);
    const n = k.length ? k.reduce((s, c) => s + countLeaves(c), 0) : 1;
    leaves.set(id, n);
    return n;
  };

  // Platziert einen Ast; gibt [yMin, yMax] zurück
  const placeSide = (ids, depth, side, cursor) => {
    for (const id of ids) {
      const k = kids(id);
      if (!k.length) {
        pos.set(id, { x: side * depth * HGAP, y: cursor.y, depth, side });
        cursor.y += VGAP;
      } else {
        const first = cursor.y;
        placeSide(k, depth + 1, side, cursor);
        const ys = k.map((c) => pos.get(c).y);
        pos.set(id, { x: side * depth * HGAP, y: (Math.min(...ys) + Math.max(...ys)) / 2, depth, side });
        if (cursor.y === first) cursor.y += VGAP;
      }
    }
  };
  const shiftSubtree = (ids, dy) => {
    const stack = [...ids];
    while (stack.length) {
      const id = stack.pop();
      const p = pos.get(id);
      if (p) p.y += dy;
      stack.push(...kids(id));
    }
  };

  let bottom = 0;
  T.roots.forEach((rootId, ri) => {
    countLeaves(rootId);
    const ch = kids(rootId);
    let right = ch, left = [];
    if (ri === 0 && ch.length > 1) {
      const total = ch.reduce((s, c) => s + leaves.get(c), 0);
      let acc = 0, split = ch.length;
      for (let i = 0; i < ch.length; i++) {
        acc += leaves.get(ch[i]);
        if (acc >= total / 2) { split = i + 1; break; }
      }
      right = ch.slice(0, split);
      left = ch.slice(split);
    }
    const cR = { y: 0 }, cL = { y: 0 };
    placeSide(right, 1, 1, cR);
    placeSide(left, 1, -1, cL);
    const hR = cR.y - VGAP, hL = cL.y - VGAP;
    shiftSubtree(right, -hR / 2);
    shiftSubtree(left, -hL / 2);
    let top = Math.min(-hR / 2, -hL / 2, 0);
    if (ri === 0) {
      pos.set(rootId, { x: 0, y: 0, depth: 0, side: 0 });
      bottom = Math.max(hR / 2, hL / 2, 0);
    } else {
      const base = bottom + VGAP * 2 - top;
      pos.set(rootId, { x: 0, y: 0, depth: 0, side: 0 });
      shiftSubtree([rootId], base);
      bottom = base + Math.max(hR / 2, 0);
    }
  });

  // Nicht verbundene Geräte als Raster darunter
  const cols = 5;
  const gridTop = (T.roots.length ? bottom + VGAP * 2 : 0);
  const pinned = P.layout.pinned || {};
  let gi = 0;
  T.lose.forEach((id) => {
    if (pinned[id]) { pos.set(id, { x: pinned[id].x, y: pinned[id].y, depth: 0, side: 0, lose: true }); return; }
    pos.set(id, { x: (gi % cols - (cols - 1) / 2) * (NODE_W + 30), y: gridTop + Math.floor(gi / cols) * VGAP, depth: 0, side: 0, lose: true });
    gi++;
  });

  // Offsets kumulativ anwenden
  const final = new Map();
  const apply = (id, acc) => {
    const p = pos.get(id);
    if (!p) return;
    const o = offsets[id] || { dx: 0, dy: 0 };
    const t = { dx: acc.dx + (o.dx || 0), dy: acc.dy + (o.dy || 0) };
    final.set(id, { ...p, x: p.x + t.dx, y: p.y + t.dy });
    for (const c of kids(id)) apply(c, t);
  };
  for (const r of T.roots) apply(r, { dx: 0, dy: 0 });
  for (const id of T.lose) apply(id, { dx: 0, dy: 0 });

  const hidden = astVersteckt(T, collapsed);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of final.values()) {
    minX = Math.min(minX, p.x - NODE_W / 2); maxX = Math.max(maxX, p.x + NODE_W / 2);
    minY = Math.min(minY, p.y - NODE_H / 2); maxY = Math.max(maxY, p.y + NODE_H / 2);
  }
  const bounds = final.size ? { minX, minY, maxX, maxY } : { minX: -300, minY: -200, maxX: 300, maxY: 200 };
  return { pos: final, hidden, bounds };
};
