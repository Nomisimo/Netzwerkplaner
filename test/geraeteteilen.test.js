import test from "node:test";
import assert from "node:assert/strict";
import { geraeteDatei, geraeteDateiLesen, geraeteImportVorschau, geraeteImportieren, geraeteDateiName, importMeldung, GERAETE_FORMAT } from "../src/shared/geraeteteilen.js";
import { newPort } from "../src/shared/catalog.js";

const ICON = { id: "ic1", name: "Mein Pult", data: "data:image/svg+xml;base64,PHN2Zy8+" };
const geraet = (o = {}) => ({
  name: "Pult", typ: "lichtpult", kategorie: "Licht", hersteller: "Acme", modell: "X1", icon: "custom:ic1",
  ports: [newPort({ id: "p1", name: "LAN 1", typ: "etherCON", seite: "hinten", stecker: "ethercon" }), newPort({ id: "p2", name: "LAN 2", typ: "RJ45", seite: "vorne" })],
  protokolle: ["Art-Net", "sACN"], webUi: { aktiv: true, iface: "p1", protokoll: "http", port: 80, pfad: "/" },
  felder: [{ id: "f-sn", name: "Seriennummer", wert: "SN-1" }], notizen: "Notiz", ...o,
});
const quelle = {
  vorlagen: [{ id: "v1", name: "Acme X1", geraet: geraet({ felder: [{ id: "f-sn", name: "Seriennummer", wert: "" }] }) }],
  bestand: [{ id: "b1", name: "Pult FOH", geraet: geraet({ name: "Pult FOH" }), angelegt: "2026-01-01" }],
  icons: [ICON, { id: "unbenutzt", name: "x", data: "data:image/png;base64,AA" }],
  felder: [{ id: "f-sn", name: "Seriennummer" }, { id: "f-case", name: "Case" }],
};

test("Export enthält Geräte vollständig, nur benutzte Icons und Felder", () => {
  const d = geraeteDatei({ vorlagen: quelle.vorlagen, bestand: quelle.bestand, library: quelle, app: "Netzwerkplaner 1.0" });
  assert.equal(d.format, GERAETE_FORMAT);
  assert.equal(d.version, 1);
  assert.deepEqual(d.icons.map((i) => i.id), ["ic1"]);
  assert.deepEqual(d.felder, [{ id: "f-sn", name: "Seriennummer" }]);
  const g = d.bestand[0].geraet;
  assert.equal(g.ports[0].seite, "hinten");
  assert.equal(g.ports[0].stecker, "ethercon");
  assert.deepEqual(g.protokolle, ["Art-Net", "sACN"]);
  assert.equal(g.webUi.iface, "p1");
  // Export ist eine Kopie
  d.bestand[0].geraet.name = "geändert";
  assert.equal(quelle.bestand[0].geraet.name, "Pult FOH");
});

test("Rundreise: Export → Datei → Import in leere Bibliothek", () => {
  const text = JSON.stringify(geraeteDatei({ vorlagen: quelle.vorlagen, bestand: quelle.bestand, library: quelle }));
  const datei = geraeteDateiLesen(text);
  const { library, zahlen } = geraeteImportieren(datei, {});
  assert.equal(zahlen.vorlagen, 1);
  assert.equal(zahlen.bestand, 1);
  assert.equal(zahlen.icons, 1);
  assert.deepEqual(library.icons, [ICON]);
  assert.deepEqual(library.felder, [{ id: "f-sn", name: "Seriennummer" }]);
  const g = library.bestand[0].geraet;
  assert.equal(g.icon, "custom:ic1");
  assert.equal(g.ports[0].seite, "hinten");
  assert.equal(g.webUi.aktiv, true);
  assert.equal(g.felder[0].wert, "SN-1");
  assert.equal(library.bestand[0].angelegt, "2026-01-01");
  // Zweiter Import derselben Datei ändert nichts
  const zwei = geraeteImportieren(datei, library);
  assert.equal(zwei.zahlen.gleich, 2);
  assert.equal(zwei.library.vorlagen.length, 1);
  assert.equal(zwei.library.bestand.length, 1);
  assert.match(importMeldung(zwei.zahlen), /schon vorhanden/);
});

test("Konflikt: ersetzen oder als Kopie", () => {
  const datei = geraeteDateiLesen(geraeteDatei({ vorlagen: quelle.vorlagen, library: quelle }));
  const hier = { vorlagen: [{ id: "v1", name: "Acme X1 alt", geraet: geraet({ ports: [] }) }] };
  const v = geraeteImportVorschau(datei, hier);
  assert.equal(v.vorlagen.konflikt.length, 1);
  const ersetzt = geraeteImportieren(datei, hier, { beiKonflikt: "ersetzen" });
  assert.equal(ersetzt.library.vorlagen.length, 1);
  assert.equal(ersetzt.library.vorlagen[0].name, "Acme X1");
  assert.equal(ersetzt.zahlen.ersetzt, 1);
  const kopie = geraeteImportieren(datei, hier, { beiKonflikt: "kopie" });
  assert.equal(kopie.library.vorlagen.length, 2);
  assert.notEqual(kopie.library.vorlagen[1].id, "v1");
  assert.equal(kopie.library.vorlagen[0].name, "Acme X1 alt");
});

test("Icons und Felder werden mit der Bibliothek zusammengeführt", () => {
  const datei = geraeteDateiLesen(geraeteDatei({ bestand: quelle.bestand, library: quelle }));
  // gleiche Icon-ID mit anderem Bild, gleichnamiges Feld mit anderer ID
  const hier = { icons: [{ id: "ic1", name: "anderes", data: "data:image/png;base64,BB" }], felder: [{ id: "sn-lokal", name: "seriennummer" }] };
  const { library, zahlen } = geraeteImportieren(datei, hier);
  assert.equal(library.icons.length, 2);
  const neuesIcon = library.icons[1];
  assert.notEqual(neuesIcon.id, "ic1");
  assert.equal(library.bestand[0].geraet.icon, "custom:" + neuesIcon.id);
  assert.equal(zahlen.felder, 0);
  assert.deepEqual(library.bestand[0].geraet.felder, [{ id: "sn-lokal", name: "seriennummer", wert: "SN-1" }]);
  // Gleiches Bild unter anderer ID wird wiederverwendet
  const r2 = geraeteImportieren(datei, { icons: [{ ...ICON, id: "schon-da" }] });
  assert.equal(r2.library.icons.length, 1);
  assert.equal(r2.library.bestand[0].geraet.icon, "custom:schon-da");
});

test("Fehlendes eigenes Icon fällt auf das Typ-Icon zurück", () => {
  const datei = geraeteDateiLesen({ format: GERAETE_FORMAT, vorlagen: [{ id: "v", name: "V", geraet: geraet() }] });
  const { library } = geraeteImportieren(datei, {});
  assert.equal(library.vorlagen[0].geraet.icon, "lichtpult");
});

test("Alte Bestandsdateien und ungültige Dateien", () => {
  const alt = geraeteDateiLesen(JSON.stringify({ format: "netzwerkplaner-bestand", version: 1, bestand: quelle.bestand, icons: [ICON] }));
  assert.equal(alt.bestand.length, 1);
  assert.equal(alt.icons.length, 1);
  // ältere Geräte mit getrennten Interfaces werden migriert
  const mitIfs = geraeteDateiLesen({ bestand: [{ id: "x", name: "X", geraet: { name: "X", ports: [{ id: "p", name: "LAN", iface: "i" }], interfaces: [{ id: "i", ip: "10.0.0.5", prefix: 24 }] } }] });
  assert.equal(mitIfs.bestand[0].geraet.ports[0].ip, "10.0.0.5");
  assert.equal(mitIfs.bestand[0].geraet.interfaces, undefined);
  assert.throws(() => geraeteDateiLesen("kein json"), /kein gültiges JSON/);
  assert.throws(() => geraeteDateiLesen({ format: "netzwerkplaner", geraete: [] }), /Projektdatei/);
  assert.throws(() => geraeteDateiLesen({ format: GERAETE_FORMAT, vorlagen: [] }), /keine Geräte/);
  assert.throws(() => geraeteDateiLesen({ format: "fremd" }), /Unbekanntes Dateiformat/);
  // Icons ohne Bilddaten werden verworfen
  assert.equal(geraeteDateiLesen({ bestand: quelle.bestand, icons: [{ id: "böse", data: "javascript:alert(1)" }] }).icons.length, 0);
});

test("Dateiname", () => {
  assert.equal(geraeteDateiName([{ name: "Pult: FOH/1" }]), "Gerät Pult FOH 1.json");
  assert.equal(geraeteDateiName([{}, {}]), "Geräte (2).json");
});
