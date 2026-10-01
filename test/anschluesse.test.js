import { test } from "node:test";
import assert from "node:assert/strict";
import { steckerTyp, portSeiten, recherche } from "../src/shared/anschluesse.js";
import { plattenGeometrie } from "../src/shared/frontplatte.js";

const port = (id, typ, extra = {}) => ({ id, name: id, typ, ...extra });

test("Steckertyp aus dem Porttyp", () => {
  assert.equal(steckerTyp(port("a", "etherCON")), "ethercon");
  assert.equal(steckerTyp(port("a", "SFP+")), "sfp_plus");
  assert.equal(steckerTyp(port("a", "opticalCON")), "opticalcon_duo");
  assert.equal(steckerTyp(port("a", "RJ45")), "rj45");
  assert.equal(steckerTyp(port("a", "WLAN")), null);
});

test("Seite je Port aus der Recherche, eigene Angabe gewinnt", () => {
  assert.ok(recherche({ hersteller: "Luminex", modell: "GigaCore 16Xt (Gen1)" }));
  const ports = Array.from({ length: 12 }, (_, i) => port("p" + (i + 1), "etherCON"));
  const dev = { hersteller: "Luminex", modell: "GigaCore 16Xt (Gen1)", ports };
  const s = portSeiten(dev);
  assert.equal(s.get("p1"), "vorne");
  assert.equal(s.get("p10"), "vorne");
  assert.equal(s.get("p11"), "hinten");
  assert.equal(s.get("p12"), "hinten");
  const eigen = portSeiten({ ...dev, ports: ports.map((p, i) => (i === 0 ? { ...p, seite: "hinten" } : p)) });
  assert.equal(eigen.get("p1"), "hinten");
  // Gerät ohne Recherche: Seite unbekannt
  assert.equal(portSeiten({ hersteller: "X", modell: "Y", ports: [port("a", "RJ45")] }).get("a"), null);
});

test("Frontplatte zeigt Vorder- und Rückseite nebeneinander", () => {
  const ports = Array.from({ length: 12 }, (_, i) => port("p" + (i + 1), "etherCON"));
  const g = plattenGeometrie({ hersteller: "Luminex", modell: "GigaCore 16Xt (Gen1)", ports });
  assert.deepEqual(g.seiten.map((t) => t.seite), ["vorne", "hinten"]);
  assert.ok(g.slots.get("p11").x > g.seiten[1].x0 - 1);
  assert.ok(g.slots.get("p10").x < g.seiten[0].x1 + 1);
  assert.equal(g.slots.get("p11").seite, "hinten");
  // nur eine Seite: keine Beschriftung
  assert.equal(plattenGeometrie({ hersteller: "X", modell: "Y", ports: ports.slice(0, 4) }).seiten.length, 0);
});
