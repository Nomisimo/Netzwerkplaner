import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, buildIndex, validate, addConnection, vlansAbleiten, buildTree, suggestIp, standortUmbenennen } from "../src/shared/model.js";
import { createDevice, findProtokoll, parsePorts, KATALOG_GERAETE, ipPorts, snapshotDevice } from "../src/shared/catalog.js";
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

test("Yamaha M7CL: Karten-Dante bzw. EtherSound als P2P", () => {
  const m7 = createDevice({ katalogId: kat("M7CL-32 / M7CL-48"), vlans: emptyProject().vlans });
  assert.deepEqual(m7.ports.map((x) => x.name), ["NETWORK", "Primary", "Secondary"]);
  const es = createDevice({ katalogId: kat("M7CL-48ES"), vlans: emptyProject().vlans });
  assert.equal(es.ports.filter((x) => x.p2p && x.typ === "etherCON").length, 3);
  assert.equal(es.ports.filter((x) => !x.p2p).length, 1);
});

test("Neues Gerät bekommt kein VLAN, bis der Nutzer eins zuweist", () => {
  const P = emptyProject();
  for (const d of [createDevice({ katalogId: kat("Rio3224"), vlans: P.vlans }), createDevice({ typ: "node", vlans: P.vlans }), createDevice({ typ: "switch_managed", vlans: P.vlans })]) {
    assert.deepEqual(ipPorts(d).map((i) => i.vlan), ipPorts(d).map(() => null), d.name);
    assert.ok(d.ports.every((p) => !p.vlan && !p.vlans.length), d.name);
  }
  // Switch-Port übernimmt dann auch nichts
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const n = createDevice({ typ: "node", vlans: P.vlans });
  P.geraete.push(sw, n);
  addConnection(P, sw.id, n.id);
  assert.ok(sw.ports.every((p) => !p.vlan));
});

test("Neue Geräte und Vorlagen bringen kein VLAN mit, Switches schon", () => {
  const P = emptyProject();
  const d = createDevice({ katalogId: kat("Rio3224"), vlans: P.vlans });
  assert.ok(d.ports.every((p) => !p.vlan));
  ipPorts(d)[0].vlan = P.vlans[0].id;
  const n = P.vlans.length;
  const snap = snapshotDevice(d, P.vlans);
  assert.ok(snap.ports.every((p) => !p.vlan && p.vid == null) && !snap.vlanDefs.length);
  const Q = emptyProject(); Q.vlans = [];
  const e = createDevice({ eigeneVorlage: { geraet: { ...snap, ports: snap.ports.map((p, i) => (i ? p : { ...p, vid: 10 })) } }, vlans: Q.vlans });
  assert.ok(e.ports.every((p) => !p.vlan) && !Q.vlans.length, "alte Vorlage mit VLAN-ID legt nichts an");
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
  sw.ports[0].vlan = P.vlans[0].id;
  const s2 = createDevice({ eigeneVorlage: { geraet: snapshotDevice(sw, P.vlans) }, vlans: P.vlans });
  assert.equal(s2.ports[0].vlan, P.vlans[0].id);
  assert.equal(P.vlans.length, n);
});

test("Beispielprojekt: Dante-Gerät mit Primary/Secondary in VLAN 10/11 (vom Switch)", () => {
  const P = demoProject();
  const d = P.geraete.find((g) => g.name === "Rio A");
  const vid = (i) => P.vlans.find((v) => v.id === i.vlan)?.vid;
  assert.deepEqual(ipPorts(d).map(vid).slice(0, 2), [10, 11]);
});

test("Prüfung: IP-Konflikt, Subnetz, P2P am Switch, IGMP", () => {
  const P = emptyProject();
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const a = createDevice({ katalogId: kat("grandMA3 light"), vlans: P.vlans });
  const b = createDevice({ katalogId: kat("LumiNode 12"), vlans: P.vlans });
  const x32 = createDevice({ katalogId: KATALOG_GERAETE.find((g) => /AES50/.test(g.raw["Netzwerkports (Details)"])).id, vlans: P.vlans });
  P.geraete.push(sw, a, b, x32);
  ipPorts(a)[0].ip = "10.10.20.10"; ipPorts(b)[0].ip = "10.10.20.10";
  ipPorts(x32)[0].ip = "10.10.10.300";
  P.vlans.find((v) => v.vid === 20).igmp = false;
  addConnection(P, sw.id, a.id); addConnection(P, sw.id, b.id);
  const v20 = P.vlans.find((v) => v.vid === 20).id;
  for (const c of P.verbindungen) sw.ports.find((p) => p.id === c.a.port || p.id === c.b.port).vlan = v20;
  vlansAbleiten(P);
  const p2pPort = x32.ports.find((p) => p.p2p);
  addConnection(P, sw.id, x32.id, { portB: p2pPort.name });
  const msgs = validate(P, buildIndex(P)).map((i) => i.sev + ": " + i.msg).join("\n");
  assert.match(msgs, /error: IP-Konflikt 10\.10\.20\.10/);
  assert.match(msgs, /keine gültige IPv4/);
  assert.match(msgs, /Punkt-zu-Punkt-Verbindung/);
  assert.match(msgs, /warn: VLAN 20 Licht: Multicast/);
});

test("Endgerät bekommt das VLAN vom Switch-Port, Uplink wird Trunk", () => {
  const P = emptyProject();
  const s1 = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const s2 = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const um = createDevice({ typ: "switch_unmanaged", vlans: P.vlans });
  const n = createDevice({ typ: "node", vlans: P.vlans });
  const n2 = createDevice({ typ: "node", vlans: P.vlans });
  const n3 = createDevice({ typ: "node", vlans: P.vlans });
  const v20 = P.vlans.find((v) => v.vid === 20).id, v10 = P.vlans.find((v) => v.vid === 10).id;
  P.geraete.push(s1, s2, um, n, n2, n3);
  addConnection(P, s1.id, s2.id); addConnection(P, s2.id, n.id);
  assert.equal(s1.ports[0].modus, "trunk");
  // VLAN am Endgerät wird ignoriert, solange der Switch-Port keins hat
  ipPorts(n)[0].vlan = v10;
  vlansAbleiten(P);
  assert.equal(ipPorts(n)[0].vlan, null);
  // VLAN am Switch-Port gilt für das Endgerät
  const sp = s2.ports.find((p) => p.modus !== "trunk" && P.verbindungen.some((c) => c.a.port === p.id || c.b.port === p.id));
  sp.vlan = v20;
  vlansAbleiten(P);
  assert.equal(ipPorts(n)[0].vlan, v20);
  // über einen unmanaged Switch hinweg
  const sp2 = s2.ports.find((p) => p.modus !== "trunk" && !P.verbindungen.some((c) => c.a.port === p.id || c.b.port === p.id));
  sp2.vlan = v10;
  addConnection(P, s2.id, um.id, { portIdA: sp2.id }); addConnection(P, um.id, n2.id);
  vlansAbleiten(P);
  assert.equal(ipPorts(n2)[0].vlan, v10);
  // nicht gesteckt: VLAN aus dem Subnetz der IP
  ipPorts(n3)[0].ip = "10.10.20.50";
  vlansAbleiten(P);
  assert.equal(ipPorts(n3)[0].vlan, v20);
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

test("Bestand: Gerät mit IPs sichern und in anderes Projekt einfügen (ohne VLAN)", async () => {
  const { snapshotDevice } = await import("../src/shared/catalog.js");
  const P = demoProject();
  const cl5 = P.geraete.find((d) => d.name === "FOH CL5");
  cl5.netzname = "FOH-CL5";
  cl5.inventar = { nr: "T-0042", sn: "ABC123", case: "Case 7" };
  const snap = snapshotDevice(cl5, P.vlans);
  const Q = emptyProject(); // neue VLAN-IDs, gleiche VIDs
  const d = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans, mitAdressen: true });
  const pri = ipPorts(d).find((i) => i.name === "Primary");
  assert.equal(pri.ip, ipPorts(cl5).find((i) => i.name === "Primary").ip);
  assert.ok(!pri.vlan);
  assert.equal(d.netzname, "FOH-CL5");
  assert.equal(d.inventar.nr, "T-0042");
  assert.ok(ipPorts(d).every((i) => !("vid" in i)));
  assert.notEqual(d.id, cl5.id);
  // Vorlage (ohne Adressen)
  const v = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans });
  assert.ok(ipPorts(v).every((i) => !i.ip));
});

test("Gerät nachträglich auf ein Katalogmodell umbauen behält Name, IPs und Verbindungen", async () => {
  const { geraetUmbauen, createDevice, KATALOG_GERAETE } = await import("../src/shared/catalog.js");
  const { demoProject } = await import("../src/shared/demo.js");
  const P = demoProject();
  const X0 = buildIndex(P);
  const dev = P.geraete.find((g) => !g.isSwitch && ipPorts(g).some((i) => i.ip));
  const ip = ipPorts(dev).find((i) => i.ip).ip;
  const nConn = P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id).length;
  const k = KATALOG_GERAETE.find((g) => /grandMA3 light/i.test(g.modell));
  const neu = createDevice({ katalogId: k.id, vlans: P.vlans });
  geraetUmbauen(P, dev.id, neu);
  const d2 = P.geraete.find((g) => g.id === dev.id);
  assert.equal(d2.name, dev.name);
  assert.equal(d2.modell, k.modell);
  assert.ok(ipPorts(d2).some((i) => i.ip === ip), "IP bleibt erhalten");
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
  const dev = P.geraete.find((g) => !g.isSwitch && ipPorts(g).some((i) => i.ip));
  const nConn = P.verbindungen.filter((c) => c.a.dev === dev.id || c.b.dev === dev.id).length;
  const vorlage = createDevice({ typ: "lichtpult", vlans: P.vlans, name: "Pult 1" });
  vorlage.netzname = "3LT1"; ipPorts(vorlage)[0].ip = "10.10.20.201"; ipPorts(vorlage)[0].vlan = P.vlans.find((v) => v.vid === 20).id;
  const bestand = { id: "b1", name: "Pult 1", geraet: snapshotDevice(vorlage, P.vlans) };
  const neu = createDevice({ vlans: P.vlans, eigeneVorlage: bestand, mitAdressen: true });
  neu.bestandId = bestand.id;
  geraetUmbauen(P, dev.id, neu, { ausBestand: true });
  const d2 = P.geraete.find((g) => g.id === dev.id);
  assert.equal(d2.name, "Pult 1");
  assert.equal(d2.netzname, "3LT1");
  assert.equal(d2.bestandId, "b1");
  assert.equal(ipPorts(d2)[0].ip, "10.10.20.201");
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

test("Verbindungen: nicht mehr Kabel als Anschlüsse", async () => {
  const { freiePorts } = await import("../src/shared/model.js");
  const P = emptyProject();
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  const g = createDevice({ typ: "stagebox", vlans: P.vlans, name: "Box" });
  g.ports = g.ports.slice(0, 2);
  P.geraete.push(sw, g);
  const n = sw.ports.length;
  assert.ok(addConnection(P, sw.id, g.id));
  assert.ok(addConnection(P, sw.id, g.id));
  assert.equal(addConnection(P, sw.id, g.id), null);
  assert.equal(g.ports.length, 2);
  assert.equal(sw.ports.length, n);
  assert.equal(P.verbindungen.length, 2);
  assert.equal(freiePorts(P, g).length, 0);
  // gezielt einen Anschluss ersetzen
  const alt = P.verbindungen[0];
  P.verbindungen = P.verbindungen.filter((c) => c !== alt);
  assert.ok(addConnection(P, sw.id, g.id, { portIdB: alt.b.port }));
  assert.equal(P.verbindungen.length, 2);
});

test("Switch-Vorlage behält Port-VLANs (Access und Trunk), auch in einem anderen Projekt", () => {
  const P = emptyProject();
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
  const [a, b] = P.vlans;
  sw.ports[0].vlan = a.id;
  sw.ports[1].modus = "trunk"; sw.ports[1].vlans = [a.id, b.id];
  const snap = JSON.parse(JSON.stringify(snapshotDevice(sw, P.vlans))); // wie im Katalog gespeichert
  const Q = emptyProject(); Q.vlans = [];
  const s2 = createDevice({ eigeneVorlage: { geraet: snap }, vlans: Q.vlans });
  const vid = (id) => Q.vlans.find((v) => v.id === id)?.vid;
  assert.equal(vid(s2.ports[0].vlan), a.vid);
  assert.deepEqual(s2.ports[1].vlans.map(vid), [a.vid, b.vid]);
  assert.equal(Q.vlans.length, 2, "fehlende VLANs werden angelegt");
});

test("Standort global umbenennen: Liste, Geräte und Anmerkung ziehen mit", () => {
  const P = demoProject();
  P.bereiche = ["FOH", "Bühne"];
  P.standortInfo = { FOH: { anmerkung: "Galerie" } };
  assert.ok(standortUmbenennen(P, "FOH", "Regie"));
  assert.ok(P.bereiche.includes("Regie") && !P.bereiche.includes("FOH"));
  assert.strictEqual(P.geraete.filter((d) => d.bereich === "FOH").length, 0);
  assert.ok(P.geraete.some((d) => d.bereich === "Regie"));
  assert.deepStrictEqual(P.standortInfo.Regie, { anmerkung: "Galerie" });
  assert.strictEqual(P.standortInfo.FOH, undefined);
  // Zusammenführen, wenn der neue Name schon da ist
  assert.ok(standortUmbenennen(P, "Regie", "Bühne"));
  assert.deepStrictEqual(P.bereiche, ["Bühne"]);
  assert.strictEqual(P.geraete.filter((d) => d.bereich === "Regie").length, 0);
  assert.ok(!standortUmbenennen(P, "Bühne", "Bühne"));
});
