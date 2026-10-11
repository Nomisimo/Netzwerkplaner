/* ── Kabelwege in der Anschluss-Ansicht ───────────────────────────────────────
   Kabel laufen rechtwinklig von Buchse zu Buchse. Sie verlassen ein Gerät
   senkrecht (nach oben oder unten) und laufen um andere Geräte herum, mit
   Mindestabstand, damit sie neben den Geräten sichtbar bleiben.
   Ein Weg ist eine Punktliste [a, …, b]; a und b sind die Anker an den Geräten. */

const EPS = 0.5;

// Schneidet die achsparallele Strecke p→q das Rechteck h (innen, ohne Rand)?
export const streckeTrifft = (p, q, h) => {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  return x0 < h.x1 - EPS && x1 > h.x0 + EPS && y0 < h.y1 - EPS && y1 > h.y0 + EPS;
};

// Hindernisse um `abstand` vergrößert
export const aufblasen = (hindernisse, abstand) => hindernisse.map((h) => ({ ...h, x0: h.x0 - abstand, x1: h.x1 + abstand, y0: h.y0 - abstand, y1: h.y1 + abstand }));

/* Läuft der Weg durch ein Hindernis? Das eigene Gerät eines Endes zählt nur für
   die Strecken, die nicht an diesem Ende hängen (das Kabel verlässt es ja). */
export const wegFrei = (pts, hindernisse, ausnahmen = []) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const h of hindernisse) {
      if (i === 0 && h.dev === ausnahmen[0]) continue;
      if (i === pts.length - 2 && h.dev === ausnahmen[1]) continue;
      if (streckeTrifft(pts[i], pts[i + 1], h)) return false;
    }
  }
  return true;
};

// Punkte auf einer Geraden zusammenfassen, doppelte entfernen
export const vereinfachen = (pts) => {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (l && Math.abs(l.x - p.x) < EPS && Math.abs(l.y - p.y) < EPS) continue;
    if (out.length >= 2) {
      const k = out[out.length - 2];
      if ((Math.abs(k.x - l.x) < EPS && Math.abs(l.x - p.x) < EPS) || (Math.abs(k.y - l.y) < EPS && Math.abs(l.y - p.y) < EPS)) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
};

// Kleiner Binär-Heap für A*
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(f, v) {
    const a = this.a; a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top[1];
  }
}

/* Weg um Hindernisse herum (A* auf einem Raster aus den Kanten der Hindernisse).
   a, b: { x, y, dir } mit dir = ±1 (Austritt nach unten/oben); devs: [Gerät a, Gerät b];
   belegt: Strecken anderer Kabel (werden gemieden, damit Kabel nebeneinander laufen).
   Ergebnis: Punktliste oder null, wenn kein Weg gefunden wurde. */
export const wegSuchen = (a, b, hindernisse, { abstand = 10, devs = [], belegt = [], bahnAbstand = 5, knickKosten = 30, rand = 400, maxKnoten = 60000 } = {}) => {
  // Erst senkrecht aus dem eigenen Gerät heraus (Switch-Ports liegen mitten auf der Platte)
  const raus = (p, dev) => {
    const d = p.dir || 1, h = hindernisse.find((x) => x.dev === dev && p.x >= x.x0 && p.x <= x.x1);
    const y = p.y + d * abstand;
    return { x: p.x, y: !h ? y : d > 0 ? Math.max(y, h.y1 + abstand) : Math.min(y, h.y0 - abstand) };
  };
  const sa = raus(a, devs[0]), sb = raus(b, devs[1]);
  const box = { x0: Math.min(sa.x, sb.x) - rand, x1: Math.max(sa.x, sb.x) + rand, y0: Math.min(sa.y, sb.y) - rand, y1: Math.max(sa.y, sb.y) + rand };
  const nah = hindernisse.filter((h) => h.x1 > box.x0 && h.x0 < box.x1 && h.y1 > box.y0 && h.y0 < box.y1);
  const hb = aufblasen(nah, abstand);
  // Rasterlinien: Endpunkte, Hinderniskanten mit Abstand, dazu je eine Ausweichbahn daneben
  const xs = new Set([sa.x, sb.x]), ys = new Set([sa.y, sb.y]);
  for (const h of hb) {
    for (const k of [0, 1]) { xs.add(h.x0 - k * bahnAbstand); xs.add(h.x1 + k * bahnAbstand); ys.add(h.y0 - k * bahnAbstand); ys.add(h.y1 + k * bahnAbstand); }
  }
  // Mitten zwischen benachbarten Linien: Kabel laufen gern mittig durch Lücken
  const mitMitten = (s) => {
    const l = [...s].sort((p, q) => p - q);
    const out = [...l];
    for (let i = 0; i + 1 < l.length; i++) if (l[i + 1] - l[i] > 3 * bahnAbstand) out.push((l[i] + l[i + 1]) / 2);
    return [...new Set(out)].sort((p, q) => p - q);
  };
  const X = mitMitten(xs).filter((x) => x >= box.x0 && x <= box.x1), Y = mitMitten(ys).filter((y) => y >= box.y0 && y <= box.y1);
  if (X.length * Y.length > maxKnoten) return null;
  const xi = new Map(X.map((v, i) => [v, i])), yi = new Map(Y.map((v, i) => [v, i]));
  const nx = X.length;
  // Gesperrte Knoten (im Inneren eines Hindernisses), Strecken prüfen wir beim Ausdehnen
  const sperre = (x, y) => hb.some((h) => x > h.x0 + EPS && x < h.x1 - EPS && y > h.y0 + EPS && y < h.y1 - EPS);
  const frei = (p, q) => !hb.some((h) => streckeTrifft(p, q, h));
  // Bereits belegte Strecken anderer Kabel: Aufschlag, wenn ein Schritt auf ihnen liegt
  const aufBelegt = (p, q) => {
    let n = 0;
    for (const s of belegt) {
      if (Math.abs(p.y - q.y) < EPS && Math.abs(s.a.y - s.b.y) < EPS && Math.abs(s.a.y - p.y) < 2) {
        if (Math.min(p.x, q.x) < Math.max(s.a.x, s.b.x) && Math.max(p.x, q.x) > Math.min(s.a.x, s.b.x)) n++;
      } else if (Math.abs(p.x - q.x) < EPS && Math.abs(s.a.x - s.b.x) < EPS && Math.abs(s.a.x - p.x) < 2) {
        if (Math.min(p.y, q.y) < Math.max(s.a.y, s.b.y) && Math.max(p.y, q.y) > Math.min(s.a.y, s.b.y)) n++;
      }
    }
    return n;
  };
  const start = yi.get(sa.y) * nx + xi.get(sa.x), ziel = yi.get(sb.y) * nx + xi.get(sb.x);
  if (sperre(sa.x, sa.y) || sperre(sb.x, sb.y)) return null;
  // Zustand: Knoten * 2 + Richtung (0 = waagrecht, 1 = senkrecht)
  const g = new Map(), von = new Map();
  const h0 = (k) => Math.abs(X[k % nx] - sb.x) + Math.abs(Y[Math.floor(k / nx)] - sb.y);
  const heap = new Heap();
  const s0 = start * 2 + 1; // Kabel verlässt das Gerät senkrecht
  g.set(s0, 0); heap.push(h0(start), s0);
  let ende = null;
  const fertig = new Set();
  while (heap.size) {
    const z = heap.pop();
    if (fertig.has(z)) continue;
    fertig.add(z);
    const k = z >> 1, r = z & 1;
    if (k === ziel) { ende = z; if (r === 1) break; continue; }
    const ix = k % nx, iy = Math.floor(k / nx);
    const p = { x: X[ix], y: Y[iy] };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jx >= nx || jy < 0 || jy >= Y.length) continue;
      const q = { x: X[jx], y: Y[jy] };
      if (sperre(q.x, q.y) || !frei(p, q)) continue;
      const r2 = dy ? 1 : 0;
      const len = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
      const kosten = len * (1 + 2 * aufBelegt(p, q)) + (r2 !== r ? knickKosten : 0);
      const z2 = (jy * nx + jx) * 2 + r2;
      const ng = g.get(z) + kosten;
      if (ng < (g.get(z2) ?? Infinity)) { g.set(z2, ng); von.set(z2, z); heap.push(ng + h0(jy * nx + jx), z2); }
    }
  }
  if (ende == null) return null;
  // Am Ziel lieber senkrecht ankommen (das Kabel geht ja senkrecht in die Buchse)
  const zs = ziel * 2 + 1;
  if (g.has(zs) && g.get(zs) <= (g.get(ziel * 2) ?? Infinity) + knickKosten) ende = zs;
  const pfad = [];
  for (let z = ende; z != null; z = von.get(z)) { const k = z >> 1; pfad.push({ x: X[k % nx], y: Y[Math.floor(k / nx)] }); }
  pfad.reverse();
  return vereinfachen([{ x: a.x, y: a.y }, ...pfad, { x: b.x, y: b.y }]);
};

/* Standardweg: senkrecht raus, waagrecht auf Höhe `bahn`, senkrecht rein */
export const standardWeg = (a, b, bahn) => vereinfachen([{ x: a.x, y: a.y }, { x: a.x, y: bahn }, { x: b.x, y: bahn }, { x: b.x, y: b.y }]);

/* Von Hand gesetzter Verlauf: gespeicherte Zwischenpunkte, an die aktuellen Enden
   angepasst (erste und letzte Strecke bleiben senkrecht an ihrer Buchse). */
export const handWeg = (a, b, punkte) => {
  if (!punkte?.length) return null;
  const p = punkte.map(([x, y]) => ({ x, y }));
  p[0] = { ...p[0], x: a.x };
  p[p.length - 1] = { ...p[p.length - 1], x: b.x };
  if (p.length === 1) p.push({ x: b.x, y: p[0].y });
  return vereinfachen([{ x: a.x, y: a.y }, ...p, { x: b.x, y: b.y }]);
};

// Gespeicherte Form: nur die Zwischenpunkte, gerundet
export const wegSpeichern = (pts) => pts.slice(1, -1).map((p) => [Math.round(p.x), Math.round(p.y)]);

/* Mittlere Strecke k (zwischen pts[k] und pts[k+1]) quer verschieben. Die erste und die
   letzte Strecke hängen an den Buchsen und bleiben. */
export const streckeVerschieben = (pts, k, d) => {
  if (k < 1 || k >= pts.length - 2) return pts;
  const out = pts.map((p) => ({ ...p }));
  const waag = Math.abs(out[k].y - out[k + 1].y) < EPS;
  if (waag) { out[k].y += d; out[k + 1].y += d; } else { out[k].x += d; out[k + 1].x += d; }
  return out;
};

/* Knick einfügen: eine mittlere Strecke bekommt in ihrer Mitte einen Versatz, aus einer
   Strecke werden drei, mit zwei neuen Ecken, die sich wieder einzeln verschieben lassen.
   Ein gerades Kabel bekommt einen Versatz im mittleren Drittel. */
export const knickEinfuegen = (pts, k, versatz = 30) => {
  if (pts.length === 2) {
    const [a, b] = pts;
    if (Math.abs(a.x - b.x) > EPS) return pts;
    const y1 = a.y + (b.y - a.y) / 3, y2 = a.y + (2 * (b.y - a.y)) / 3;
    return [a, { x: a.x, y: y1 }, { x: a.x + versatz, y: y1 }, { x: a.x + versatz, y: y2 }, { x: b.x, y: y2 }, b];
  }
  if (k < 1 || k >= pts.length - 2) return pts;
  const p = pts[k], q = pts[k + 1];
  const out = pts.map((x) => ({ ...x }));
  if (Math.abs(p.y - q.y) < EPS) {
    const mx = (p.x + q.x) / 2;
    out.splice(k + 1, 1, { x: mx, y: p.y }, { x: mx, y: p.y + versatz }, { x: q.x, y: p.y + versatz });
  } else {
    const my = (p.y + q.y) / 2;
    out.splice(k + 1, 1, { x: p.x, y: my }, { x: p.x + versatz, y: my }, { x: p.x + versatz, y: q.y });
  }
  return vereinfachen(out);
};

// Länge eines Wegs und Punkt auf halber Länge einer Strecke (für Griffe)
export const streckenMitten = (pts) => pts.slice(0, -1).map((p, k) => ({ k, x: (p.x + pts[k + 1].x) / 2, y: (p.y + pts[k + 1].y) / 2, waag: Math.abs(p.y - pts[k + 1].y) < EPS, len: Math.abs(p.x - pts[k + 1].x) + Math.abs(p.y - pts[k + 1].y) }));

// Nächste Strecke zu einem Punkt (für Ziehen direkt an der Linie)
export const naechsteStrecke = (pts, w) => {
  let best = null;
  for (let k = 0; k + 1 < pts.length; k++) {
    const p = pts[k], q = pts[k + 1];
    const x = Math.max(Math.min(p.x, q.x), Math.min(Math.max(p.x, q.x), w.x)), y = Math.max(Math.min(p.y, q.y), Math.min(Math.max(p.y, q.y), w.y));
    const d = Math.hypot(w.x - x, w.y - y);
    if (!best || d < best.d) best = { k, d };
  }
  return best;
};

/* SVG-Pfad aus Punkten: eckig, oder mit abgerundeten Ecken (Radius r) */
export const wegPfad = (pts, r = 0) => {
  if (pts.length < 2) return "";
  if (!r) return "M" + pts.map((p) => `${p.x},${p.y}`).join(" L");
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], q = pts[i], n = pts[i + 1];
    const l1 = Math.hypot(q.x - p.x, q.y - p.y), l2 = Math.hypot(n.x - q.x, n.y - q.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = { x: q.x - ((q.x - p.x) / (l1 || 1)) * rr, y: q.y - ((q.y - p.y) / (l1 || 1)) * rr };
    const b = { x: q.x + ((n.x - q.x) / (l2 || 1)) * rr, y: q.y + ((n.y - q.y) / (l2 || 1)) * rr };
    d += ` L${a.x},${a.y} Q${q.x},${q.y} ${b.x},${b.y}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l.x},${l.y}`;
};

// Mitte eines Wegs nach Länge (für Beschriftungen und Griffe)
export const wegMitte = (pts) => {
  const m = streckenMitten(pts);
  const ges = m.reduce((s, x) => s + x.len, 0);
  let acc = 0;
  for (let k = 0; k < m.length; k++) {
    if (acc + m[k].len >= ges / 2) {
      const f = m[k].len ? (ges / 2 - acc) / m[k].len : 0, p = pts[k], q = pts[k + 1];
      return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
    }
    acc += m[k].len;
  }
  return pts[0];
};
