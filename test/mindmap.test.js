import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyProject, buildIndex, buildTree, subtreeIds } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { layoutMindmap, NODE_W, NODE_H } from "../src/shared/layout.js";
import { anordnen } from "../src/shared/anordnung.js";

/* Erprobung des Mindmap-Layouts: viele zufällige Netze (Bäume, Ketten, Stapel, Inseln,
   eingeklappte Äste, lose Geräte) und für jedes die Regeln, die den Plan lesbar halten. */

// Reproduzierbarer Zufall
const zufall = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const netz = (seed) => {
  const r = zufall(seed);
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));
  const P = emptyProject({ mitVlans: false });
  let n = 0;
  const geraet = (sw, ports) => {
    const id = `g${n++}`;
    const d = { id, name: `${sw ? "SW" : "Gerät"} ${n}`, typ: sw ? "switch_managed" : "pc", isSwitch: sw, kategorie: "Ton", bereich: "", hersteller: "", modell: "",
      ports: Array.from({ length: ports }, (_, i) => ({ id: `${id}p${i}`, name: String(i + 1), typ: "RJ45" })), protokolle: [], felder: [] };
    P.geraete.push(d);
    return d;
  };
  const frei = new Map();
  const port = (d) => { const i = frei.get(d.id) || 0; frei.set(d.id, i + 1); return d.ports[i]?.id; };
  const kabel = (a, b) => { const pa = port(a), pb = port(b); if (pa && pb) P.verbindungen.push({ id: `c${P.verbindungen.length}`, a: { dev: a.id, port: pa }, b: { dev: b.id, port: pb }, kabel: "cat6" }); };
  // Switch-Baum
  const tiefe = int(1, 4);
  const ast = (sw, t) => {
    const k = int(0, t ? 7 : 12);
    for (let i = 0; i < k; i++) {
      if (t < tiefe && r() < 0.3) { const s = geraet(true, 24); kabel(sw, s); ast(s, t + 1); }
      else {
        const e = geraet(false, 2); kabel(sw, e);
        if (r() < 0.12) { let v = e; for (let j = int(1, 3); j > 0; j--) { const w = geraet(false, 2); kabel(v, w); v = w; } } // Daisy-Chain
      }
    }
  };
  const core = geraet(true, 48);
  ast(core, 0);
  // weitere Insel (z. B. Dante Secondary) mit Querverbindung
  if (r() < 0.3) { const s = geraet(true, 24); for (let i = int(1, 5); i > 0; i--) kabel(s, geraet(false, 2)); if (r() < 0.5) kabel(s, P.geraete[int(1, P.geraete.length - 2)]); }
  // lose Geräte
  for (let i = int(0, 7); i > 0; i--) geraet(false, 1);
  // Stapel: oft Geschwister, manchmal Switch mit seinen Geräten, manchmal quer durch den Baum
  const ids = P.geraete.map((d) => d.id);
  const belegt = new Set();
  P.layout.stapel = [];
  for (let s = int(0, 4); s > 0; s--) {
    const m = [];
    for (let i = int(2, 5); i > 0; i--) { const id = ids[int(0, ids.length - 1)]; if (!belegt.has(id)) { belegt.add(id); m.push(id); } }
    if (m.length > 1) P.layout.stapel.push({ id: `s${s}`, name: "", ids: m, ...(r() < 0.3 ? { richtung: "h" } : {}) });
  }
  // eingeklappte Äste
  P.layout.collapsed = {};
  for (const d of P.geraete) if (r() < 0.06) P.layout.collapsed[d.id] = true;
  return P;
};

const box = (p) => ({ x0: p.x - NODE_W / 2, x1: p.x + NODE_W / 2, y0: p.y - NODE_H / 2, y1: p.y + NODE_H / 2 });
const schneiden = (a, b, luft = 0) => a.x0 < b.x1 + luft && b.x0 < a.x1 + luft && a.y0 < b.y1 + luft && b.y0 < a.y1 + luft;

const pruefe = (P, name) => {
  const X = buildIndex(P);
  const T = buildTree(P, X);
  const L = layoutMindmap(P, T);
  const stapel = P.layout.stapel || [];
  const imStapel = new Map(); for (const s of stapel) for (const id of s.ids) imStapel.set(id, s.id);

  // 1. Jedes sichtbare Gerät hat einen Platz, eingeklappte nicht
  const versteckt = new Set();
  for (const id of Object.keys(P.layout.collapsed || {})) if (P.layout.collapsed[id] && L.hidden.has(id)) for (const k of subtreeIds(T, id).slice(1)) versteckt.add(k);
  for (const d of P.geraete) assert.equal(L.pos.has(d.id), !versteckt.has(d.id), `${name}: ${d.name} ${versteckt.has(d.id) ? "versteckt, hat aber Platz" : "ohne Platz"}`);
  for (const p of L.pos.values()) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name}: Position nicht endlich`);

  // 2. Stapel nachrechnen wie die Oberfläche (anordnen): nichts darf sich mehr bewegen
  const A = anordnen(L, { stapel, tab: 0, kopf: 0 });
  for (const [id, p] of L.pos) { const q = A.pos.get(id); assert.ok(Math.abs(p.x - q.x) < 0.01 && Math.abs(p.y - q.y) < 0.01, `${name}: Stapel verschiebt ${id}`); }

  // 3. Keine Überlappung: Geräte untereinander (mind. 4 px Luft), Stapelrahmen mit fremden Geräten und anderen Rahmen
  const liste = [...L.pos].map(([id, p]) => ({ id, b: box(p) }));
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++)
    assert.ok(!schneiden(liste[i].b, liste[j].b, 4), `${name}: ${liste[i].id} überlappt ${liste[j].id}`);
  const rahmen = A.stapel.map((s) => ({ s, b: { x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.h } }));
  for (const { s, b } of rahmen) {
    for (const { id, b: g } of liste) if (!s.ids.includes(id)) assert.ok(!schneiden(b, g), `${name}: Stapel ${s.id} liegt über ${id}`);
    for (const o of rahmen) if (o.s !== s) assert.ok(!schneiden(b, o.b), `${name}: Stapel ${s.id} überlappt Stapel ${o.s.id}`);
  }

  // 4. Hierarchie: jedes Kind eine Spalte weiter außen, auf der Seite des Elternteils;
  //    Elternteil mittig vor seinen Kindern; Geschwister in Port-Reihenfolge von oben nach unten
  for (const [p, ks] of T.children) {
    const pp = L.pos.get(p);
    if (!pp || imStapel.has(p)) continue;
    const sichtbar = ks.filter((k) => L.pos.has(k) && !imStapel.has(k));
    for (const k of sichtbar) {
      const pk = L.pos.get(k);
      assert.equal(pk.depth, pp.depth + 1, `${name}: ${k} nicht in der Spalte hinter ${p}`);
      if (pp.side) assert.equal(pk.side, pp.side, `${name}: ${k} auf der anderen Seite als ${p}`);
      assert.ok(Math.abs(pk.x) - NODE_W / 2 > Math.abs(pp.x) + NODE_W / 2, `${name}: ${k} nicht außerhalb von ${p}`);
    }
    if (sichtbar.length === ks.length && ks.length) {
      const ys = ks.map((k) => L.pos.get(k).y);
      assert.ok(pp.y >= Math.min(...ys) - 0.01 && pp.y <= Math.max(...ys) + 0.01, `${name}: ${p} nicht mittig vor seinen Kindern`);
      const proSeite = (s) => ks.filter((k) => L.pos.get(k).side === s).map((k) => L.pos.get(k).y);
      for (const s of [1, -1]) { const y = proSeite(s); assert.deepEqual(y, [...y].sort((a, b) => a - b), `${name}: Kinder von ${p} nicht in Port-Reihenfolge`); }
    }
  }

  // 5. Spalten: je Seite liegen die Ebenen getrennt nebeneinander, so laufen Kabel nie durch ein Gerät
  for (const s of [1, -1]) {
    const ebenen = new Map();
    for (const [id, p] of L.pos) if (p.side === s && !imStapel.has(id) && !p.lose) {
      const b = box(p), e = ebenen.get(p.depth) || { min: Infinity, max: -Infinity };
      ebenen.set(p.depth, { min: Math.min(e.min, s > 0 ? b.x0 : -b.x1), max: Math.max(e.max, s > 0 ? b.x1 : -b.x0) });
    }
    const t = [...ebenen].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < t.length; i++) assert.ok(t[i][1].min > t[i - 1][1].max, `${name}: Spalte ${t[i][0]} überlappt Spalte ${t[i - 1][0]}`);
  }

  // 5b. Kabel im Baum: im Streifen zwischen Elternteil und Kind steht kein anderes Gerät und kein Stapel
  const hindernisse = [...liste.map(({ id, b }) => ({ ids: [id], b })), ...rahmen.map(({ s, b }) => ({ ids: s.ids, b }))];
  for (const [p, ks] of T.children) {
    const pp = L.pos.get(p);
    if (!pp || imStapel.has(p) || !pp.side && ks.some((k) => imStapel.has(k))) continue;
    for (const k of ks) {
      const pk = L.pos.get(k);
      if (!pk || imStapel.has(k)) continue;
      const s = pk.side;
      const x0 = s > 0 ? pp.x + NODE_W / 2 : pk.x + NODE_W / 2, x1 = s > 0 ? pk.x - NODE_W / 2 : pp.x - NODE_W / 2;
      const streifen = { x0: x0 + 0.5, x1: x1 - 0.5, y0: Math.min(pp.y, pk.y), y1: Math.max(pp.y, pk.y) };
      for (const h of hindernisse) if (!h.ids.includes(p) && !h.ids.includes(k)) assert.ok(!schneiden(streifen, h.b), `${name}: Kabel ${p} → ${k} läuft durch ${h.ids.join("+")}`);
    }
  }

  // 6. Gleiches Projekt, gleiches Bild
  const L2 = layoutMindmap(P, buildTree(P, buildIndex(P)));
  for (const [id, p] of L.pos) assert.deepEqual(L2.pos.get(id), p, `${name}: nicht reproduzierbar`);
  // 7. Grenzen umfassen alles
  for (const { b } of liste) assert.ok(b.x0 >= L.bounds.minX - 0.01 && b.x1 <= L.bounds.maxX + 0.01 && b.y0 >= L.bounds.minY - 0.01 && b.y1 <= L.bounds.maxY + 0.01, `${name}: außerhalb der Grenzen`);
  return L;
};

test("Mindmap: Beispielprojekt ohne Überlappung, Hierarchie klar", () => {
  const P = demoProject();
  pruefe(P, "Beispiel");
  // auch mit allen Ästen eingeklappt und mit Stapeln
  const X = buildIndex(P), T = buildTree(P, X);
  pruefe({ ...P, layout: { ...P.layout, collapsed: Object.fromEntries([...T.children].filter(([, k]) => k.length).map(([id]) => [id, true])) } }, "Beispiel eingeklappt");
  const sw = P.geraete.find((d) => d.name === "SW FOH");
  const kinder = T.children.get(sw.id);
  pruefe({ ...P, layout: { ...P.layout, stapel: [{ id: "r", name: "Rack", ids: [sw.id, ...kinder.slice(0, 3)] }] } }, "Beispiel Rack");
});

test("Mindmap: 400 zufällige Netze ohne Überlappung, Hierarchie klar", () => {
  for (let s = 1; s <= 400; s++) pruefe(netz(s), `Netz ${s}`);
});

test("Mindmap: hoher Stapel mit wenigen Kindern verdrängt die Nachbar-Äste", () => {
  const P = emptyProject({ mitVlans: false });
  const g = (id, sw, n) => { const d = { id, name: id, typ: sw ? "switch_managed" : "pc", isSwitch: sw, ports: Array.from({ length: n }, (_, i) => ({ id: `${id}p${i}`, name: String(i + 1), typ: "RJ45" })) }; P.geraete.push(d); return d; };
  let c = 0, frei = {};
  const k = (a, b) => { const pa = frei[a.id] = (frei[a.id] || 0) + 1, pb = frei[b.id] = (frei[b.id] || 0) + 1; P.verbindungen.push({ id: `c${c++}`, a: { dev: a.id, port: `${a.id}p${pa - 1}` }, b: { dev: b.id, port: `${b.id}p${pb - 1}` } }); };
  const core = g("core", true, 48);
  const a = g("A", true, 24), b = g("B", true, 24);
  k(core, a);
  const leer = [1, 2, 3, 4].map((i) => { const x = g(`x${i}`, false, 1); k(core, x); return x; });
  k(core, b);
  k(a, g("a1", false, 1));
  for (let i = 0; i < 6; i++) k(b, g(`b${i}`, false, 1));
  for (const richtung of [undefined, "h"]) {
    P.layout.stapel = [{ id: "s", name: "Rack", ids: [a.id, ...leer.map((x) => x.id)], ...(richtung ? { richtung } : {}) }];
    pruefe(P, `hoher Stapel ${richtung || "v"}`);
    P.layout.stapel = [{ id: "s", name: "Rack", ids: ["a1", "b0", "b1"], ...(richtung ? { richtung } : {}) }]; // quer durch zwei Äste
    pruefe(P, `Stapel über Äste ${richtung || "v"}`);
    P.layout.stapel = [{ id: "s", name: "Rack", ids: ["core", "A", "a1"], ...(richtung ? { richtung } : {}) }]; // Wurzel im Stapel
    pruefe(P, `Wurzel im Stapel ${richtung || "v"}`);
  }
});

test("Mindmap: von Hand gespeicherte Positionen alter Projekte zählen nicht mehr", () => {
  const P = demoProject();
  const L0 = pruefe(P, "ohne");
  const id = P.geraete[3].id;
  P.layout.offsets = { [id]: { dx: 500, dy: -300 } };
  P.layout.pinned = { [id]: { x: 1, y: 2 } };
  const L1 = layoutMindmap(P, buildTree(P, buildIndex(P)));
  assert.deepEqual(L1.pos.get(id), L0.pos.get(id));
});

test("Mindmap: großes Netz (600 Geräte) schnell", () => {
  const P = emptyProject({ mitVlans: false });
  const sw = (i) => ({ id: `s${i}`, name: `SW ${i}`, typ: "switch_managed", isSwitch: true, ports: Array.from({ length: 48 }, (_, j) => ({ id: `s${i}p${j}`, name: String(j + 1), typ: "RJ45" })) });
  P.geraete.push(sw(0));
  let c = 0;
  for (let i = 1; i <= 12; i++) {
    P.geraete.push(sw(i));
    P.verbindungen.push({ id: `c${c++}`, a: { dev: "s0", port: `s0p${i}` }, b: { dev: `s${i}`, port: `s${i}p0` } });
    for (let j = 1; j <= 48; j++) {
      const id = `e${i}_${j}`;
      P.geraete.push({ id, name: id, typ: "pc", ports: [{ id: id + "p", name: "1", typ: "RJ45" }] });
      if (j < 48) P.verbindungen.push({ id: `c${c++}`, a: { dev: `s${i}`, port: `s${i}p${j}` }, b: { dev: id, port: id + "p" } });
    }
  }
  const t0 = Date.now();
  pruefe(P, "groß");
  assert.ok(Date.now() - t0 < 3000, `zu langsam: ${Date.now() - t0} ms`);
});
