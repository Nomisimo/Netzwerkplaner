import test from "node:test";
import assert from "node:assert/strict";
import { ipv4Rechnen, v4Aufteilen, ipv6Rechnen, v6zuZahl, v6Kurz, v6Voll, macZuLinkLocal, netzRechnen } from "../src/shared/netzrechner.js";

test("Netzrechner IPv4: Netz, Broadcast, Hosts, Klasse, Bereich", () => {
  const r = ipv4Rechnen("192.168.1.130/26");
  assert.equal(r.netz, "192.168.1.128");
  assert.equal(r.broadcast, "192.168.1.191");
  assert.equal(r.erste, "192.168.1.129");
  assert.equal(r.letzte, "192.168.1.190");
  assert.equal(r.hosts, 62);
  assert.equal(r.maske, "255.255.255.192");
  assert.equal(r.wildcard, "0.0.0.63");
  assert.equal(r.klasse.k, "C");
  assert.equal(r.bereich.art, "privat");
  assert.equal(ipv4Rechnen("10.0.0.1 255.255.0.0").prefix, 16);
  assert.equal(ipv4Rechnen("10.0.0.1", "255.0.0.0").prefix, 8);
  assert.equal(ipv4Rechnen("172.20.1.1").prefix, 16, "ohne Maske gilt die Klassenmaske");
  assert.equal(ipv4Rechnen("169.254.3.4/16").bereich.art, "linklocal");
  assert.equal(ipv4Rechnen("100.64.0.1/10").bereich.name.includes("NAT"), true);
  assert.equal(ipv4Rechnen("239.255.0.1/32").klasse.k, "D");
  assert.equal(ipv4Rechnen("8.8.8.8/32").bereich.art, "oeffentlich");
  const p31 = ipv4Rechnen("10.0.0.0/31");
  assert.equal(p31.hosts, 2); assert.equal(p31.broadcast, null);
  assert.ok(ipv4Rechnen("10.0.0.1/255.0.255.0").fehler);
  assert.equal(ipv4Rechnen("10.0.0.300/24"), null);
});

test("Netzrechner IPv4: Aufteilen in Teilnetze", () => {
  const a = v4Aufteilen("10.10.0.0/22", 24);
  assert.equal(a.anzahl, 4);
  assert.deepEqual(a.netze.map((n) => n.cidr), ["10.10.0.0/24", "10.10.1.0/24", "10.10.2.0/24", "10.10.3.0/24"]);
  assert.equal(a.hostsJe, 254);
  assert.equal(v4Aufteilen("10.0.0.0/8", 30, 10).gekuerzt, true);
  assert.equal(v4Aufteilen("10.0.0.0/24", 16), null);
});

test("Netzrechner IPv6: Kurz-/Langform, Bereiche, EUI-64", () => {
  const n = v6zuZahl("2001:0db8:0000:0000:0000:ff00:0042:8329");
  assert.equal(v6Kurz(n), "2001:db8::ff00:42:8329");
  assert.equal(v6Voll(v6zuZahl("::1")), "0000:0000:0000:0000:0000:0000:0000:0001");
  assert.equal(v6Kurz(v6zuZahl("2001:db8:0:1:0:0:0:1")), "2001:db8:0:1::1", "längste Nullfolge wird gekürzt");
  assert.equal(v6zuZahl("1::2::3"), null);
  assert.equal(v6zuZahl("12345::"), null);
  const r = ipv6Rechnen("fe80::0211:22ff:fe33:4455/64");
  assert.equal(r.bereich.art, "linklocal");
  assert.equal(r.mac, "00:11:22:33:44:55");
  assert.equal(r.netz, "fe80::/64");
  assert.equal(ipv6Rechnen("fd12:3456:789a::1/48").bereich.art, "privat");
  assert.equal(ipv6Rechnen("2a00:1450::1").bereich.art, "oeffentlich");
  assert.equal(ipv6Rechnen("ff02::fb").bereich.art, "multicast");
  assert.equal(ipv6Rechnen("::ffff:192.168.1.5").v4, "192.168.1.5");
  assert.equal(ipv6Rechnen("2001:db8::/48").subnetze64, "65.536");
  assert.equal(macZuLinkLocal("00:11:22:33:44:55"), "fe80::211:22ff:fe33:4455");
  assert.equal(netzRechnen("10.0.0.1/8").v, 4);
  assert.equal(netzRechnen("::1").v, 6);
});

test("v4Aufteilen: /8 in /24-Netze, seitenweise", () => {
  const a = v4Aufteilen("10.0.0.0/8", 24, 512);
  assert.equal(a.anzahl, 65536);
  assert.equal(a.netze.length, 512);
  assert.equal(a.netze[256].cidr, "10.1.0.0/24");
  assert.ok(a.gekuerzt);
});
