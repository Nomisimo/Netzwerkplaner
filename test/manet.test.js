import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, buildIndex, addConnection } from "../src/shared/model.js";
import { createDevice, KATALOG_GERAETE } from "../src/shared/catalog.js";
import { maNetIssues, maNetGen } from "../src/shared/manet.js";

const kat = (s) => KATALOG_GERAETE.find((g) => `${g.hersteller} ${g.modell}`.includes(s)).id;
const setup = () => {
  const P = emptyProject();
  const licht = P.vlans.find((v) => v.vid === 20);
  const pult = createDevice({ katalogId: kat("grandMA3 light"), vlans: P.vlans, name: "Pult" });
  const node = createDevice({ katalogId: kat("grandMA3 4Port Node"), vlans: P.vlans, name: "Node" });
  for (const d of [pult, node]) d.interfaces[0].vlan = licht.id;
  pult.interfaces[0].ip = "10.10.20.10"; node.interfaces[0].ip = "10.10.20.20";
  P.geraete.push(pult, node);
  return { P, licht, pult, node };
};
const ma = (P) => maNetIssues(P, buildIndex(P)).filter((i) => i.sev !== "info");

test("MA-Net-Generation aus den Protokollen", () => {
  assert.equal(maNetGen(createDevice({ katalogId: kat("grandMA3 light"), vlans: [] })), 3);
  assert.equal(maNetGen(createDevice({ katalogId: kat("grandMA2 light"), vlans: [] })), 2);
  assert.equal(maNetGen(createDevice({ katalogId: kat("MA NSP"), vlans: [] })), 1);
  assert.equal(maNetGen(createDevice({ typ: "pc", vlans: [] })), 0);
});

test("MA-Net3 im sauberen Licht-VLAN ohne Befund", () => {
  const { P, licht } = setup();
  licht.igmp = true; licht.querier = "Core"; licht.eeeAus = true;
  assert.deepEqual(ma(P), []);
});

test("MA-Net3 Gold-Standards schlagen an", () => {
  const { P, licht, pult } = setup();
  licht.igmp = false; licht.eeeAus = false;
  pult.interfaces[0].ip = "192.168.33.5";
  const g2 = createDevice({ katalogId: kat("grandMA2 light"), vlans: P.vlans, name: "Alt" });
  g2.interfaces[0].vlan = licht.id;
  P.geraete.push(g2);
  const msgs = ma(P).map((i) => i.msg).join("\n");
  assert.match(msgs, /IGMP-Snooping ist aus/);
  assert.match(msgs, /EEE aus/);
  assert.match(msgs, /192\.168\.33/);
  assert.match(msgs, /mischt MA-Net2 und MA-Net3/);
});

test("MA-Net3 an 100-Mbit-Port ist ein Fehler", () => {
  const { P, licht, node } = setup();
  licht.igmp = true; licht.querier = "Core"; licht.eeeAus = true;
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  sw.ports[0].speed = 100;
  P.geraete.push(sw);
  addConnection(P, node.id, sw.id, { portA: node.ports[0].id, portB: sw.ports[0].id });
  assert.ok(ma(P).some((i) => i.sev === "error" && /100 Mbit\/s/.test(i.msg)));
});
