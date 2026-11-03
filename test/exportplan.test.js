import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/shared/model.js";
import { demoProject } from "../src/shared/demo.js";
import { FARBEN_DUNKEL, FARBEN_HELL } from "../src/shared/constants.js";
import { naechsteVersion, planStand, versionsVorschlag, hellMachen, vlanGruppen, standortGruppen, switchGruppen } from "../src/shared/exportplan.js";

test("Planversion: letzte Zahl wird hochgezählt", () => {
  assert.equal(naechsteVersion("1"), "2");
  assert.equal(naechsteVersion("1.0"), "1.1");
  assert.equal(naechsteVersion("v2.9"), "v2.10");
  assert.equal(naechsteVersion("1.2-final"), "1.3-final");
  assert.equal(naechsteVersion("Entwurf"), "Entwurf.1");
  assert.equal(naechsteVersion(""), "1");
});

test("Planversion: Vorschlag erst nach Änderungen seit dem letzten Export", () => {
  const P = demoProject();
  P.meta.version = "3";
  assert.equal(versionsVorschlag(P).version, "3"); // noch nie exportiert
  P.meta.letzterExport = { version: "3", stand: planStand(P), zeit: new Date().toISOString() };
  assert.equal(versionsVorschlag(P).version, "3"); // unverändert
  P.meta.datum = "2030-01-01"; // Datum und Version zählen nicht als Änderung
  assert.equal(versionsVorschlag(P).geaendert, false);
  P.geraete[0].name = "Neu";
  const v = versionsVorschlag(P);
  assert.equal(v.geaendert, true);
  assert.equal(v.version, "4");
  P.meta.version = "4"; // Version schon von Hand erhöht: bleibt
  assert.equal(versionsVorschlag(P).version, "4");
});

test("Exporte hell: dunkle Oberflächenfarben werden hell, eigene Farben bleiben", () => {
  const svg = `<rect fill="${FARBEN_DUNKEL.CARD}" stroke="${FARBEN_DUNKEL.LINE}88"/><text fill="${FARBEN_DUNKEL.STRONG}">x</text><rect fill="#4ea1ff33"/><rect fill="#262d36"/>`;
  const h = hellMachen(svg, FARBEN_DUNKEL, FARBEN_HELL, { "#262d36": "#fbefed" });
  assert.ok(h.includes(`fill="${FARBEN_HELL.CARD}"`));
  assert.ok(h.includes(`stroke="${FARBEN_HELL.LINE}88"`));
  assert.ok(h.includes(`fill="${FARBEN_HELL.STRONG}"`));
  assert.ok(h.includes(`fill="#4ea1ff33"`)); // VLAN-Farbe bleibt (auch wenn sie wie INFO aussieht)
  assert.ok(h.includes(`fill="#fbefed"`));
});

test("VLAN-Liste: jede IP genau einmal, im VLAN ihres Ports", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const g = vlanGruppen(P, X);
  assert.equal(g.filter((x) => x.vlan).length, P.vlans.length);
  const alle = g.flatMap((x) => x.ips);
  const erwartet = P.geraete.flatMap((d) => d.ports.filter((p) => p.ip || p.dhcp)).length;
  assert.equal(alle.length, erwartet);
  for (const x of g) if (x.vlan && x.vlan.subnetz) for (const i of x.ips) if (i.ip !== "DHCP") assert.ok(i.ip.split(".").slice(0, 2).join(".") === x.vlan.subnetz.split(".").slice(0, 2).join("."), `${i.ip} in ${x.vlan.subnetz}`);
});

test("Geräte je Standort und Switch-Konfiguration: nichts fehlt, Switches zuerst", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const s = standortGruppen(P);
  assert.equal(s.flatMap((x) => x.geraete).length, P.geraete.length);
  for (const x of s) {
    const i = x.geraete.findIndex((d) => !d.isSwitch);
    if (i >= 0) assert.ok(x.geraete.slice(i).every((d) => !d.isSwitch));
  }
  const sw = switchGruppen(P, X);
  assert.equal(sw.length, P.geraete.filter((d) => d.isSwitch).length);
  const belegt = sw.flatMap((x) => x.ports).filter((p) => p.gegenstelle).length;
  assert.ok(belegt > 0);
});
