import test from "node:test";
import assert from "node:assert/strict";
import { cleanCatLayout, CC_FARBEN } from "../src/shared/cleancat.js";
import { demoProject } from "../src/shared/demo.js";
import { buildIndex } from "../src/shared/model.js";

const ueberlapp = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("Clean Cat: Räume, Blöcke ohne Überlappung, eine Leitung je Verbindung", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  assert.equal(L.boxen.length, P.geraete.length);
  assert.equal(L.linien.length, P.verbindungen.length);
  assert.deepEqual(L.raeume.map((r) => r.name).sort(), [...new Set(P.geraete.map((d) => d.bereich))].sort());
  for (let i = 0; i < L.boxen.length; i++) for (let j = i + 1; j < L.boxen.length; j++) assert.ok(!ueberlapp(L.boxen[i], L.boxen[j]), `${L.boxen[i].name} / ${L.boxen[j].name}`);
  // Jedes Gerät liegt in seinem Raum
  for (const b of L.boxen) {
    const d = P.geraete.find((g) => g.id === b.id);
    const r = L.raeume.find((x) => x.name === d.bereich);
    assert.ok(b.x >= r.x && b.x + b.w <= r.x + r.w && b.y >= r.y && b.y + b.h <= r.y + r.h, `${d.name} in ${r.name}`);
  }
  // nur rechtwinklige Segmente
  for (const l of L.linien) for (let i = 1; i < l.pts.length; i++) {
    const [a, b] = [l.pts[i - 1], l.pts[i]];
    assert.ok(Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01, "rechtwinklig");
  }
  // Dante: Rio A Primary rot, Secondary grün
  const rio = P.geraete.find((d) => d.name === "Rio A");
  const farben = P.verbindungen.filter((c) => c.a.dev === rio.id || c.b.dev === rio.id).map((c) => L.linien.find((l) => l.id === c.id).col);
  assert.ok(farben.includes(CC_FARBEN.primary) && farben.includes(CC_FARBEN.secondary));
  assert.ok(L.w > 0 && L.h > 0);
});
