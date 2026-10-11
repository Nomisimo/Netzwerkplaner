import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE, geraetUmbauen, nameAutomatisch, nummerierteNamen } from "../src/shared/catalog.js";
import { kopieName } from "../src/shared/konfig.js";

test("Kopien werden durchnummeriert: (Kopie), (Kopie 2), (Kopie 3)", () => {
  const P = emptyProject();
  P.geraete.push({ id: "a", name: "Rio" });
  assert.equal(kopieName(P, "Rio"), "Rio (Kopie)");
  P.geraete.push({ id: "b", name: "Rio (Kopie)" });
  assert.equal(kopieName(P, "Rio"), "Rio (Kopie 2)");
  assert.equal(kopieName(P, "Rio (Kopie)"), "Rio (Kopie 2)"); // Kopie einer Kopie zählt am Original weiter
  const belegt = new Set(P.geraete.map((g) => g.name));
  assert.deepEqual([kopieName(P, "Rio", belegt), kopieName(P, "Rio", belegt)], ["Rio (Kopie 2)", "Rio (Kopie 3)"]);
});

test("Mehrere einfügen: freie Nummern", () => {
  const P = emptyProject();
  P.geraete.push({ id: "a", name: "Rio 2" });
  assert.deepEqual(nummerierteNamen(P, "Rio", 3), ["Rio 1", "Rio 3", "Rio 4"]);
});

test("Modell zuweisen übernimmt den Namen, solange er nicht von Hand geändert wurde", () => {
  const P = emptyProject();
  const k = KATALOG_GERAETE.find((g) => g.modell === "grandMA3 light");
  const a = createDevice({ typ: "lichtpult", vlans: P.vlans });
  const b = createDevice({ typ: "lichtpult", vlans: P.vlans, name: a.name + " 2" });
  const c = createDevice({ typ: "lichtpult", vlans: P.vlans, name: "FOH Pult" });
  c.nameManuell = true;
  P.geraete.push(a, b, c);
  assert.ok(nameAutomatisch(a) && nameAutomatisch(b) && !nameAutomatisch(c));
  for (const d of [a, b, c]) geraetUmbauen(P, d.id, createDevice({ katalogId: k.id, vlans: P.vlans }));
  assert.deepEqual(P.geraete.map((g) => g.name), ["grandMA3 light", "grandMA3 light 2", "FOH Pult"]);
});
