import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { MODELL_ICONS, modellIcon } from "../src/shared/geraeteicons.js";
import { KATALOG_GERAETE, createDevice } from "../src/shared/catalog.js";

const DIR = path.join(process.cwd(), "assets", "icons", "devices");

test("jedes Modell-Icon hat eine SVG-Datei", () => {
  for (const k of Object.keys(MODELL_ICONS)) assert.ok(fs.existsSync(path.join(DIR, k + ".svg")), k);
});

test("Pult-Generationen bekommen verschiedene Icons", () => {
  assert.equal(modellIcon("MA Lighting", "grandMA2 light"), "ma2_light");
  assert.equal(modellIcon("MA Lighting", "grandMA3 light CRV"), "ma3_light");
  assert.equal(modellIcon("MA Lighting", "grandMA (grandMA1) full-size / light / ultra-light / micro"), "ma1");
  const svg = (k) => fs.readFileSync(path.join(DIR, k + ".svg"), "utf8");
  assert.notEqual(svg("ma2_light"), svg("ma1"));
  assert.notEqual(svg("ma2_light"), svg("ma3_light"));
});

test("Software bekommt kein Hardware-Icon", () => {
  assert.equal(modellIcon("Yamaha", "CL/QL/DM7/DM3/TF/RIVAGE Editor & StageMix"), null);
  assert.equal(modellIcon("Audinate", "Dante Controller"), null);
});

test("Gerät aus dem Katalog übernimmt das Modell-Icon", () => {
  const k = KATALOG_GERAETE.find((g) => g.modell === "grandMA2 light");
  assert.equal(k.icon, "ma2_light");
  assert.equal(createDevice({ katalogId: k.id }).icon, "ma2_light");
  assert.equal(createDevice({ typ: "lichtpult" }).icon, "lichtpult");
});

test("Catalyst C1300-24P-4X hat ein eigenes Icon", () => {
  assert.equal(modellIcon("Cisco", "Catalyst 1300 C1300-24P-4X"), "cisco_c1300_24p4x");
  assert.equal(modellIcon("Cisco", "Catalyst 1300 C1300-24P-4G"), "cisco_24");
});
