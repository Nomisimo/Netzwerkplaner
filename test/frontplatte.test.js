import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex, buildTree } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { plattenGeometrie, layoutFrontplatten, anker } from "../src/shared/frontplatte.js";
import { physPorts } from "../src/shared/catalog.js";

test("Frontplatte hat für jeden Port einen Slot, ohne Überlappung", () => {
  const P = demoProject();
  for (const d of P.geraete.filter((x) => physPorts(x).length > 1)) {
    const g = plattenGeometrie(d);
    assert.equal(g.slots.size, physPorts(d).length, d.name);
    const s = [...g.slots.values()];
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const ov = Math.abs(s[i].x - s[j].x) < (s[i].w + s[j].w) / 2 && Math.abs(s[i].y - s[j].y) < (s[i].h + s[j].h) / 2;
      assert.ok(!ov, `${d.name}: Port ${s[i].nr} überlappt ${s[j].nr}`);
    }
    for (const x of s) assert.ok(x.x + x.w / 2 <= g.w && x.y + x.h / 2 <= g.h, `${d.name}: Port ${x.nr} ragt heraus`);
  }
});

test("Frontplatten-Layout platziert alle Geräte, Karten hängen über oder unter ihrem Switch", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const T = buildTree(P, X);
  const F = layoutFrontplatten(P, T, X);
  assert.equal(F.pos.size, P.geraete.length);
  for (const [id, p] of F.pos) {
    if (p.kind !== "card" || p.head === id) continue;
    const h = F.pos.get(p.head);
    assert.ok(Math.abs(p.y - h.y) > (p.h + h.h) / 2, `${X.devById.get(id).name} überdeckt seinen Switch`);
  }
  // Anker an einer Switch-Verbindung liegt am Port-Slot
  const c = P.verbindungen.find((v) => F.slots.get(v.a.dev)?.get(v.a.port));
  const s = F.slots.get(c.a.dev).get(c.a.port);
  const a = anker(F.pos.get(c.a.dev), s, F.pos.get(c.b.dev));
  assert.equal(a.x, s.ax);
  // Verschieben eines Switches verschiebt seine Karten mit
  const head = [...F.members].find(([, m]) => m.length > 1)[0];
  const P2 = { ...P, layout: { ...P.layout, fpOffsets: { [head]: { dx: 100, dy: 50 } } } };
  const F2 = layoutFrontplatten(P2, T, X);
  for (const id of F.members.get(head)) assert.equal(F2.pos.get(id).x - F.pos.get(id).x, 100);
});

test("Äste: Mindmap und Anschlüsse klappen gleich ein, auch Endgeräte mit Kindern", async () => {
  const { demoProject } = await import("../src/shared/demo.js");
  const { buildIndex, buildTree, astKlappbar, astVersteckt, aesteUmschalten, subtreeIds } = await import("../src/shared/model.js");
  const { layoutMindmap } = await import("../src/shared/layout.js");
  const { layoutFrontplatten } = await import("../src/shared/frontplatte.js");
  const P = demoProject(), X = buildIndex(P), T = buildTree(P, X);
  assert.equal(astKlappbar(T, T.roots[0]), false, "Hauptswitch bleibt offen");
  const zu = aesteUmschalten(T, {});
  assert.ok(Object.keys(zu).length > 0);
  for (const id of Object.keys(zu)) assert.ok(astKlappbar(T, id));
  assert.deepEqual(aesteUmschalten(T, zu), {}, "zweiter Klick klappt alles auf");
  // Einen Ast einklappen: beide Ansichten verstecken dieselben Geräte und zählen gleich
  const ast = Object.keys(zu)[0];
  P.layout.collapsed = { [ast]: true };
  const weg = subtreeIds(T, ast).slice(1);
  const M = layoutMindmap(P, T), F = layoutFrontplatten(P, T, X);
  for (const id of weg) { assert.ok(!M.pos.has(id), `Mindmap zeigt ${id}`); assert.ok(!F.pos.has(id), `Anschlüsse zeigt ${id}`); }
  assert.equal(M.hidden.get(ast), weg.length);
  assert.equal(F.hidden.get(ast), weg.length);
  assert.equal(astVersteckt(T, { [T.roots[0]]: true }).size, 0, "Hauptswitch lässt sich nicht einklappen");
});
