import test from "node:test";
import assert from "node:assert/strict";
import vlanpc from "../src/main/vlanpc.js";
import { vlanPcVorschlag } from "../src/shared/vlanpc.js";
import { emptyProject, newVlan } from "../src/shared/model.js";

const { parseHardwarePorts, parseVlans, pruefen, anlegenSkript, entfernenSkript, auswerten } = vlanpc;

const HW = `
Hardware Port: Ethernet
Device: en0
Ethernet Address: a4:83:e7:00:00:01

Hardware Port: Wi-Fi
Device: en1
Ethernet Address: a4:83:e7:00:00:02

Hardware Port: USB 10/100/1000 LAN
Device: en7
Ethernet Address: 00:e0:4c:00:00:03

Hardware Port: Thunderbolt Bridge
Device: bridge0
Ethernet Address: N/A

VLAN Configurations
===================
`;

const VL = `
VLAN User Defined Name: NP VLAN 20
Parent Device: en7
Device ("Hardware" Port): vlan0
Tag: 20

VLAN User Defined Name: Büro
Parent Device: en0
Device ("Hardware" Port): vlan1
Tag: 5
`;

test("Hardware-Ports: nur kabelgebundene enX-Karten", () => {
  assert.deepEqual(parseHardwarePorts(HW).map((p) => p.device), ["en0", "en7"]);
});

test("VLAN-Liste: eigene am Präfix erkannt", () => {
  const v = parseVlans(VL);
  assert.deepEqual(v.map((x) => [x.name, x.parent, x.device, x.tag, x.eigen]), [["NP VLAN 20", "en7", "vlan0", 20, true], ["Büro", "en0", "vlan1", 5, false]]);
  assert.deepEqual(parseVlans("There are no VLANs currently configured on this system."), []);
});

test("Prüfung der Einträge", () => {
  assert.equal(pruefen("en0; rm -rf /", [{ vid: 10, dhcp: true }]).ok, false);
  assert.equal(pruefen("en0", []).ok, false);
  assert.equal(pruefen("en0", [{ vid: 4095, dhcp: true }]).ok, false);
  assert.equal(pruefen("en0", [{ vid: 10, dhcp: true }, { vid: 10, dhcp: true }]).ok, false);
  assert.equal(pruefen("en0", [{ vid: 10, ip: "10.0.0.300", mask: "255.255.255.0" }]).ok, false);
  assert.equal(pruefen("en0", [{ vid: 10, ip: "10.0.0.5", mask: "255.0.255.0" }]).ok, false);
  assert.equal(pruefen("en0", [{ vid: 10, ip: "10.0.0.5'; reboot", mask: "255.255.255.0" }]).ok, false);
  const ok = pruefen("en0", [{ vid: "10", ip: "10.0.10.250", mask: "255.255.255.0", name: "egal" }, { vid: 20, dhcp: true }]);
  assert.deepEqual(ok.eintraege, [{ vid: 10, dhcp: false, ip: "10.0.10.250", mask: "255.255.255.0" }, { vid: 20, dhcp: true }]);
});

test("Skript: ersetzt eigenes VLAN gleicher ID, fasst fremde nicht an, kein Gateway", () => {
  const s = anlegenSkript("en7", [{ vid: 20, dhcp: false, ip: "10.0.20.250", mask: "255.255.255.0" }, { vid: 5, dhcp: true }], parseVlans(VL));
  assert.match(s, /ns -deleteVLAN 'NP VLAN 20' 'en7' 20/);
  assert.doesNotMatch(s, /deleteVLAN 'Büro'/);
  assert.match(s, /ns -createVLAN 'NP VLAN 20' 'en7' 20/);
  assert.match(s, /ns -setmanual 'NP VLAN 20' 10\.0\.20\.250 255\.255\.255\.0 &&/);
  assert.match(s, /ns -setdhcp 'NP VLAN 5'/);
  assert.ok(s.indexOf("-deleteVLAN 'NP VLAN 20'") < s.indexOf("-createVLAN 'NP VLAN 20'"));
  const e = entfernenSkript(parseVlans(VL));
  assert.match(e, /-deleteVLAN 'NP VLAN 20' 'en7' 20/);
  assert.doesNotMatch(e, /Büro/);
});

test("Ausgabe auswerten", () => {
  const r = auswerten("OK NP VLAN 20 10.0.20.250\nirgendwas\nFEHLER anlegen NP VLAN 30\n");
  assert.equal(r.ok, false);
  assert.deepEqual(r.meldungen, [{ ok: true, text: "NP VLAN 20 10.0.20.250" }, { ok: false, text: "anlegen NP VLAN 30" }]);
  assert.equal(auswerten("").ok, true);
});

test("Vorschlag: freie IP je VLAN, DHCP als Rückfall, VLAN 1 und eigenes Netz abgewählt", () => {
  const P = emptyProject({ mitVlans: false });
  P.vlans = [
    newVlan({ vid: 1, subnetz: "192.168.1.0/24" }),
    newVlan({ vid: 10, subnetz: "10.0.10.0/24", gateway: "10.0.10.1" }),
    newVlan({ vid: 20, subnetz: "10.0.20.0/24" }),
    newVlan({ vid: 30, dhcp: { aktiv: true, von: "", bis: "" } }),
    newVlan({ vid: 40 }),
  ];
  const r = vlanPcVorschlag(P, [{ name: "en0", cidr: "10.0.20.0/24" }]);
  const by = Object.fromEntries(r.map((x) => [x.vid, x]));
  assert.equal(by[1].an, false);
  assert.equal(by[10].an, true);
  assert.equal(by[10].mask, "255.255.255.0");
  assert.ok(by[10].ip.startsWith("10.0.10.") && by[10].ip !== "10.0.10.1");
  assert.equal(by[20].an, false);
  assert.match(by[20].hinweis, /en0/);
  assert.equal(by[30].dhcp, true);
  assert.equal(by[30].an, true);
  assert.equal(by[40].an, false);
  // die eigene VLAN-Schnittstelle zählt nicht als „schon erreichbar“
  assert.equal(vlanPcVorschlag(P, [{ name: "vlan0", cidr: "10.0.20.0/24" }], ["vlan0"]).find((x) => x.vid === 20).an, true);
});
