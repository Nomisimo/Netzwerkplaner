import test from "node:test";
import assert from "node:assert/strict";
import { ip2int, int2ip, parseCidr, inSubnet, subnetsOverlap, parsePrefix, nextFreeIp, isValidMac } from "../src/shared/net.js";

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
