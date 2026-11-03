import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { flussRichtungen } from "../src/shared/fluss.js";
import { cleanCatLayout, cleanCatOptimieren } from "../src/shared/cleancat.js";

const dev = (P, n) => P.geraete.find((g) => g.name === n);

test("Signalfluss aus Datenströmen: Sender zum Empfänger, Rückweg in beide Richtungen", () => {
  const P = demoProject(), X = buildIndex(P);
  const F = flussRichtungen(P, X);
  // Kabel des DS10 (nur Empfänger des CL5): Signal läuft nur zum DS10
  const ds = dev(P, "d&b DS10");
  const c = P.verbindungen.find((x) => x.a.dev === ds.id || x.b.dev === ds.id);
  const f = F.get(c.id);
  assert.ok(f, "Richtung bekannt");
  const zumDs = c.a.dev === ds.id ? f.ba : f.ab, vomDs = c.a.dev === ds.id ? f.ab : f.ba;
  assert.equal(zumDs, true); assert.equal(vomDs, false);
});

test("Signalfluss von Hand geht vor, Plott zeigt dann nur einen Pfeil", () => {
  const P = demoProject();
  const c = P.verbindungen[0];
  c.fluss = "ba";
  const X = buildIndex(P);
  assert.deepEqual(flussRichtungen(P, X).get(c.id), { ab: false, ba: true, quelle: "hand" });
  const L = cleanCatLayout(P, X);
  const l = L.linien.find((x) => x.id === c.id);
  assert.equal(l.einweg, true);
  assert.equal(l.von === c.b.dev ? l.pfeil.ende : l.pfeil.start, true);
  assert.equal(L.legende.fluss, true);
});

test("Plott: von Hand gezogene Reihenfolge der Geräte bleibt beim Optimieren", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  const [key, liste] = Object.entries(L.ordnung.oben).find(([, l]) => l.length > 2);
  const neu = [...liste].reverse();
  P.layout.cleancatOrdnung = { oben: { [key]: neu } };
  const { ordnung } = cleanCatOptimieren(P, X);
  assert.deepEqual(ordnung.oben[key], neu);
});

test("Plott: Kabel ohne eindeutige Richtung bekommen keine Doppelpfeile mehr", () => {
  const P = demoProject(), X = buildIndex(P);
  const L = cleanCatLayout(P, X);
  const ohne = L.linien.filter((l) => !l.einweg);
  assert.ok(ohne.length > 0);
  for (const l of ohne) assert.deepEqual(l.pfeil, { start: false, ende: false });
  for (const l of L.linien.filter((x) => x.einweg)) assert.notEqual(l.pfeil.start, l.pfeil.ende);
});
