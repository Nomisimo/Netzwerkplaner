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

test("Bestand: Gerät mit IPs sichern und in anderes Projekt einfügen (VLAN über VID)", async () => {
  const { snapshotDevice } = await import("../src/shared/catalog.js");
  const P = demoProject();
  const cl5 = P.geraete.find((d) => d.name === "FOH CL5");
  cl5.netzname = "FOH-CL5";
  cl5.inventar = { nr: "T-0042", sn: "ABC123", case: "Case 7" };
  const snap = snapshotDevice(cl5, P.vlans);
  const Q = emptyProject(); // neue VLAN-IDs, gleiche VIDs
  const d = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans, mitAdressen: true });
  const pri = d.interfaces.find((i) => i.name === "Primary");
  assert.equal(pri.ip, cl5.interfaces.find((i) => i.name === "Primary").ip);
  assert.equal(Q.vlans.find((v) => v.id === pri.vlan).vid, 10);
  assert.equal(d.netzname, "FOH-CL5");
  assert.equal(d.inventar.nr, "T-0042");
  assert.ok(d.interfaces.every((i) => !("vid" in i)));
  assert.notEqual(d.id, cl5.id);
  // Vorlage (ohne Adressen)
  const v = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans });
  assert.ok(v.interfaces.every((i) => !i.ip));
});

test("Gerät nachträglich auf ein Katalogmodell umbauen behält Name, IPs und Verbindungen", async () => {
  const { geraetUmbauen, createDevice, KATALOG_GERAETE } = await import("../src/shared/catalog.js");
  const { demoProject } = await import("../src/shared/demo.js");
  const P = demoProject();
  const X0 = buildIndex(P);
  const dev = P.geraete.find((g) => !g.isSwitch && g.interfaces.some((i) => i.ip));
  const ip = dev.interfaces.find((i) => i.ip).ip;
  const nConn = P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id).length;
  const k = KATALOG_GERAETE.find((g) => /grandMA3 light/i.test(g.modell));
  const neu = createDevice({ katalogId: k.id, vlans: P.vlans });
  geraetUmbauen(P, dev.id, neu);
  const d2 = P.geraete.find((g) => g.id === dev.id);
  assert.equal(d2.name, dev.name);
  assert.equal(d2.modell, k.modell);
  assert.ok(d2.interfaces.some((i) => i.ip === ip), "IP bleibt erhalten");
  const X = buildIndex(P);
  const conns = P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id);
  assert.equal(conns.length, nConn);
  for (const c of conns) for (const e of [c.a, c.b]) assert.ok(X.portRef.get(`${e.dev}:${e.port}`), "Port der Verbindung existiert");
  assert.ok(X0);
});

test("Modell zuweisen aus dem Bestand übernimmt feste IPs und Namen", async () => {
  const { geraetUmbauen, createDevice, snapshotDevice } = await import("../src/shared/catalog.js");
  const { demoProject } = await import("../src/shared/demo.js");
  const P = demoProject();
  const dev = P.geraete.find((g) => !g.isSwitch && g.interfaces.some((i) => i.ip));
  const nConn = P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id).length;
  const vorlage = createDevice({ typ: "lichtpult", vlans: P.vlans, name: "Pult 1" });
  vorlage.netzname = "3LT1"; vorlage.interfaces[0].ip = "10.10.20.201"; vorlage.interfaces[0].vlan = P.vlans.find((v) => v.vid === 20).id;
  const bestand = { id: "b1", name: "Pult 1", geraet: snapshotDevice(vorlage, P.vlans) };
  const neu = createDevice({ vlans: P.vlans, eigeneVorlage: bestand, mitAdressen: true });
  neu.bestandId = bestand.id;
  geraetUmbauen(P, dev.id, neu, { ausBestand: true });
  const d2 = P.geraete.find((g) => g.id === dev.id);
  assert.equal(d2.name, "Pult 1");
  assert.equal(d2.netzname, "3LT1");
  assert.equal(d2.bestandId, "b1");
  assert.equal(d2.interfaces[0].ip, "10.10.20.201");
  assert.equal(P.vlans.find((v) => v.id === d2.interfaces[0].vlan).vid, 20);
  assert.equal(P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id).length, nConn);
});

test("Cisco C1300-24P-4X im Katalog: 24 RJ45 und 4 SFP+", () => {
  const k = KATALOG_GERAETE.find((g) => g.modell.includes("C1300-24P-4X"));
  assert.ok(k, "Modell vorhanden");
  const d = createDevice({ katalogId: k.id, vlans: [] });
  assert.equal(d.isSwitch, true);
  assert.equal(d.ports.filter((p) => p.typ === "RJ45").length, 24);
  assert.equal(d.ports.filter((p) => p.typ === "SFP+").length, 4);
  assert.ok(d.webUi?.vorhanden);
});
