import test from "node:test";
import assert from "node:assert/strict";
import { ip2int, int2ip, parseCidr, inSubnet, subnetsOverlap, parsePrefix, nextFreeIp, parseIpBereich, ipBereichFehler, isValidMac } from "../src/shared/net.js";

test("IPv4 parsen", () => {
  assert.equal(int2ip(ip2int("10.10.10.1")), "10.10.10.1");
  assert.equal(ip2int("256.1.1.1"), null);
  assert.equal(ip2int("10.10.10"), null);
});

test("CIDR und Masken", () => {
  const c = parseCidr("10.10.10.0/24");
  assert.equal(c.hosts, 254);
  assert.equal(int2ip(c.first), "10.10.10.1");
  assert.equal(int2ip(c.bcast), "10.10.10.255");
  assert.equal(parsePrefix("255.255.252.0"), 22);
  assert.equal(parsePrefix("/16"), 16);
  assert.equal(parsePrefix("255.0.255.0"), null);
  assert.equal(parseCidr("10.10.10.5/24").exact, false);
});

test("Subnetz-Zugehörigkeit und Überschneidung", () => {
  assert.ok(inSubnet("2.0.0.5", "2.0.0.0/8"));
  assert.ok(!inSubnet("10.10.11.5", "10.10.10.0/24"));
  assert.ok(subnetsOverlap("10.10.0.0/16", "10.10.20.0/24"));
  assert.ok(!subnetsOverlap("10.10.10.0/24", "10.10.11.0/24"));
});

test("Nächste freie Adresse", () => {
  const used = new Set([ip2int("192.168.1.1"), ip2int("192.168.1.2")]);
  assert.equal(nextFreeIp("192.168.1.0/24", used, ["192.168.1.3"]), "192.168.1.4");
  assert.ok(isValidMac("00:1d:c1:aa:bb:cc"));
  assert.ok(!isValidMac("00:1d:c1"));
});

test("Versionsvergleich mit Beta-Versionen", async () => {
  const { compareVersions, neuesteVersion } = await import("../src/shared/version.js");
  assert.ok(compareVersions("0.2.0-beta.1", "0.2.0-beta.2") < 0);
  assert.ok(compareVersions("0.2.0-beta.2", "0.2.0") < 0);
  assert.ok(compareVersions("v0.2.0", "0.1.9") > 0);
  assert.ok(compareVersions("0.2.0-beta.10", "0.2.0-beta.9") > 0);
  assert.equal(compareVersions("1.0.0", "v1.0.0"), 0);
  assert.equal(neuesteVersion([{ tag_name: "v0.2.0-beta.1" }, { tag_name: "v0.2.0-beta.3" }, { tag_name: "v0.3.0", draft: true }]).tag_name, "v0.2.0-beta.3");
});

test("IP-Bereich: parsen, beschneiden, prüfen", () => {
  const cidr = "10.10.20.0/24";
  assert.deepEqual(parseIpBereich({ von: "10.10.20.100", bis: "10.10.20.110" }, cidr), { first: ip2int("10.10.20.100"), last: ip2int("10.10.20.110") });
  // über das Subnetz hinaus: auf Host-Adressen beschnitten
  assert.deepEqual(parseIpBereich({ von: "10.10.19.250", bis: "10.10.20.255" }, cidr), { first: ip2int("10.10.20.1"), last: ip2int("10.10.20.254") });
  assert.equal(parseIpBereich({ von: "10.10.21.1", bis: "10.10.21.9" }, cidr), null);
  assert.equal(parseIpBereich({ von: "", bis: "" }, cidr), null);
  assert.equal(parseIpBereich({ von: "10.10.20.9", bis: "10.10.20.1" }, cidr), null);
  // ohne Subnetz zählt der Bereich allein
  assert.deepEqual(parseIpBereich({ von: "192.168.0.5", bis: "192.168.0.6" }), { first: ip2int("192.168.0.5"), last: ip2int("192.168.0.6") });

  assert.equal(ipBereichFehler({ von: "", bis: "" }, cidr), null);
  assert.equal(ipBereichFehler(undefined, cidr), null);
  assert.equal(ipBereichFehler({ von: "10.10.20.100", bis: "10.10.20.200" }, cidr), null);
  assert.equal(ipBereichFehler({ von: "10.10.20.100", bis: "" }, cidr), "unvollständig");
  assert.equal(ipBereichFehler({ von: "10.10.20.x", bis: "10.10.20.5" }, cidr), "ungueltig");
  assert.equal(ipBereichFehler({ von: "10.10.20.9", bis: "10.10.20.1" }, cidr), "vertauscht");
  assert.equal(ipBereichFehler({ von: "10.10.21.1", bis: "10.10.21.9" }, cidr), "ausserhalb");
  assert.equal(ipBereichFehler({ von: "10.10.20.0", bis: "10.10.20.20" }, cidr), "teilweise-ausserhalb");
});

test("Nächste freie Adresse innerhalb eines Bereichs", () => {
  const b = parseIpBereich({ von: "10.0.0.50", bis: "10.0.0.52" }, "10.0.0.0/24");
  const used = new Set([ip2int("10.0.0.50")]);
  assert.equal(nextFreeIp("10.0.0.0/24", used, ["10.0.0.51"], b), "10.0.0.52");
  used.add(ip2int("10.0.0.52"));
  assert.equal(nextFreeIp("10.0.0.0/24", used, ["10.0.0.51"], b), null); // voll: nicht außerhalb ausweichen
  assert.equal(nextFreeIp("", new Set(), [], parseIpBereich({ von: "172.16.0.9", bis: "172.16.0.9" })), "172.16.0.9");
});
