import test from "node:test";
import assert from "node:assert/strict";
import { migrateProject } from "../src/shared/model.js";
import { migrateFelder, migrateLibrary, fehlendeFeldDefs, feldSpalten } from "../src/shared/felder.js";

test("Alte Inventarfelder werden beim Öffnen zu eigenen Feldern", () => {
  const P = migrateProject({ geraete: [
    { id: "a", name: "A", interfaces: [], ports: [], inventar: { nr: "INV-7", sn: "SN1", case: "Case 3" } },
    { id: "b", name: "B", interfaces: [], ports: [], inventar: { nr: "", sn: "", case: "" } },
    { id: "c", name: "C", interfaces: [], ports: [] },
  ], layout: { titel: "inventar" } });
  const [a, b, c] = P.geraete;
  assert.equal(a.inventar, undefined);
  assert.deepEqual(a.felder, [
    { id: "inventar-nr", name: "Inventar-Nr.", wert: "INV-7" },
    { id: "seriennummer", name: "Seriennummer", wert: "SN1" },
    { id: "case", name: "Case", wert: "Case 3" },
  ]);
  assert.deepEqual(b.felder, []);
  assert.deepEqual(c.felder, []);
  assert.equal(P.layout.titel, "feld:inventar-nr");
  // zweimal migrieren ändert nichts
  assert.deepEqual(migrateProject(P).geraete[0].felder, a.felder);
});

test("Bibliothek: Bestand und Vorlagen migriert, Felddefinitionen ergänzt", () => {
  const l = migrateLibrary({ bestand: [{ id: "x", name: "X", geraet: { inventar: { nr: "", sn: "S-1", case: "" } } }], vorlagen: [] });
  assert.deepEqual(l.bestand[0].geraet.felder, [{ id: "seriennummer", name: "Seriennummer", wert: "S-1" }]);
  assert.deepEqual(l.felder, [{ id: "seriennummer", name: "Seriennummer" }]);
  assert.deepEqual(l.icons, []);
});

test("Feldspalten nur für benutzte Felder, Katalogreihenfolge", () => {
  const defs = [{ id: "b", name: "B" }, { id: "a", name: "A" }, { id: "z", name: "unbenutzt" }];
  const g = [migrateFelder({ felder: [{ id: "a", name: "A", wert: "1" }, { id: "b", name: "B", wert: "2" }, { id: "q", name: "Fremd", wert: "3" }] })];
  assert.deepEqual(feldSpalten(g, defs).map((f) => f.name), ["B", "A", "Fremd"]);
  assert.deepEqual(fehlendeFeldDefs(defs, g), [{ id: "q", name: "Fremd" }]);
});
