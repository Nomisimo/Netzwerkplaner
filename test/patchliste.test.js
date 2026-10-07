import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { aufbauReihenfolge, patchReihenfolge, patchZeilen, patchExportZeilen, steckZiele, steckeUm, setzeFeld } from "../src/shared/patchliste.js";

test("Patchliste: alle Geräte, Aufbau-Reihenfolge vom Haupt-Switch aus", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const r = aufbauReihenfolge(P, X);
  assert.equal(r.length, P.geraete.length);
  assert.equal(new Set(r).size, r.length);
  const z = patchZeilen(P, X);
  assert.ok(X.devById.get(z[0].id).isSwitch); // Haupt-Switch zuerst
  // Endgeräte am selben Switch stehen nach Portnummer sortiert
  const kern = z[0].id;
  const amKern = z.filter((x) => x.aufSwitch === kern && !x.isSwitch).map((x) => +x.gesteckt.match(/Port (\d+)/)?.[1]).filter(Boolean);
  assert.deepEqual(amKern, [...amKern].sort((a, b) => a - b));
  const e = patchExportZeilen(P, X)[1];
  assert.ok(!("Kabel" in e) && !("Weitere Kabel" in e));
  for (const k of ["Gerät", "Netzwerkname", "IPs / Interfaces", "Gesteckt auf", "Abteilung", "Standort", "Felder", "Notizen", "Notizen vor Ort"]) assert.ok(k in e, k);
});

test("Patchliste: Stapel bleiben zusammen, Hand-Reihenfolge gewinnt, neue Geräte rücken ein", () => {
  const P = demoProject();
  const X0 = buildIndex(P);
  const auto = aufbauReihenfolge(P, X0);
  const [a, b] = [auto[auto.length - 1], auto[1]];
  P.layout.stapel = [{ id: "s1", name: "Rack", ids: [a, b] }];
  const X = buildIndex(P);
  const r = aufbauReihenfolge(P, X);
  assert.equal(r.indexOf(b), r.indexOf(a) + 1);
  P.patchliste = { reihenfolge: [auto[3], auto[2]] };
  const m = patchReihenfolge(P, X);
  assert.ok(m.indexOf(auto[3]) < m.indexOf(auto[2]));
  assert.equal(m.length, P.geraete.length);
});

test("Patchliste: umstecken auf freien Port, Rückfall ohne Änderung", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const z = patchZeilen(P, X).find((x) => !x.isSwitch && x.upConn);
  const ziele = steckZiele(P, z.id, z);
  const ziel = ziele.find((s) => s.ports.some((p) => p.id !== z.aufPort));
  const port = ziel.ports.find((p) => p.id !== z.aufPort);
  const anzahl = P.verbindungen.length;
  assert.equal(steckeUm(P, z.id, { upConn: z.upConn, switchId: ziel.id, portId: port.id, eigenerPort: z.eigenerPort }), true);
  assert.equal(P.verbindungen.length, anzahl);
  const neu = buildIndex(P);
  const zn = patchZeilen(P, neu).find((x) => x.id === z.id);
  assert.equal(zn.aufSwitch, ziel.id);
  assert.equal(zn.aufPort, port.id);
  // belegter Port: nichts ändert sich
  const vorher = JSON.stringify(P.verbindungen);
  const belegt = P.verbindungen.find((c) => c.id !== zn.upConn && (c.a.dev === ziel.id || c.b.dev === ziel.id));
  if (belegt) {
    const pid = belegt.a.dev === ziel.id ? belegt.a.port : belegt.b.port;
    steckeUm(P, z.id, { upConn: zn.upConn, switchId: ziel.id, portId: pid, eigenerPort: zn.eigenerPort });
    assert.equal(JSON.stringify(P.verbindungen), vorher);
  }
});

test("Patchliste: eigenes Feld setzen", () => {
  const d = { felder: [] };
  setzeFeld(d, { id: "f1", name: "Rack" }, "A1");
  setzeFeld(d, { id: "f1", name: "Rack" }, "B2");
  setzeFeld(d, { id: "f2", name: "Leer" }, "");
  assert.deepEqual(d.felder, [{ id: "f1", name: "Rack", wert: "B2" }]);
});
