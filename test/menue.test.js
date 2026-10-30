import test from "node:test";
import assert from "node:assert/strict";
import { menueVorlage } from "../src/main/menu.js";
import { STANDARD, TOPO_STANDARD } from "../src/renderer/einstellungen.js";

const app = { name: "Netzwerkplaner" };
const zustand = { einst: { ...STANDARD, topo: { ...TOPO_STANDARD } }, theme: "hell", tabs: [["projekt", "Projekt"], ["hilfe", "Hilfe"]], kapitel: [["start", "Erste Schritte"], ["topo", "Topologie"]] };
const recents = [{ name: "Open Air", filePath: "C:\\Pläne\\Open Air.netplan" }];

const alle = (liste, f = (x) => x) => liste.flatMap((x) => [f(x), ...(Array.isArray(x.submenu) ? alle(x.submenu, f) : [])]);
const finde = (liste, label) => alle(liste).find((x) => x.label === label);

for (const plattform of ["darwin", "win32"]) {
  test(`Menü ${plattform}: Kürzel eindeutig`, () => {
    const v = menueVorlage(null, app, { zustand, recents, plattform });
    const tasten = alle(v).map((x) => x.accelerator).filter(Boolean);
    assert.equal(new Set(tasten).size, tasten.length, tasten.join(" "));
  });
}

test("Menü macOS: keine &-Zeichen, App-Menü vorn, Hilfe hinten", () => {
  const v = menueVorlage(null, app, { zustand, recents, plattform: "darwin" });
  assert.ok(!alle(v).some((x) => /&\S/.test(x.label || "")));
  assert.equal(v[0].label, "Netzwerkplaner");
  assert.equal(v.at(-1).role, "help");
  assert.ok(!finde(v, "Menüleiste immer anzeigen"));
});

test("Menü Windows: Alt-Buchstaben je Ebene eindeutig, Menüleiste umschaltbar", () => {
  const v = menueVorlage(null, app, { zustand, recents, plattform: "win32" });
  const pruefe = (liste) => {
    const b = liste.map((x) => (x.label || "").replace(/&&/g, "").match(/&(\S)/)?.[1]?.toLowerCase()).filter(Boolean);
    assert.equal(new Set(b).size, b.length, liste.map((x) => x.label).join(" | "));
    liste.forEach((x) => Array.isArray(x.submenu) && pruefe(x.submenu));
  };
  pruefe(v);
  assert.equal(v[0].label, "&Datei");
  assert.ok(alle(v).every((x) => !/(Ctrl|Cmd)\+Alt/.test(x.accelerator || "")), "Strg+Alt ist AltGr");
  assert.equal(finde(v, "Menüleiste immer anzeigen").type, "checkbox");
});

test("Menü: Einstellungen als Häkchen, Kapitel und zuletzt geöffnete Dateien", () => {
  const v = menueVorlage(null, app, { zustand, recents, plattform: "darwin" });
  const hell = finde(finde(v, "Erscheinungsbild").submenu, "Hell");
  assert.equal(hell.type, "radio"); assert.ok(hell.checked);
  assert.ok(finde(finde(v, "Linien").submenu, "Rund").checked);
  assert.equal(finde(v, "Einrasten (Anschlüsse)").checked, TOPO_STANDARD.einrasten);
  assert.equal(finde(v, "Kabel bündeln (nur bei eckigen Linien)").enabled, false);
  assert.ok(finde(v, "Erste Schritte"));
  assert.ok(finde(v, "Open Air"));
  assert.ok(finde(v, "Hilfe")); // Tab aus dem gemeldeten Stand
  assert.ok(!finde(v, "VLANs")); // nur gemeldete Tabs
});

test("Menü ohne gemeldeten Stand", () => {
  const v = menueVorlage(null, app, { plattform: "win32" });
  assert.ok(finde(v, "Erscheinungsbild"));
  assert.ok(!finde(v, "Port-Lasche an Geräten"));
  assert.ok(finde(v, "Noch keine Dateien geöffnet"));
});
