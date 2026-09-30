import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newVlan } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE } from "../src/shared/catalog.js";
import { konfigAus, konfigAnwenden, geraetKopie, stapelAus, stapelEinfuegen } from "../src/shared/konfig.js";
import { stapeln } from "../src/shared/anordnung.js";

const projekt = () => {
  const P = emptyProject();
  P.vlans = [newVlan({ vid: 10, name: "Dante" }), newVlan({ vid: 20, name: "Licht" }), newVlan({ vid: 99, name: "Management" })];
  return P;
};

test("Konfiguration: Port-VLANs und PoE von Switch zu Switch kopieren, IPs bleiben", () => {
  const P = projekt();
  const [v10, v20] = P.vlans;
  const a = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW A" });
  const b = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW B" });
  a.ports[0].vlan = v10.id; a.ports[1].modus = "trunk"; a.ports[1].vlans = [v10.id, v20.id]; a.ports[2].poe = true;
  a.poeBudget = 240;
  b.interfaces[0].ip = "10.0.99.2";
  const clip = konfigAus(a, P.vlans, ["ports", "poe"]);
  const r = konfigAnwenden(b, clip, ["ports", "poe"], P.vlans);
  assert.equal(b.ports[0].vlan, v10.id);
  assert.equal(b.ports[1].modus, "trunk");
  assert.deepEqual(b.ports[1].vlans, [v10.id, v20.id]);
  assert.equal(b.ports[2].poe, true);
  assert.equal(b.poeBudget, 240);
  assert.equal(b.name, "SW B");
  assert.equal(b.interfaces[0].ip, "10.0.99.2");
  assert.equal(r.fehlendePorts, 0);
});

test("Konfiguration: in ein anderes Projekt über die VLAN-ID, nicht gewählte Teile bleiben", () => {
  const P = projekt();
  const a = createDevice({ typ: "switch_managed", vlans: P.vlans });
  a.ports[0].vlan = P.vlans[1].id; a.notizen = "Quelle";
  const clip = JSON.parse(JSON.stringify(konfigAus(a, P.vlans, ["ports", "notizen"])));
  const Q = projekt(); // andere interne VLAN-ids
  const b = createDevice({ typ: "switch_managed", vlans: Q.vlans });
  b.notizen = "Ziel";
  konfigAnwenden(b, clip, ["ports"], Q.vlans);
  assert.equal(b.ports[0].vlan, Q.vlans[1].id);
  assert.equal(b.notizen, "Ziel");
});

test("Konfiguration: weniger Ports im Ziel werden gemeldet", () => {
  const P = projekt();
  const a = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const b = createDevice({ typ: "switch_managed", vlans: P.vlans });
  b.ports = b.ports.slice(0, 2);
  const r = konfigAnwenden(b, konfigAus(a, P.vlans, ["ports"]), ["ports"], P.vlans);
  assert.equal(r.fehlendePorts, a.ports.length - 2);
});

test("Gerät duplizieren: neue ids, keine IP und MAC", () => {
  const P = projekt();
  const a = createDevice({ typ: "stagebox", vlans: P.vlans, name: "Rio" });
  a.interfaces[0].ip = "10.0.10.5"; a.interfaces[0].mac = "00:11:22:33:44:55";
  const c = geraetKopie(a);
  assert.notEqual(c.id, a.id);
  assert.equal(c.name, "Rio (Kopie)");
  assert.equal(c.interfaces[0].ip, "");
  assert.equal(c.interfaces[0].mac, "");
  assert.equal(c.ports[0].iface, c.interfaces[0].id);
});

test("Stapel kopieren und einfügen: Geräte, interne Verbindungen und Name", () => {
  const P = projekt();
  const a = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  const b = createDevice({ typ: "stagebox", vlans: P.vlans, name: "Box" });
  const c = createDevice({ typ: "stagebox", vlans: P.vlans, name: "Außen" });
  P.geraete.push(a, b, c);
  P.verbindungen.push({ id: "v1", a: { dev: a.id, port: a.ports[0].id }, b: { dev: b.id, port: b.ports[0].id }, kabel: "cat6" });
  P.verbindungen.push({ id: "v2", a: { dev: a.id, port: a.ports[1].id }, b: { dev: c.id, port: c.ports[0].id }, kabel: "cat6" });
  P.layout.stapel = stapeln([], a.id, b.id, "s1");
  P.layout.stapel[0].name = "Rack FOH";
  const clip = stapelAus(P, "s1");
  const { ids, stapelId } = stapelEinfuegen(P, clip);
  assert.equal(ids.length, 2);
  assert.equal(P.geraete.length, 5);
  const s = P.layout.stapel.find((x) => x.id === stapelId);
  assert.equal(s.name, "Rack FOH (Kopie)");
  assert.deepEqual(s.ids, ids);
  const neu = P.verbindungen.filter((v) => ids.includes(v.a.dev) || ids.includes(v.b.dev));
  assert.equal(neu.length, 1); // nur die Verbindung innerhalb des Stapels
  const n0 = P.geraete.find((g) => g.id === ids[0]);
  assert.equal(neu[0].a.port, n0.ports[0].id);
});

test("Katalog: RME Digiface Dante, Ravenna und AVB", () => {
  const rme = KATALOG_GERAETE.filter((g) => g.hersteller === "RME").map((g) => g.modell);
  assert.deepEqual(rme.sort(), ["Digiface AVB", "Digiface Dante", "Digiface Ravenna"]);
  const d = createDevice({ katalogId: KATALOG_GERAETE.find((g) => g.modell === "Digiface Dante").id });
  assert.equal(d.ports.length, 4);
  assert.deepEqual(d.ports.slice(0, 2).map((p) => p.name), ["Primary", "Secondary"]);
  assert.ok(d.protokolle.includes("Dante"));
});
