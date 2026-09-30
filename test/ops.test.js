import test from "node:test";
import assert from "node:assert/strict";
import { diff, apply, invert, pathKey } from "../src/shared/ops.js";
import { clone, addConnection, suggestIp } from "../src/shared/model.js";
import { demoProject as demoRoh } from "../src/shared/demo.js";

// Im App-Zustand ist alles JSON (mutate klont per JSON), undefined-Felder gibt es dort nicht
const demoProject = () => clone(demoRoh());

// apply(prev, diff(prev, next)) == next und apply(next, invert(ops)) == prev
const roundtrip = (prev, fn) => {
  const next = clone(prev);
  fn(next);
  const ops = diff(prev, next);
  const a = clone(prev);
  assert.deepEqual(apply(a, ops), []);
  assert.deepEqual(a, next);
  assert.deepEqual(JSON.parse(JSON.stringify(ops)), ops, "Operationen sind reines JSON");
  const b = clone(next);
  assert.deepEqual(apply(b, invert(ops)), []);
  assert.deepEqual(b, prev);
  return ops;
};

test("Feldänderung ergibt genau ein set mit ID-Pfad", () => {
  const P = demoProject();
  const d = P.geraete[1], p = d.ports[0];
  const ops = roundtrip(P, (x) => { x.geraete[1].ports[0].ip = "10.9.9.9"; });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, "set");
  assert.equal(pathKey(ops[0].path), `geraete/#${d.id}/ports/#${p.id}/ip`);
});

test("Gerät löschen mit Verbindungen, Einfügen, Umsortieren", () => {
  const P = demoProject();
  const id = P.geraete[2].id;
  roundtrip(P, (x) => {
    x.geraete = x.geraete.filter((g) => g.id !== id);
    x.verbindungen = x.verbindungen.filter((c) => c.a.dev !== id && c.b.dev !== id);
  });
  roundtrip(P, (x) => { x.geraete.splice(1, 0, { ...clone(x.geraete[0]), id: "neu1", name: "Neu" }); });
  roundtrip(P, (x) => { x.geraete.reverse(); });
  roundtrip(P, (x) => { x.geraete = x.geraete.filter((_, i) => i % 2); x.geraete.reverse(); });
});

test("Mengenfelder: add/drop statt ganzer Liste", () => {
  const P = demoProject();
  P.geraete[0].ports[0].vlans = [P.vlans[0].id];
  const ops = roundtrip(P, (x) => { x.geraete[0].ports[0].vlans.push(x.vlans[1].id); });
  assert.deepEqual(ops.map((o) => o.op), ["add"]);
});

test("Layout-Maps je Schlüssel", () => {
  const P = demoProject();
  P.layout.pinned = { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } };
  const ops = roundtrip(P, (x) => { x.layout.pinned.a = { x: 5, y: 2 }; delete x.layout.pinned.b; x.layout.pinned.c = { x: 0, y: 0 }; });
  assert.deepEqual(ops.map((o) => pathKey(o.path)).sort(), ["layout/pinned/a/x", "layout/pinned/b", "layout/pinned/c"]);
});

test("Verbinden über addConnection als Diff", () => {
  const P = demoProject();
  roundtrip(P, (x) => { addConnection(x, x.geraete[0].id, x.geraete[x.geraete.length - 1].id); });
});

test("Gleichzeitige Änderungen verschiedener Felder bleiben beide erhalten", () => {
  const P = demoProject();
  const dev = P.geraete.find((g) => g.ports.length);
  const base = clone(P);
  const A = clone(base); const pa = A.geraete.find((g) => g.id === dev.id).ports[0]; pa.ip = "10.1.1.1";
  const B = clone(base); B.geraete.find((g) => g.id === dev.id).name = "Umbenannt";
  const server = clone(base);
  apply(server, diff(base, A));
  assert.deepEqual(apply(server, diff(base, B)), []);
  const s = server.geraete.find((g) => g.id === dev.id);
  assert.equal(s.ports[0].ip, "10.1.1.1");
  assert.equal(s.name, "Umbenannt");
});

test("Änderung an gelöschtem Gerät wird verworfen", () => {
  const P = demoProject();
  const id = P.geraete[1].id;
  const A = clone(P); A.geraete[1].name = "X";
  const server = clone(P);
  server.geraete = server.geraete.filter((g) => g.id !== id);
  const skipped = apply(server, diff(P, A));
  assert.equal(skipped.length, 1);
  assert.ok(!server.geraete.some((g) => g.id === id));
});

test("Zufällige Änderungsfolgen am Demoprojekt", () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  let P = demoProject();
  const actions = [
    (x) => { const g = x.geraete[rnd(x.geraete.length)]; if (g) g.name += "!"; },
    (x) => { const g = x.geraete[rnd(x.geraete.length)]; const p = g?.ports[rnd(g.ports.length || 1)]; if (p) p.ip = suggestIp(x, x.vlans[0]) || "10.0.0.9"; },
    (x) => { if (x.geraete.length > 3) { const id = x.geraete[rnd(x.geraete.length)].id; x.geraete = x.geraete.filter((g) => g.id !== id); x.verbindungen = x.verbindungen.filter((c) => c.a.dev !== id && c.b.dev !== id); } },
    (x) => { const g = x.geraete[rnd(x.geraete.length)]; if (g) x.geraete.push({ ...clone(g), id: `r${rnd(1e6)}`, name: g.name + " Kopie" }); },
    (x) => { const a = x.geraete[rnd(x.geraete.length)], b = x.geraete[rnd(x.geraete.length)]; if (a && b) addConnection(x, a.id, b.id); },
    (x) => { x.verbindungen.reverse(); },
    (x) => { const v = x.vlans[rnd(x.vlans.length)]; if (v) v.name += " neu"; },
    (x) => { x.layout.offsets[`k${rnd(20)}`] = { x: rnd(100), y: rnd(100) }; },
  ];
  for (let i = 0; i < 200; i++) {
    const a = actions[rnd(actions.length)], b = actions[rnd(actions.length)];
    const prev = P;
    roundtrip(prev, (x) => { a(x); b(x); });
    P = clone(prev); a(P); b(P);
  }
});
