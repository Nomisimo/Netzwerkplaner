import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, newVlan, migrateProject, vlansAbleiten } from "../src/shared/model.js";
import { createDevice, snapshotDevice } from "../src/shared/catalog.js";
import { newTrunk, vlanZuTrunk, trunkZuVlan, trunksAbgleichen, setzeTrunk, trunkPorts } from "../src/shared/trunks.js";

const projekt = () => {
  const P = emptyProject();
  P.vlans = [newVlan({ vid: 10, name: "Dante" }), newVlan({ vid: 20, name: "Licht" }), newVlan({ vid: 99, name: "Management" })];
  return P;
};

test("Trunk: Ports tragen die VLANs ihres Trunks, Änderungen gelten sofort", () => {
  const P = projekt();
  const [v10, v20, v99] = P.vlans;
  const t = newTrunk({ name: "Uplink", vlans: [v10.id, v20.id] });
  P.trunks.push(t);
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  P.geraete.push(sw);
  setzeTrunk(sw.ports[0], t);
  assert.equal(sw.ports[0].modus, "trunk");
  assert.deepEqual(sw.ports[0].vlans, [v10.id, v20.id]);
  t.vlans.push(v99.id);
  vlansAbleiten(P);
  assert.deepEqual(sw.ports[0].vlans, [v10.id, v20.id, v99.id]);
  assert.equal(trunkPorts(P, t.id).length, 1);
  // gelöschter Trunk: Port behält seine Liste, Verweis fällt weg
  P.trunks = [];
  trunksAbgleichen(P);
  assert.equal(sw.ports[0].trunk, undefined);
  assert.equal(sw.ports[0].vlans.length, 3);
});

test("Trunk: gelöschtes VLAN fällt aus dem Trunk", () => {
  const P = projekt();
  const [v10, v20] = P.vlans;
  P.trunks.push(newTrunk({ name: "T", vlans: [v10.id, v20.id] }));
  P.vlans = P.vlans.filter((v) => v !== v20);
  trunksAbgleichen(P);
  assert.deepEqual(P.trunks[0].vlans, [v10.id]);
});

test("Haken „Ist ein Trunk“: VLAN wird Trunk und zurück", () => {
  const P = projekt();
  const [v10, v20] = P.vlans;
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  P.geraete.push(sw);
  sw.ports[0].vlan = v20.id;
  sw.ports[1].modus = "trunk"; sw.ports[1].vlans = [v10.id, v20.id];
  const t = vlanZuTrunk(P, v20.id);
  assert.equal(P.vlans.length, 2);
  assert.equal(t.name, "Licht");
  assert.equal(sw.ports[0].modus, "trunk");
  assert.equal(sw.ports[0].trunk, t.id);
  assert.deepEqual(sw.ports[1].vlans, [v10.id]); // aus anderen Trunk-Ports heraus
  t.vlans = [v10.id];
  trunksAbgleichen(P);
  assert.deepEqual(sw.ports[0].vlans, [v10.id]);
  const v = trunkZuVlan(P, t.id, newVlan);
  assert.equal(P.trunks.length, 0);
  assert.equal(v.name, "Licht");
  assert.equal(v.vid, 100);
  assert.equal(sw.ports[0].trunk, undefined);
});

test("Trunk in Vorlage/Bestand: im anderen Projekt gefunden oder angelegt", () => {
  const P = projekt();
  const [v10, v20] = P.vlans;
  const t = newTrunk({ name: "Uplink Ton+Licht", farbe: "#123456", vlans: [v10.id, v20.id] });
  P.trunks.push(t);
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  setzeTrunk(sw.ports[3], t);
  const snap = snapshotDevice(sw, P.vlans, P.trunks);
  assert.equal(snap.ports[3].trunk, undefined);
  assert.deepEqual(snap.ports[3].trunkDef, { name: "Uplink Ton+Licht", farbe: "#123456", vids: [10, 20] });

  // anderes Projekt ohne den Trunk und ohne VLAN 20: beides wird angelegt
  const Q = emptyProject();
  Q.vlans = [newVlan({ vid: 10, name: "Audio" })];
  const neu = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans, trunks: Q.trunks, name: "SW 2" });
  assert.equal(Q.trunks.length, 1);
  assert.equal(Q.trunks[0].name, "Uplink Ton+Licht");
  assert.deepEqual(Q.trunks[0].vlans.map((id) => Q.vlans.find((v) => v.id === id).vid), [10, 20]);
  assert.equal(neu.ports[3].trunk, Q.trunks[0].id);

  // zweites Einfügen nimmt denselben Trunk
  const neu2 = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans, trunks: Q.trunks, name: "SW 3" });
  assert.equal(Q.trunks.length, 1);
  assert.equal(neu2.ports[3].trunk, Q.trunks[0].id);
});

test("Ältere Projekte bekommen eine leere Trunk-Liste", () => {
  const P = migrateProject({ vlans: [], geraete: [], verbindungen: [] });
  assert.deepEqual(P.trunks, []);
});
