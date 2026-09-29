import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, buildIndex, validate, addConnection, buildTree, suggestIp } from "../src/shared/model.js";
import { createDevice, findProtokoll, parsePorts, KATALOG_GERAETE } from "../src/shared/catalog.js";
import { demoProject } from "../src/shared/demo.js";
import { layoutMindmap } from "../src/shared/layout.js";

const kat = (s) => KATALOG_GERAETE.find((g) => `${g.hersteller} ${g.modell}`.includes(s)).id;

test("Protokollzuordnung aus dem Katalog", () => {
  assert.equal(findProtokoll("sACN (E1.31)").name, "sACN (Streaming ACN)");
  assert.equal(findProtokoll("Art-Net").name, "Art-Net 4");
  assert.equal(findProtokoll("Dante (Karte)").name, "Dante");
  assert.ok(findProtokoll("AES50").flags.p2p);
  assert.ok(findProtokoll("sACN (E1.31)").flags.igmp);
});

test("Ports aus Katalogtext", () => {
  const p = parsePorts("2× etherCON (Dante Pri/Sec), 1× RJ45 Network", "3", false);
  assert.deepEqual(p.map((x) => x.name), ["Primary", "Secondary", "Network"]);
  const g = parsePorts("GC10: 8× etherCON + 2× SFP; GC30i: 24× RJ45 + 6× SFP+", "10 / 30", true);
  assert.equal(g.length, 10);
  assert.equal(g.filter((x) => x.typ === "SFP").length, 2);
  assert.ok(parsePorts("1× RJ45 Network, 4× AES50 (etherCON)", "", false).filter((x) => x.p2p).length === 4);
});

test("Dante-Gerät bekommt Primary/Secondary in VLAN 10/11", () => {
  const P = emptyProject();
  const d = createDevice({ katalogId: kat("Rio3224"), vlans: P.vlans });
  const vid = (i) => P.vlans.find((v) => v.id === i.vlan)?.vid;
  assert.deepEqual(d.interfaces.map(vid).slice(0, 2), [10, 11]);
});

test("Prüfung: IP-Konflikt, Subnetz, P2P am Switch, IGMP", () => {
  const P = emptyProject();
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const a = createDevice({ katalogId: kat("grandMA3 light"), vlans: P.vlans });
  const b = createDevice({ katalogId: kat("LumiNode 12"), vlans: P.vlans });
  const x32 = createDevice({ katalogId: KATALOG_GERAETE.find((g) => /AES50/.test(g.raw["Netzwerkports (Details)"])).id, vlans: P.vlans });
  P.geraete.push(sw, a, b, x32);
  a.interfaces[0].ip = "10.10.20.10"; b.interfaces[0].ip = "10.10.20.10";
  x32.interfaces[0].ip = "10.10.10.300";
  P.vlans.find((v) => v.vid === 20).igmp = false;
  addConnection(P, sw.id, a.id); addConnection(P, sw.id, b.id);
  const p2pPort = x32.ports.find((p) => p.p2p);
  addConnection(P, sw.id, x32.id, { portB: p2pPort.name });
  const msgs = validate(P, buildIndex(P)).map((i) => i.sev + ": " + i.msg).join("\n");
  assert.match(msgs, /error: IP-Konflikt 10\.10\.20\.10/);
  assert.match(msgs, /keine gültige IPv4/);
  assert.match(msgs, /Punkt-zu-Punkt-Verbindung/);
  assert.match(msgs, /warn: VLAN 20 Licht: Multicast/);
});

test("Switch-Port übernimmt VLAN, Uplink wird Trunk", () => {
  const P = emptyProject();
  const s1 = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const s2 = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const n = createDevice({ typ: "node", vlans: P.vlans });
  P.geraete.push(s1, s2, n);
  addConnection(P, s1.id, s2.id); addConnection(P, s2.id, n.id);
  assert.equal(s1.ports[0].modus, "trunk");
  assert.equal(s2.ports.find((p) => p.vlan)?.vlan, n.interfaces[0].vlan);
  assert.equal(suggestIp(P, P.vlans.find((v) => v.vid === 20)), "10.10.20.10");
});

test("Beispielprojekt: fehlerfrei, Mindmap mit Secondary-Insel", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const issues = validate(P, X);
  assert.equal(issues.filter((i) => i.sev === "error").length, 0, issues.map((i) => i.msg).join("\n"));
  const T = buildTree(P, X);
  assert.equal(T.roots.length, 2);
  const L = layoutMindmap(P, T);
  assert.equal(L.pos.size, P.geraete.length);
});
