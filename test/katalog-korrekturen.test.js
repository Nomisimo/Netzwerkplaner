import test from "node:test";
import assert from "node:assert/strict";
import KORR from "../src/shared/data/katalog-korrekturen.json";
import { KATALOG, KATALOG_GERAETE, createDevice, parsePorts } from "../src/shared/catalog.js";

const eintrag = (k) => KATALOG.geraete.find((g) => g.Hersteller === k.Hersteller && g.Modell === k.Modell);

test("Jede Korrektur trifft einen Katalogeintrag und ist in katalog.json angewendet", () => {
  for (const k of KORR.korrekturen) {
    const g = eintrag(k);
    assert.ok(g, `${k.Hersteller} ${k.Modell} fehlt im Katalog`);
    for (const [f, v] of Object.entries(k.felder)) assert.equal(g[f], v, `${k.Modell}: ${f} (npm run korrekturen vergessen?)`);
    assert.equal(g.Quelle, k.Quelle);
  }
});

test("Korrigierte Portangaben ergeben die angegebene Portzahl", () => {
  for (const k of KORR.korrekturen) {
    const g = eintrag(k);
    const n = String(g["Netzwerkports (Anzahl)"] || "").match(/^\d+$/);
    if (!n || !g["Netzwerkports (Details)"]) continue;
    const isSwitch = /Switch/.test(g.Gerätetyp);
    assert.equal(parsePorts(g["Netzwerkports (Details)"], n[0], isSwitch).length, +n[0], k.Modell);
  }
});

test("Switch aus dem Katalog bringt sein PoE-Budget mit", () => {
  const id = (m) => KATALOG_GERAETE.find((g) => g.modell === m).id;
  assert.equal(createDevice({ katalogId: id("SWR2100P-5G / SWR2100P-10G") }).poeBudget, 70);
  assert.equal(createDevice({ katalogId: id("SWR2310-10G / -18GT / -28GT") }).poeBudget, 0);
  assert.equal(createDevice({ katalogId: id("grandMA3 xPort Node 4Port / 8Port") }).poeBudget, undefined);
});

test("YDIF-Buchsen gelten als Punkt-zu-Punkt", () => {
  const p = parsePorts("2× RJ45 (Dante Pri/Sec 1000BASE-T), 1× YDIF (RJ45, Punkt-zu-Punkt)", "", false);
  assert.deepEqual(p.map((x) => x.p2p), [false, false, true]);
});
