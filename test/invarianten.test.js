import test from "node:test";
import assert from "node:assert/strict";
import { removeDevice, removeVlan, pruefeInvarianten } from "../src/shared/invarianten.js";
import { clone } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";

test("Demoprojekt verletzt keine harte Invariante", () => {
  assert.deepEqual(pruefeInvarianten(demoProject()), []);
});

test("Gerät löschen räumt Verbindungen, Layout, Stapel und Stromziele auf", () => {
  const P = clone(demoProject());
  const [a, b, c] = P.geraete;
  const conn = P.verbindungen.find((x) => x.a.dev === a.id || x.b.dev === a.id);
  P.layout.pinned = { [a.id]: { x: 1, y: 1 } };
  P.layout.fix = { [a.id]: { x: 1, y: 1 }, [b.id]: { x: 2, y: 2 } };
  P.layout.knicke = conn ? { [conn.id]: { dx: 1, dy: 1 } } : {};
  P.layout.stapel = [{ id: "s1", name: "", ids: [a.id, b.id] }, { id: "s2", name: "", ids: [a.id, b.id, c.id].slice(1) }];
  b.stroeme = [{ id: "st", ziele: [a.id, c.id] }];
  removeDevice(P, a.id);
  assert.ok(!P.geraete.some((g) => g.id === a.id));
  assert.ok(!P.verbindungen.some((x) => x.a.dev === a.id || x.b.dev === a.id));
  assert.deepEqual(P.layout.pinned, {});
  assert.deepEqual(Object.keys(P.layout.fix), [b.id]);
  assert.deepEqual(P.layout.knicke, {});
  assert.deepEqual(P.layout.stapel.map((s) => s.id), ["s2"]);
  assert.deepEqual(P.geraete.find((g) => g.id === b.id).stroeme[0].ziele, [c.id]);
  assert.deepEqual(pruefeInvarianten(P).filter((f) => f.art !== "mehrere-stapel"), []);
});

test("VLAN löschen entfernt alle Bezüge", () => {
  const P = clone(demoProject());
  const v = P.vlans[0];
  P.vlans[1].svlan = v.id;
  P.geraete[0].ports[0].vlans = [v.id, P.vlans[1].id];
  removeVlan(P, v.id);
  assert.deepEqual(pruefeInvarianten(P), []);
  assert.equal(P.vlans[0].svlan, null);
});

test("Doppelt belegter Port wird erkannt", () => {
  const P = clone(demoProject());
  const c = clone(P.verbindungen[0]); c.id = "dup";
  P.verbindungen.push(c);
  assert.ok(pruefeInvarianten(P).some((f) => f.art === "port-doppelt"));
});
