// Online-Prüfung über alle VLANs gleichzeitig: jede IP über jede passende Netzwerkkarte
import test from "node:test";
import assert from "node:assert/strict";
import erreichbar from "../src/main/monitor/erreichbar.js";
import { emptyProject } from "../src/shared/model.js";
import { viaVlan, erreichbarUeber, viaText } from "../src/shared/live.js";

const IFS = [
  { name: "en0", address: "192.168.1.20", prefix: 24, cidr: "192.168.1.0/24" },
  { name: "vlan0", address: "10.0.20.250", prefix: 24, cidr: "10.0.20.0/24" },
  { name: "vlan1", address: "10.0.30.250", prefix: 24, cidr: "10.0.30.0/24" },
];
const NAMEN = { vlan0: "NP - Licht", vlan1: "NP - Ton" };

test("Alle VLANs: Weg über die Netzwerkkarte des passenden Netzes, sonst Systemroute", () => {
  const w = erreichbar.wege([{ id: "a", ip: "10.0.20.11" }, { id: "b", ip: "10.0.30.5" }, { id: "c", ip: "8.8.8.8" }, { id: "d", ip: "kaputt" }], "*", IFS, NAMEN);
  assert.equal(w.length, 3);
  assert.deepEqual(w[0].wege, [{ src: "10.0.20.250", iface: "vlan0", cidr: "10.0.20.0/24", label: "NP - Licht" }]);
  assert.equal(w[1].wege[0].iface, "vlan1");
  assert.deepEqual(w[2].wege, [{ src: "", iface: "", cidr: "", label: "Systemroute" }]);
});

test("Zwei Karten im selben Netz: beide werden geprüft", () => {
  const ifs = [...IFS, { name: "en7", address: "10.0.20.251", prefix: 24, cidr: "10.0.20.0/24" }];
  const w = erreichbar.wege([{ id: "a", ip: "10.0.20.11" }], "*", ifs, NAMEN);
  assert.deepEqual(w[0].wege.map((x) => x.iface), ["vlan0", "en7"]);
});

test("Feste Netzwerkkarte: alles über diese eine Quelle wie bisher", () => {
  const w = erreichbar.wege([{ id: "a", ip: "10.0.20.11" }], "192.168.1.20", IFS, NAMEN);
  assert.deepEqual(w[0].wege, [{ src: "192.168.1.20", iface: "en0", cidr: "192.168.1.0/24", label: "en0" }]);
  assert.equal(erreichbar.wege([{ id: "a", ip: "10.0.20.11" }], "", IFS)[0].wege[0].src, "");
});

test("Prüfung parallel über alle Wege, Ergebnis nennt die antwortende Schnittstelle", async () => {
  const ifs = [...IFS, { name: "en7", address: "10.0.20.251", prefix: 24, cidr: "10.0.20.0/24" }];
  const aufrufe = [];
  const mit = {
    ping: async (ip, { src }) => { aufrufe.push(`${ip}@${src}`); return { ok: src === "10.0.20.251" || ip === "10.0.30.5", ms: 3, ttl: 64 }; },
    tcpProbe: async (ip, port, { src }) => ({ alive: ip === "10.0.30.5" && src === "10.0.30.250", ms: 2 }),
  };
  const r = await erreichbar.pruefen([{ id: "a", ip: "10.0.20.11" }, { id: "b", ip: "10.0.30.5", port: 80 }, { id: "c", ip: "10.0.40.1" }], "*", { interfaces: ifs, namen: NAMEN, mit });
  assert.equal(r.a.ok, true);
  assert.equal(r.a.via.length, 2);
  assert.equal(r.a.via[0].iface, "en7"); // antwortende zuerst
  assert.equal(r.a.via[1].ok, false);
  assert.equal(r.b.method, "TCP 80");
  assert.equal(r.b.via[0].label, "NP - Ton");
  assert.equal(r.c.ok, false);
  assert.equal(r.c.via[0].label, "Systemroute");
  assert.ok(aufrufe.includes("10.0.20.11@10.0.20.250") && aufrufe.includes("10.0.20.11@10.0.20.251"));
});

test("Anzeige: VLAN im Plan zur Schnittstelle am Rechner", () => {
  const P = emptyProject();
  P.vlans = [{ id: "v1", vid: 20, name: "Licht", subnetz: "10.0.20.0/24", farbe: "#f00" }, { id: "v2", vid: 30, name: "Ton", subnetz: "", farbe: "#0f0" }];
  assert.equal(viaVlan(P, { src: "10.0.20.250", label: "NP - Licht" }).vid, 20);
  assert.equal(viaVlan(P, { src: "10.0.30.250", label: "NP - Ton" }).vid, 30); // ohne Netz über den Namen
  assert.equal(viaVlan(P, { src: "192.168.1.20", label: "en0" }), null);
  const st = { ok: true, via: [{ ok: true, iface: "vlan0", label: "NP - Licht", src: "10.0.20.250", ip: "10.0.20.11" }, { ok: true, iface: "vlan0", label: "NP - Licht", src: "10.0.20.250", ip: "10.0.20.12" }] };
  const u = erreichbarUeber(P, st);
  assert.equal(u.length, 1);
  assert.deepEqual(u[0].ips, ["10.0.20.11", "10.0.20.12"]);
  assert.equal(viaText(P, st.via[0]), "VLAN 20 Licht (NP - Licht, vlan0)");
  assert.equal(viaText(P, { iface: "en0", label: "en0", src: "192.168.1.20" }), "en0");
});
