import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, buildIndex, validate, addConnection } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE, physPorts, newPort, katalogAbweichung, katalogAbgleichen } from "../src/shared/catalog.js";

test("Katalog-Gerät mit alten Ports (grandMA3 light mit 5 statt 3): erkannt und angepasst", () => {
  const P = emptyProject();
  const k = KATALOG_GERAETE.find((g) => g.modell === "grandMA3 light");
  const ma = createDevice({ katalogId: k.id, vlans: P.vlans, name: "MA3 FOH" });
  assert.equal(physPorts(ma).length, 3);
  assert.equal(katalogAbweichung(ma), null);
  // so sah das Gerät aus einer älteren Katalog-Version aus
  ma.ports.splice(3, 0, newPort({ name: "LAN 4", typ: "etherCON" }), newPort({ name: "LAN 5", typ: "etherCON" }));
  physPorts(ma)[0].ip = "10.10.20.10";
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  P.geraete.push(ma, sw);
  addConnection(P, ma.id, sw.id, { portIdA: physPorts(ma)[0].id });
  const a = katalogAbweichung(ma);
  assert.deepEqual([a.ist, a.soll], [5, 3]);
  assert.ok(validate(P, buildIndex(P)).some((i) => i.dev === ma.id && /laut Katalog/.test(i.msg)));

  katalogAbgleichen(P, ma.id);
  const neu = P.geraete.find((g) => g.id === ma.id);
  assert.equal(physPorts(neu).length, 3);
  assert.equal(neu.name, "MA3 FOH");
  assert.equal(physPorts(neu)[0].ip, "10.10.20.10");
  assert.equal(P.verbindungen.length, 1);
  assert.ok(neu.ports.some((p) => p.id === P.verbindungen[0].a.port || p.id === P.verbindungen[0].b.port));
  assert.equal(katalogAbweichung(neu), null);
});
