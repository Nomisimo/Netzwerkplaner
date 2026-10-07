import test from "node:test";
import assert from "node:assert/strict";
import { normMac, istGueltigeMac, istLokaleMac, istMulticastMac, macHersteller, herstellerPasst } from "../src/shared/mac.js";
import { emptyProject, validate, buildIndex } from "../src/shared/model.js";
import { createDevice, ipPorts } from "../src/shared/catalog.js";
import { sammleFunde } from "../src/shared/discovery.js";

test("MAC: Schreibweisen vereinheitlichen", () => {
  assert.equal(normMac("00-1D-C1-12-34-56"), "00:1d:c1:12:34:56");
  assert.equal(normMac("0:1d:c1:2:34:56"), "00:1d:c1:02:34:56"); // ARP-Tabelle macOS
  assert.equal(normMac("001d.c112.3456"), "00:1d:c1:12:34:56"); // Cisco
  assert.equal(normMac("001DC1123456"), "00:1d:c1:12:34:56");
  assert.equal(normMac("00:1d:c1:12:34"), "");
  assert.equal(normMac("zz:1d:c1:12:34:56"), "");
  assert.ok(istGueltigeMac(" 00:1d:c1:12:34:56 "));
});

test("MAC: lokal vergeben und Multicast", () => {
  assert.ok(istLokaleMac("a6:11:22:33:44:55"));
  assert.ok(!istLokaleMac("00:1d:c1:12:34:56"));
  assert.ok(istMulticastMac("01:00:5e:00:00:fb"));
  assert.equal(macHersteller("a6:11:22:33:44:55").art, "lokal");
  assert.equal(macHersteller("01:00:5e:00:00:fb").art, "multicast");
  assert.equal(macHersteller("kaputt").art, "ungueltig");
});

test("MAC: Hersteller aus der IEEE-Liste", () => {
  assert.match(macHersteller("00:1d:c1:12:34:56").name, /Audinate/i);
  assert.match(macHersteller("00:a0:de:01:02:03").name, /yamaha/i);
  assert.equal(macHersteller("00:1d:c1:12:34:56").art, "hersteller");
});

test("MAC: Hersteller gegen den Plan", () => {
  assert.equal(herstellerPasst("Yamaha", "00:a0:de:01:02:03"), true);
  assert.equal(herstellerPasst("Apple", "00:a0:de:01:02:03"), false);
  assert.equal(herstellerPasst("Yamaha", "00:1d:c1:12:34:56"), null); // Dante-Chip sagt nichts über den Gerätehersteller
  assert.equal(herstellerPasst("", "00:a0:de:01:02:03"), null);
  assert.equal(herstellerPasst("Yamaha", "a6:11:22:33:44:55"), null);
});

test("Prüfung: MAC doppelt und Hersteller passt nicht", () => {
  const P = emptyProject();
  const mk = (name, hersteller, mac) => { const d = createDevice({ typ: "pc", vlans: P.vlans, name }); d.hersteller = hersteller; ipPorts(d)[0].mac = mac; P.geraete.push(d); return d; };
  mk("Pult", "Apple", "00:a0:de:01:02:03");
  mk("Laptop", "", "00-A0-DE-01-02-03");
  const msgs = validate(P, buildIndex(P)).map((m) => m.msg).join("\n");
  assert.match(msgs, /MAC 00:a0:de:01:02:03 steht mehrfach im Plan/);
  assert.match(msgs, /gehört laut IEEE-Liste zu „YAMAHA/);
});

test("Discovery: Port 5959 ist der NDI Discovery Server, keine NDI-Quelle", () => {
  const f = sammleFunde({ scan: { hosts: [{ ip: "10.0.0.5", open: [5959] }] } });
  assert.deepEqual(f[0].protokolle, ["NDI Discovery Server"]);
  assert.equal(f[0].zustand, "aktiv");
});
