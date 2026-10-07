import test from "node:test";
import assert from "node:assert/strict";
import ERG from "../src/shared/data/katalog-ergaenzungen.json";
import { KATALOG, KATALOG_GERAETE, parsePorts } from "../src/shared/catalog.js";
import { modellIcon } from "../src/shared/geraeteicons.js";

const eintrag = (g) => KATALOG.geraete.find((x) => x.Hersteller === g.Hersteller && x.Modell === g.Modell);

test("Jede Ergänzung steht in katalog.json (npm run ergaenzungen)", () => {
  for (const g of ERG.geraete) assert.deepEqual(eintrag(g), g, `${g.Hersteller} ${g.Modell}`);
});

test("Jede Ergänzung hat eine Quelle und eine Datenblatt-Markierung", () => {
  for (const g of ERG.geraete) {
    const name = `${g.Hersteller} ${g.Modell}`;
    assert.match(g.Quelle, /^https?:\/\//, name);
    assert.ok(["Ja", "Nein"].includes(g["Datenblatt vorhanden"]), name);
    if (g["Datenblatt vorhanden"] === "Ja") assert.match(g.Datenblatt, /^https?:\/\//, name);
    else assert.equal(g.Datenblatt, "", name);
  }
});

test("Portzahl der Ergänzungen ist eine Zahl und passt zu den Details", () => {
  for (const g of ERG.geraete) {
    const n = g["Netzwerkports (Anzahl)"];
    assert.match(n, /^\d+$/, `${g.Modell}: ${n}`);
    const isSwitch = /Switch/.test(g.Gerätetyp);
    assert.equal(parsePorts(g["Netzwerkports (Details)"], n, isSwitch).length, +n, `${g.Hersteller} ${g.Modell}: ${g["Netzwerkports (Details)"]}`);
  }
});

test("Ergänzte Hersteller stehen in der Herstellerliste", () => {
  const namen = new Set(KATALOG.hersteller.map((h) => h.Hersteller));
  for (const g of ERG.geraete) assert.ok(namen.has(g.Hersteller), g.Hersteller);
});

test("Neue Geräte bekommen passende Icons", () => {
  assert.equal(modellIcon("Allen & Heath", "SQ-5 / SQ-6"), "ah_sq");
  assert.equal(modellIcon("Avid", "VENUE S6L-24C / S6L-16C"), "avid_s6l");
  const typ = (h, m) => KATALOG_GERAETE.find((g) => g.hersteller === h && g.modell === m)?.typ;
  const lsp = ERG.geraete.find((g) => /Lautsprecher/.test(g.Gerätetyp));
  if (lsp) assert.equal(typ(lsp.Hersteller, lsp.Modell), "lautsprecher");
});
