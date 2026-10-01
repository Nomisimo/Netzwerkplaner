import test from "node:test";
import assert from "node:assert/strict";
import { migrateProject, buildIndex, validate, webUrl, connVlan } from "../src/shared/model.js";
import { migrateBibliothek, createDevice, ipPorts, physPorts } from "../src/shared/catalog.js";
import { konfigNormal, konfigAnwenden } from "../src/shared/konfig.js";
import { streamVlans } from "../src/shared/analyse.js";
import { plattenGeometrie } from "../src/shared/frontplatte.js";

// Projektdatei aus Versionen mit getrennten Ports und Interfaces
const altesProjekt = () => ({
  format: "netzwerkplaner", version: 1,
  vlans: [{ id: "v10", vid: 10, name: "Dante" }, { id: "v11", vid: 11, name: "Dante Sec" }, { id: "v99", vid: 99, name: "Mgmt" }, { id: "v20", vid: 20, name: "Licht" }],
  geraete: [
    { id: "sw", name: "Switch", typ: "switch_managed", isSwitch: true,
      interfaces: [{ id: "im", name: "Management", ip: "10.0.99.2", prefix: 24, gateway: "10.0.99.1", vlan: "v99", mac: "aa:bb:cc:00:00:01", dhcp: false }],
      ports: [{ id: "s1", name: "1", typ: "RJ45", iface: null, modus: "access", vlan: "v10", vlans: [], poe: true, p2p: false },
        { id: "s2", name: "2", typ: "RJ45", iface: null, modus: "access", vlan: "v11", vlans: [], poe: false, p2p: false },
        { id: "s3", name: "3", typ: "RJ45", iface: null, modus: "access", vlan: "v20", vlans: [], poe: false, p2p: false }],
      webUi: { vorhanden: true, url: "http://{ip}", iface: "im" } },
    { id: "rio", name: "Rio", typ: "stagebox", isSwitch: false, protokolle: ["Dante"],
      interfaces: [{ id: "i1", name: "Primary", ip: "10.0.10.5", prefix: 24, gateway: "", vlan: "v10", mac: "", dhcp: false },
        { id: "i2", name: "Secondary", ip: "10.0.11.5", prefix: 16, gateway: "", vlan: "v11", mac: "", dhcp: false }],
      ports: [{ id: "r1", name: "Primary", typ: "etherCON", iface: "i1" }, { id: "r2", name: "Secondary", typ: "etherCON", iface: "i2" }],
      webUi: { vorhanden: true, url: "http://{ip}", iface: "i2" },
      stroeme: [{ id: "st", proto: "dante", menge: 8, iface: "i2", ziele: [] }] },
    // Node mit zwei Ports an einem Interface (Daisy-Chain) und einem AES50-Port ohne Interface
    { id: "node", name: "Node", typ: "node", isSwitch: false,
      interfaces: [{ id: "n1", name: "Steuerung", ip: "10.0.20.7", prefix: 24, gateway: "10.0.20.1", vlan: "v20", mac: "00:11:22:33:44:55", dhcp: false },
        { id: "nleer", name: "LAN 2", ip: "", prefix: 24, gateway: "", vlan: null, mac: "", dhcp: false }],
      ports: [{ id: "a", name: "LAN 1", iface: "n1" }, { id: "b", name: "LAN 2", iface: "n1" }, { id: "c", name: "AES50", p2p: true, iface: null }] },
  ],
  verbindungen: [{ id: "c1", a: { dev: "sw", port: "s1" }, b: { dev: "rio", port: "r1" } }, { id: "c2", a: { dev: "sw", port: "s2" }, b: { dev: "rio", port: "r2" } },
    { id: "c3", a: { dev: "sw", port: "s3" }, b: { dev: "node", port: "a" } }],
});

test("Migration: Ports und Interfaces werden zu einer Liste", () => {
  const P = migrateProject(altesProjekt());
  for (const d of P.geraete) assert.ok(!("interfaces" in d), d.name);
  const [sw, rio, node] = P.geraete;

  // Switch: physische Ports unverändert, Management wird virtueller Anschluss mit denselben Daten
  assert.deepEqual(physPorts(sw).map((p) => [p.id, p.vlan, p.poe]), [["s1", "v10", true], ["s2", "v11", false], ["s3", "v20", false]]);
  const m = sw.ports.find((p) => p.virtuell);
  assert.deepEqual([m.id, m.name, m.ip, m.gateway, m.vlan, m.mac], ["im", "Management", "10.0.99.2", "10.0.99.1", "v99", "aa:bb:cc:00:00:01"]);
  assert.equal(webUrl(sw), "http://10.0.99.2");

  // Endgerät: Interface-Daten liegen am Port, Verweise zeigen auf den Port
  assert.deepEqual(rio.ports.map((p) => [p.id, p.name, p.typ, p.ip, p.prefix, p.vlan]), [["r1", "Primary", "etherCON", "10.0.10.5", 24, "v10"], ["r2", "Secondary", "etherCON", "10.0.11.5", 16, "v11"]]);
  assert.ok(rio.ports.every((p) => !("iface" in p)));
  assert.equal(rio.webUi.iface, "r2");
  assert.equal(webUrl(rio), "http://10.0.11.5");
  assert.equal(rio.stroeme[0].iface, "r2");
  assert.deepEqual(streamVlans(rio, rio.stroeme[0]), ["v11"]);

  // Geteiltes Interface: IP und MAC am ersten Port, VLAN/Maske/Gateway an beiden; Name vom Interface; leeres Interface fällt weg
  assert.deepEqual(node.ports.map((p) => [p.name, p.ip, p.mac, p.vlan, p.gateway]),
    [["Steuerung", "10.0.20.7", "00:11:22:33:44:55", "v20", "10.0.20.1"], ["LAN 2", "", "", null, "10.0.20.1"], ["AES50", "", "", null, ""]]);
  // VLAN der Endgeräte kommt vom Switch-Port: LAN 2 steckt nirgends und hat keine IP, also kein VLAN
  assert.ok(node.ports.every((p) => !p.virtuell));

  // Verbindungen und Prüfung funktionieren weiter
  const X = buildIndex(P);
  assert.deepEqual(connVlan(P.verbindungen[1], X).vlans, ["v11"]);
  const issues = validate(P, X);
  assert.ok(!issues.some((i) => i.sev === "error"), JSON.stringify(issues.filter((i) => i.sev === "error")));
  assert.ok(!issues.some((i) => /Access-VLAN/.test(i.msg)), "Switch-Port und Gerät im selben VLAN");
  // Frontplatte zeigt nur Buchsen
  assert.equal(plattenGeometrie(sw).slots.size, 3);
});

test("Migration ist idempotent", () => {
  const einmal = migrateProject(altesProjekt());
  const zweimal = migrateProject(JSON.parse(JSON.stringify(einmal)));
  assert.deepEqual(zweimal.geraete, einmal.geraete);
});

test("Migration: Vorlagen und Bestand der Bibliothek", () => {
  const alt = altesProjekt().geraete[1];
  alt.interfaces.forEach((i, n) => (i.vid = [10, 11][n]));
  const lib = migrateBibliothek({ vorlagen: [{ id: "t", name: "Rio", geraet: JSON.parse(JSON.stringify(alt)) }], bestand: [{ id: "b", name: "Rio 1", geraet: alt }] });
  assert.deepEqual(lib.vorlagen[0].geraet.ports.map((p) => p.vid), [10, 11]);
  assert.ok(!("interfaces" in lib.bestand[0].geraet));
  // Aus der alten Vorlage ein Gerät in ein Projekt mit anderen VLAN-ids einfügen
  const vlans = [{ id: "x10", vid: 10 }, { id: "x11", vid: 11 }];
  const d = createDevice({ eigeneVorlage: lib.bestand[0], vlans, mitAdressen: true });
  assert.deepEqual(d.ports.map((p) => [p.vlan, p.ip]), [["x10", "10.0.10.5"], ["x11", "10.0.11.5"]]);
  assert.equal(d.webUi.iface, d.ports[1].id);
});

test("Migration: kopierte Konfiguration aus älterer Version", () => {
  const clip = { art: "konfig", quelle: { name: "Alt" }, teile: ["ports", "interfaces"], daten: {
    ports: [{ name: "Primary", typ: "etherCON", modus: "access", poe: false, p2p: false, vlan: null, vlans: [], iface: 0 }],
    interfaces: [{ name: "Primary", vlan: { id: "v10", vid: 10 }, prefix: 24, gateway: "10.0.10.1", dhcp: false }],
  } };
  const n = konfigNormal(clip);
  assert.deepEqual(n.teile, ["ports"]);
  const ziel = createDevice({ typ: "stagebox" });
  ziel.ports[0].name = "Primary";
  konfigAnwenden(ziel, clip, ["ports"], [{ id: "v10", vid: 10 }]);
  assert.equal(ziel.ports[0].vlan, "v10");
  assert.equal(ziel.ports[0].gateway, "10.0.10.1");
});

test("Neuer managed Switch hat ein Management-Interface ohne Buchse", () => {
  const sw = createDevice({ typ: "switch_managed" });
  const m = ipPorts(sw);
  assert.equal(m.length, 1);
  assert.ok(m[0].virtuell);
  assert.equal(sw.webUi.iface, m[0].id);
  assert.ok(!physPorts(sw).includes(m[0]));
  assert.equal(ipPorts(createDevice({ typ: "switch_unmanaged" })).length, 0);
});
