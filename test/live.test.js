import test from "node:test";
import assert from "node:assert/strict";
import dgram from "node:dgram";
import sacn from "../src/main/monitor/sacn.js";
import artnet from "../src/main/monitor/artnet.js";
import citp from "../src/main/monitor/citp.js";
import osc from "../src/main/monitor/osc.js";
import ptp from "../src/main/monitor/ptp.js";
import mdns from "../src/main/monitor/mdns.js";
import snmp from "../src/main/monitor/snmp.js";
import scan from "../src/main/monitor/scan.js";
import { emptyProject, buildIndex } from "../src/shared/model.js";
import { createDevice, ipPorts } from "../src/shared/catalog.js";
import { compareScan, compareSwitchPorts, snmpSwitches } from "../src/shared/live.js";

/* ── Testpakete ─────────────────────────────────────────────────────────── */
function sacnData(universe, name, prio, values, { seq = 1, options = 0, startCode = 0 } = {}) {
  const b = Buffer.alloc(126 + values.length);
  b.writeUInt16BE(0x10, 0);
  Buffer.from("ASC-E1.17\0\0\0", "latin1").copy(b, 4);
  b.writeUInt16BE(0x7000 | (b.length - 16), 16); b.writeUInt32BE(4, 18); Buffer.alloc(16, 0xab).copy(b, 22);
  b.writeUInt16BE(0x7000 | (b.length - 38), 38); b.writeUInt32BE(2, 40); b.write(name, 44); b[108] = prio; b[111] = seq; b[112] = options; b.writeUInt16BE(universe, 113);
  b.writeUInt16BE(0x7000 | (b.length - 115), 115); b[117] = 2; b[118] = 0xa1; b.writeUInt16BE(1, 121); b.writeUInt16BE(values.length + 1, 123); b[125] = startCode;
  Buffer.from(values).copy(b, 126);
  return b;
}
function sacnDiscovery(name, universes) {
  const b = Buffer.alloc(120 + universes.length * 2);
  b.writeUInt16BE(0x10, 0);
  Buffer.from("ASC-E1.17\0\0\0", "latin1").copy(b, 4);
  b.writeUInt32BE(8, 18); b.writeUInt32BE(2, 40); b.write(name, 44);
  b.writeUInt16BE(0x7000 | (b.length - 112), 112); b.writeUInt32BE(1, 114); b[118] = 0; b[119] = 0;
  universes.forEach((u, i) => b.writeUInt16BE(u, 120 + i * 2));
  return b;
}
const oscStr = (t) => { const b = Buffer.from(t + "\0"); return Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]); };

/* ── Parser ─────────────────────────────────────────────────────────────── */
test("sACN: Datenpaket, Preview und Stream-Ende", () => {
  const p = sacn.parse(sacnData(7, "grandMA3", 120, [255, 0, 12]));
  assert.equal(p.type, "data");
  assert.equal(p.universe, 7);
  assert.equal(p.source, "grandMA3");
  assert.equal(p.priority, 120);
  assert.deepEqual([...p.data], [255, 0, 12]);
  assert.ok(sacn.parse(sacnData(1, "x", 100, [1], { options: 0x40 })).preview);
  assert.ok(sacn.parse(sacnData(1, "x", 100, [1], { options: 0x20 })).terminated);
  assert.equal(sacn.parse(Buffer.from("kein sACN")), null);
  assert.equal(sacn.groupFor(1), "239.255.0.1");
  assert.equal(sacn.groupFor(300), "239.255.1.44");
});

test("sACN: Universe Discovery", () => {
  const p = sacn.parse(sacnDiscovery("Eos", [1, 2, 10]));
  assert.equal(p.type, "discovery");
  assert.equal(p.source, "Eos");
  assert.deepEqual(p.universes, [1, 2, 10]);
});

test("Art-Net: ArtDmx und ArtPollReply", () => {
  const dmx = Buffer.alloc(18 + 4);
  dmx.write("Art-Net\0", 0, "latin1"); dmx.writeUInt16LE(0x5000, 8); dmx[11] = 14; dmx[14] = 0x12; dmx[15] = 0x01; dmx.writeUInt16BE(4, 16); dmx[18] = 200;
  const d = artnet.parse(dmx);
  assert.equal(d.portAddress, 0x112);
  assert.equal(artnet.fmtPortAddr(d.portAddress), "1:1:2");
  assert.equal(d.data[0], 200);

  const r = Buffer.alloc(239);
  r.write("Art-Net\0", 0, "latin1"); r.writeUInt16LE(0x2100, 8); [2, 0, 0, 10].forEach((x, i) => (r[10 + i] = x));
  r[18] = 0; r[19] = 3; r.write("LumiNode", 26); r.write("LumiNode 4 Test", 44); r.writeUInt16BE(2, 172);
  r[174] = 0x80; r[175] = 0x40; r[190] = 5; r[187] = 9; [0, 0x50, 0xc2, 1, 2, 3].forEach((x, i) => (r[201 + i] = x)); r[211] = 1;
  const n = artnet.parse(r);
  assert.equal(n.ip, "2.0.0.10");
  assert.equal(n.shortName, "LumiNode");
  assert.equal(n.mac, "00:50:c2:01:02:03");
  assert.deepEqual(n.ports.map((p) => [p.dir, artnet.fmtPortAddr(p.portAddress)]), [["out", "0:3:5"], ["in", "0:3:9"]]);
  const poll = artnet.pollPacket();
  assert.equal(poll.length, 14);
  assert.equal(artnet.parse(poll).op, 0x2000);
});

test("CITP: PINF/PLoc", () => {
  const body = Buffer.concat([Buffer.from([0x39, 0x30]), Buffer.from("MediaServer\0Pixera\0Running\0")]);
  const h = Buffer.alloc(24);
  h.write("CITP", 0, "latin1"); h[4] = 1; h.writeUInt32LE(24 + body.length, 8); h.write("PINF", 16, "latin1"); h.write("PLoc", 20, "latin1");
  const p = citp.parse(Buffer.concat([h, body]));
  assert.equal(p.message, "PLoc");
  assert.equal(p.tcpPort, 12345);
  assert.equal(p.type, "MediaServer");
  assert.equal(p.name, "Pixera");
  assert.equal(p.state, "Running");
});

test("OSC: Nachricht und Bundle", () => {
  const f = Buffer.alloc(4); f.writeFloatBE(0.25);
  const i = Buffer.alloc(4); i.writeInt32BE(-3);
  const msg = Buffer.concat([oscStr("/gma3/cmd"), oscStr(",fisT"), f, i, oscStr("Go+")]);
  assert.deepEqual(osc.parse(msg), [{ address: "/gma3/cmd", types: "fisT", args: [0.25, -3, "Go+", true] }]);
  const len = Buffer.alloc(4); len.writeInt32BE(msg.length);
  const bundle = Buffer.concat([oscStr("#bundle"), Buffer.alloc(8), len, msg, len, msg]);
  assert.equal(osc.parse(bundle).length, 2);
});

test("PTP: v2 Announce und v1 Sync", () => {
  const a = Buffer.alloc(64);
  a[0] = 0x0b; a[1] = 0x02; a[4] = 0; Buffer.from("001dc1fffe123456", "hex").copy(a, 20); a[47] = 128; a[48] = 248; a[52] = 127; Buffer.from("001dc1fffe123456", "hex").copy(a, 53); a.writeUInt16BE(1, 61);
  const p = ptp.parse(a);
  assert.equal(p.version, 2);
  assert.equal(p.type, "Announce");
  assert.equal(p.gm, "001dc1fffe123456");
  assert.equal(p.prio2, 127);
  assert.equal(p.stepsRemoved, 1);

  const s = Buffer.alloc(124);
  s.writeUInt16BE(1, 0); s.write("_DFLT", 4); s[20] = 1; Buffer.from("001dc1aabbcc", "hex").copy(s, 22); s[32] = 0; s[67] = 4; s.write("DFLT", 68);
  const v1 = ptp.parse(s);
  assert.equal(v1.version, 1);
  assert.equal(v1.domain, "_DFLT");
  assert.equal(v1.type, "Sync");
  assert.equal(v1.clock, "00:1d:c1:aa:bb:cc");
  assert.equal(v1.stratum, 4);
});

test("mDNS: Abfrage bauen und Antwort mit Namenskompression lesen", () => {
  const q = mdns.buildQuery(["_ndi._tcp.local"]);
  assert.equal(q.readUInt16BE(4), 1);
  // Antwort: PTR _ndi._tcp.local → "CAM1 (Studio)._ndi._tcp.local", SRV, A
  const name = (s) => Buffer.concat([...s.split(".").map((l) => Buffer.concat([Buffer.from([Buffer.byteLength(l)]), Buffer.from(l)])), Buffer.from([0])]);
  const rr = (n, type, data) => { const h = Buffer.alloc(10); h.writeUInt16BE(type, 0); h.writeUInt16BE(1, 2); h.writeUInt32BE(120, 4); h.writeUInt16BE(data.length, 8); return Buffer.concat([n, h, data]); };
  const head = Buffer.alloc(12); head.writeUInt16BE(0x8400, 2); head.writeUInt16BE(1, 6); head.writeUInt16BE(2, 10);
  const svc = name("_ndi._tcp.local"); // Offset 12
  const inst = Buffer.concat([Buffer.from([13]), Buffer.from("CAM1 (Studio)"), Buffer.from([0xc0, 12])]);
  const ptrData = inst;
  const srvData = Buffer.concat([Buffer.from([0, 0, 0, 0, 0x17, 0x48]), name("cam1.local")]);
  const pkt = Buffer.concat([head, rr(svc, 12, ptrData), rr(Buffer.concat([Buffer.from([13]), Buffer.from("CAM1 (Studio)"), Buffer.from([0xc0, 12])]), 33, srvData), rr(name("cam1.local"), 1, Buffer.from([10, 0, 30, 5]))]);
  const r = mdns.parse(pkt);
  assert.ok(r.response);
  assert.deepEqual(r.records.map((x) => x.type), [12, 33, 1]);
  assert.equal(r.records[0].data, "CAM1 (Studio)._ndi._tcp.local");
  assert.equal(r.records[1].data.port, 5960);
  assert.equal(r.records[1].data.target, "cam1.local");
  assert.equal(r.records[2].data, "10.0.30.5");
});

test("Scan: ARP-Ausgabe von macOS, Windows und Linux", () => {
  const mac = "? (192.168.1.20) at 0:1d:c1:a:b:c on en0 ifscope [ethernet]\n? (192.168.1.255) at ff:ff:ff:ff:ff:ff on en0";
  const win = "  192.168.1.21          00-a0-de-11-22-33     dynamisch\n  224.0.0.251           01-00-5e-00-00-fb     statisch";
  const lin = "? (192.168.1.22) at 00:50:c2:44:55:66 [ether] on eth0";
  assert.deepEqual(scan.parseArp(mac), { "192.168.1.20": "00:1d:c1:0a:0b:0c" });
  assert.deepEqual(scan.parseArp(win), { "192.168.1.21": "00:a0:de:11:22:33" });
  assert.deepEqual(scan.parseArp(lin), { "192.168.1.22": "00:50:c2:44:55:66" });
  assert.equal(scan.hostsOf("10.0.0.0/24").length, 254);
  assert.equal(scan.hostsOf("10.0.0.0/24")[0], "10.0.0.1");
  assert.throws(() => scan.hostsOf("10.0.0.0/16"), /zu groß/);
});

/* ── SNMP ───────────────────────────────────────────────────────────────── */
test("SNMP: OID-Kodierung und Anfrage", () => {
  const oid = "1.0.8802.1.1.2.1.4.1.1.9";
  assert.equal(snmp.decOid(snmp.encOid(oid).subarray(2)), oid);
  const req = snmp.buildRequest({ pdu: 0xa0, id: 4711, oids: ["1.3.6.1.2.1.1.5.0"] });
  const r = snmp.parseResponse(req);
  assert.equal(r.id, 4711);
  assert.equal(r.varbinds[0].oid, "1.3.6.1.2.1.1.5.0");
  assert.equal(r.varbinds[0].value, null);
  assert.deepEqual([...snmp.portBits(Buffer.from([0xa0, 0x01]))], [1, 3, 16]);
});

// Kleiner SNMP-Agent für den Test: 3 Ports, PVIDs, LLDP-Nachbar an Port 2
function fakeAgent() {
  const { tlv, encInt, encOid, OID } = snmp;
  const str = (s) => tlv(0x04, Buffer.from(s));
  const mib = [
    [OID.sysDescr, str("Test-Switch 24")], [OID.sysUpTime, tlv(0x43, Buffer.from([0x01, 0x00, 0x00]))], [OID.sysName, str("SW-FOH")], [OID.sysLocation, str("FOH")],
    ...[1, 2, 3].flatMap((i) => [
      [`${OID.ifDescr}.${i}`, str(`Port ${i}`)], [`${OID.ifType}.${i}`, encInt(6)], [`${OID.ifOper}.${i}`, encInt(i === 3 ? 2 : 1)], [`${OID.ifAdmin}.${i}`, encInt(1)],
      [`${OID.ifName}.${i}`, str(`gi${i}`)], [`${OID.ifHighSpeed}.${i}`, tlv(0x42, Buffer.from([0x03, 0xe8]))],
      [`${OID.basePortIfIndex}.${i}`, encInt(i)], [`${OID.pvid}.${i}`, tlv(0x42, Buffer.from([i === 1 ? 10 : 20]))],
    ]),
    [`${OID.vlanName}.10`, str("Dante")], [`${OID.vlanName}.20`, str("Licht")],
    [`${OID.lldpRemSysName}.0.2.1`, str("grandMA3 light")], [`${OID.lldpRemPortDesc}.0.2.1`, str("Con1")],
  ].map(([o, v]) => ({ o, parts: o.split(".").map(Number), v }));
  const cmp = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
  mib.sort((a, b) => cmp(a.parts, b.parts));
  const sock = dgram.createSocket("udp4");
  sock.on("message", (buf, rinfo) => {
    const req = snmp.parseResponse(buf); // gleiche Struktur wie die Anfrage
    const pdu = buf[buf.indexOf(Buffer.from([0x04, 6])) + 8]; // Tag hinter "public"
    const out = [];
    for (const vb of req.varbinds) {
      const p = vb.oid.split(".").map(Number);
      if (pdu === 0xa0) { const e = mib.find((m) => m.o === vb.oid); out.push([vb.oid, e ? e.v : Buffer.from([0x80, 0])]); }
      else { const next = mib.filter((m) => cmp(m.parts, p) > 0).slice(0, pdu === 0xa5 ? 5 : 1); if (!next.length) out.push([vb.oid, Buffer.from([0x82, 0])]); next.forEach((e) => out.push([e.o, e.v])); }
    }
    const vbl = tlv(0x30, Buffer.concat(out.map(([o, v]) => tlv(0x30, Buffer.concat([encOid(o), v])))));
    const resp = tlv(0x30, Buffer.concat([encInt(1), str("public"), tlv(0xa2, Buffer.concat([encInt(req.id), encInt(0), encInt(0), vbl]))]));
    sock.send(resp, rinfo.port, rinfo.address);
  });
  return new Promise((r) => sock.bind(0, "127.0.0.1", () => r(sock)));
}

test("SNMP: Switch auslesen und mit dem Plan vergleichen", async () => {
  const agent = await fakeAgent();
  try {
    const r = await snmp.readSwitch("127.0.0.1", "public", agent.address().port);
    assert.equal(r.sysName, "SW-FOH");
    assert.equal(r.uptime, 655);
    assert.deepEqual(r.ports.map((p) => [p.ifName, p.up, p.pvid, p.ifHighSpeed]), [["gi1", true, 10, 1000], ["gi2", true, 20, 1000], ["gi3", false, 20, 1000]]);
    assert.deepEqual(r.ports[1].lldp, [{ system: "grandMA3 light", port: "Con1", localDesc: "" }]);
    assert.deepEqual(r.vlans, [{ vid: 10, name: "Dante" }, { vid: 20, name: "Licht" }]);

    const P = emptyProject();
    const sw = createDevice({ typ: "switch_managed", vlans: P.vlans });
    ipPorts(sw)[0].ip = "127.0.0.1";
    const v10 = P.vlans.find((v) => +v.vid === 10), v20 = P.vlans.find((v) => +v.vid === 20);
    sw.ports[0].vlan = v10.id; sw.ports[1].vlan = v10.id; sw.ports[2].vlan = v20.id;
    P.geraete.push(sw);
    assert.equal(snmpSwitches(P).length, 1);
    const cmp = compareSwitchPorts(sw, buildIndex(P), r.ports);
    assert.deepEqual(cmp.map((c) => c.hinweise), [[], ["PVID 20 statt VLAN 10"], []]);
  } finally { agent.close(); }
});

/* ── Soll/Ist ───────────────────────────────────────────────────────────── */
test("Scan-Abgleich mit dem Plan", () => {
  const P = emptyProject();
  const mk = (name, ip, mac = "") => { const d = createDevice({ typ: "pc", vlans: P.vlans, name }); ipPorts(d)[0].ip = ip; ipPorts(d)[0].mac = mac; P.geraete.push(d); return d; };
  mk("Pult", "10.0.0.10", "00:11:22:33:44:55");
  mk("Node", "10.0.0.11");
  mk("Laptop", "10.0.0.12", "aa:bb:cc:dd:ee:ff");
  mk("Anderes Netz", "10.1.0.5");
  const hosts = [
    { ip: "10.0.0.10", mac: "00:11:22:33:44:99" },
    { ip: "10.0.0.50", mac: "aa:bb:cc:dd:ee:ff" },
    { ip: "10.0.0.99" },
  ];
  const { rows, count } = compareScan(P, hosts, "10.0.0.0/24");
  assert.deepEqual(count, { mac: 1, verschoben: 1, offline: 1, unbekannt: 1, ok: 0 });
  assert.equal(rows.find((r) => r.status === "offline").dev.name, "Node");
  assert.equal(rows.find((r) => r.status === "verschoben").host.ip, "10.0.0.50");
  assert.equal(rows.find((r) => r.status === "unbekannt").ip, "10.0.0.99");
});
