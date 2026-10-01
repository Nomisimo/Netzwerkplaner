import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { aufbauReihenfolge, patchReihenfolge, patchZeilen, patchExportZeilen } from "../src/shared/patchliste.js";

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
  for (const k of ["Gerät", "Netzwerkname", "IPs / Interfaces", "Gesteckt auf", "Kabel", "Abteilung", "Standort", "Felder", "Notizen", "Notizen vor Ort"]) assert.ok(k in e, k);
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
