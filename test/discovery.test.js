import test from "node:test";
import assert from "node:assert/strict";
import { sammleFunde, fundZuGeraet, fundeMitPlan } from "../src/shared/discovery.js";
import { geraetUmbauen, createDevice } from "../src/shared/catalog.js";

const snaps = {
  scan: { hosts: [{ ip: "10.0.0.5", mac: "aa:bb:cc:00:00:05", name: "rio.local", open: [4440, 80] }, { ip: "10.0.0.1", self: true }] },
  artnet: { nodes: [{ ip: "10.0.0.20", mac: "00:00:00:00:00:00", shortName: "Luminex Node", longName: "" }] },
  dante: { instances: [{ ip: "10.0.0.5", service: "_netaudio-chan._udp", label: "01@Rio3224", host: "rio.local" }] },
  citp: { peers: [{ ip: "10.0.0.30", name: "grandMA3", type: "LightingConsole" }] },
};

test("sammleFunde führt Quellen je IP zusammen", () => {
  const f = sammleFunde(snaps);
  assert.deepEqual(f.map((x) => x.ip), ["10.0.0.5", "10.0.0.20", "10.0.0.30"]);
  const rio = f[0];
  assert.equal(rio.name, "Rio3224");
  assert.equal(rio.mac, "aa:bb:cc:00:00:05");
  assert.ok(rio.protokolle.includes("Dante"));
  assert.deepEqual(rio.quellen.sort(), ["Dante", "Scan"]);
  assert.equal(f[1].mac, "", "Null-MAC von Art-Net wird ignoriert");
  assert.equal(f[1].typ, "node");
  assert.equal(f[2].typ, "lichtpult");
});

test("fundZuGeraet legt ein generisches Gerät mit IP und VLAN an", () => {
  const vlans = [{ id: "v1", vid: 10, name: "Audio", subnetz: "10.0.0.0/24" }];
  const [f] = sammleFunde(snaps);
  const d = fundZuGeraet(f, vlans);
  assert.equal(d.generisch, true);
  assert.equal(d.interfaces[0].ip, "10.0.0.5");
  assert.equal(d.interfaces[0].vlan, "v1");
  assert.equal(d.name, "Rio3224");
  const P = { geraete: [d], verbindungen: [], vlans };
  assert.ok(fundeMitPlan(P, [f])[0].plan, "Fund ist danach im Plan");
  assert.equal(fundeMitPlan({ geraete: [], verbindungen: [], vlans }, [f])[0].plan, null);
});

test("Leeres Gerät anlegen: Typ gesetzt, IP und Protokolle bleiben, generisch weg", () => {
  const [f] = sammleFunde(snaps);
  const d = fundZuGeraet(f, []);
  const P = { geraete: [d], verbindungen: [], vlans: [] };
  geraetUmbauen(P, d.id, createDevice({ typ: "mischpult", vlans: [] }));
  const g = P.geraete[0];
  assert.equal(g.typ, "mischpult");
  assert.equal(g.generisch, undefined);
  assert.equal(g.interfaces[0].ip, "10.0.0.5");
  assert.ok(g.protokolle.includes("Dante"));
  assert.equal(g.name, "Rio3224");
});
