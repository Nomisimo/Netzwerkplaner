/* ── Geräte teilen ─────────────────────────────────────────────────────────
   Vorlagen und Bestandsgeräte als Datei an eine andere Netzwerkplaner-Installation
   weitergeben. Die Datei trägt die Geräte vollständig: Ports mit Steckertyp und
   Geräteseite (vorne/hinten), Protokolle, Web-UI, Datenströme, Notizen, eigene
   Felder samt Definition und eigene Icons samt Bilddaten. Katalog-Geräte verweisen
   zusätzlich über katalogId auf das Herstellermodell.

   Datei   { format: "netzwerkplaner-geraete", version: 1, erstellt, app?, vorlagen[], bestand[], icons[], felder[] }
   Ältere Bestands-Exporte ({ format: "netzwerkplaner-bestand", bestand, icons }) werden ebenso gelesen. */
import { uid, migrateBibliothek } from "./catalog.js";
import { migrateFelder } from "./felder.js";
import { TYPEN } from "./constants.js";

export const GERAETE_FORMAT = "netzwerkplaner-geraete";
export const GERAETE_VERSION = 1;
const ALTE_FORMATE = ["netzwerkplaner-bestand"];

const kopie = (x) => JSON.parse(JSON.stringify(x));
const iconId = (g) => (typeof g?.icon === "string" && g.icon.startsWith("custom:") ? g.icon.slice(7) : null);

// Datei für die gewählten Vorlagen und Bestandseinträge (Einträge wie in library.vorlagen / library.bestand)
export const geraeteDatei = ({ vorlagen = [], bestand = [], library = {}, app = null } = {}) => {
  const eintraege = [...vorlagen, ...bestand];
  const geraete = eintraege.map((e) => e.geraet).filter(Boolean);
  const iconIds = new Set(geraete.map(iconId).filter(Boolean));
  const feldIds = new Set(geraete.flatMap((g) => (g.felder || []).map((f) => f.id)));
  const felder = (library.felder || []).filter((f) => feldIds.has(f.id)).map(({ id, name }) => ({ id, name }));
  // Felder, die nur am Gerät stehen (ohne Definition im Katalog), bekommen ihre Definition aus dem Gerät
  for (const g of geraete) for (const f of g.felder || []) if (!felder.some((x) => x.id === f.id)) felder.push({ id: f.id, name: f.name || "Feld" });
  return {
    format: GERAETE_FORMAT, version: GERAETE_VERSION, erstellt: new Date().toISOString(), ...(app ? { app } : {}),
    vorlagen: kopie(vorlagen), bestand: kopie(bestand),
    icons: kopie((library.icons || []).filter((i) => iconIds.has(i.id))),
    felder,
  };
};

export const geraeteDateiName = (eintraege) => {
  const sauber = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return eintraege.length === 1 ? `Gerät ${sauber(eintraege[0].name) || "ohne Name"}.json` : `Geräte (${eintraege.length}).json`;
};

/* Datei lesen und prüfen. Gibt { vorlagen, bestand, icons, felder } zurück (migriert auf das
   aktuelle Gerätemodell) oder wirft einen Fehler mit lesbarer Meldung. */
export const geraeteDateiLesen = (text) => {
  let data;
  try { data = typeof text === "string" ? JSON.parse(String(text).replace(/^﻿/, "")) : text; } catch { throw new Error("Die Datei ist kein gültiges JSON."); }
  if (!data || typeof data !== "object") throw new Error("Die Datei enthält keine Geräte.");
  if (data.format === "netzwerkplaner") throw new Error("Das ist eine Projektdatei. Öffne sie über Datei › Öffnen.");
  if (data.format && data.format !== GERAETE_FORMAT && !ALTE_FORMATE.includes(data.format)) throw new Error(`Unbekanntes Dateiformat „${data.format}“.`);
  const gueltig = (e) => e && typeof e === "object" && e.geraet && typeof e.geraet === "object" && (Array.isArray(e.geraet.ports) || Array.isArray(e.geraet.interfaces));
  const roh = { vorlagen: (Array.isArray(data.vorlagen) ? data.vorlagen : []).filter(gueltig), bestand: (Array.isArray(data.bestand) ? data.bestand : []).filter(gueltig) };
  if (!roh.vorlagen.length && !roh.bestand.length) throw new Error("Die Datei enthält keine Geräte.");
  const m = migrateBibliothek(kopie(roh));
  const fertig = (e) => ({ ...e, id: e.id || uid(), name: String(e.name || e.geraet.name || [e.geraet.hersteller, e.geraet.modell].filter(Boolean).join(" ") || "Gerät"), geraet: migrateFelder(e.geraet) });
  const icons = (Array.isArray(data.icons) ? data.icons : []).filter((i) => i && i.id && typeof i.data === "string" && /^data:image\//.test(i.data));
  const felder = (Array.isArray(data.felder) ? data.felder : []).filter((f) => f && f.id).map((f) => ({ id: String(f.id), name: String(f.name || "Feld") }));
  return { vorlagen: m.vorlagen.map(fertig), bestand: m.bestand.map(fertig), icons, felder };
};

const gleicherInhalt = (a, b) => a.name === b.name && JSON.stringify(a.geraet) === JSON.stringify(b.geraet);

// Was beim Import passiert: neu, schon gleich vorhanden, oder gleiche ID mit anderem Stand (Konflikt)
export const geraeteImportVorschau = (datei, library = {}) => {
  const teil = (liste, vorhanden) => {
    const r = { neu: [], gleich: [], konflikt: [] };
    for (const e of liste) {
      const da = (vorhanden || []).find((x) => x.id === e.id);
      (!da ? r.neu : gleicherInhalt(da, e) ? r.gleich : r.konflikt).push(e);
    }
    return r;
  };
  return { vorlagen: teil(datei.vorlagen, library.vorlagen), bestand: teil(datei.bestand, library.bestand) };
};

/* Datei in die Bibliothek übernehmen. beiKonflikt: "ersetzen" (Fassung aus der Datei gewinnt)
   oder "kopie" (zusätzlich mit neuer ID). Gleiche Einträge werden übersprungen.
   Icons: gleiche Bilddaten werden wiederverwendet, eine belegte ID mit anderem Bild bekommt eine
   neue ID. Eigene Felder: gleichnamige Felder der Bibliothek werden übernommen, sonst angelegt.
   Gibt { library, zahlen: { vorlagen, bestand, ersetzt, kopien, gleich, icons, felder } } zurück. */
export const geraeteImportieren = (datei, library = {}, { beiKonflikt = "kopie" } = {}) => {
  const lib = { vorlagen: [], bestand: [], icons: [], felder: [], ...kopie(library) };
  const zahlen = { vorlagen: 0, bestand: 0, ersetzt: 0, kopien: 0, gleich: 0, icons: 0, felder: 0 };

  // Icons zusammenführen: alte ID → ID in dieser Bibliothek
  const iconMap = {};
  for (const ic of datei.icons || []) {
    const gleich = lib.icons.find((x) => x.data === ic.data);
    if (gleich) { iconMap[ic.id] = gleich.id; continue; }
    const id = lib.icons.some((x) => x.id === ic.id) ? uid() : ic.id;
    lib.icons.push({ id, name: ic.name || "Icon", data: ic.data });
    iconMap[ic.id] = id;
    zahlen.icons++;
  }

  // Felddefinitionen zusammenführen: gleiche ID oder gleicher Name → vorhandenes Feld
  const feldMap = {};
  const feldName = (s) => String(s || "").trim().toLowerCase();
  const defs = [...(datei.felder || [])];
  for (const e of [...datei.vorlagen, ...datei.bestand]) for (const f of e.geraet.felder || []) if (!defs.some((d) => d.id === f.id)) defs.push({ id: f.id, name: f.name || "Feld" });
  for (const d of defs) {
    const da = lib.felder.find((x) => x.id === d.id) || lib.felder.find((x) => feldName(x.name) === feldName(d.name));
    if (da) { feldMap[d.id] = da; continue; }
    const neu = { id: d.id, name: d.name };
    lib.felder.push(neu);
    feldMap[d.id] = neu;
    zahlen.felder++;
  }

  const anpassen = (e) => {
    const g = kopie(e.geraet);
    const ic = iconId(g);
    // Eigenes Icon fehlt in Datei und Bibliothek: Standard-Icon des Gerätetyps
    if (ic) g.icon = iconMap[ic] ? "custom:" + iconMap[ic] : lib.icons.some((x) => x.id === ic) ? g.icon : TYPEN[g.typ]?.icon || "sonstiges";
    const felder = [];
    for (const f of g.felder || []) {
      const d = feldMap[f.id];
      const id = d ? d.id : f.id;
      if (felder.some((x) => x.id === id)) continue; // zwei Felder, die hier dasselbe sind
      felder.push({ id, name: d ? d.name : f.name, wert: f.wert ?? "" });
    }
    g.felder = felder;
    return { ...e, geraet: g };
  };

  const vorschau = geraeteImportVorschau(datei, library);
  for (const art of ["vorlagen", "bestand"]) {
    const v = vorschau[art];
    zahlen.gleich += v.gleich.length;
    for (const e of v.neu) { lib[art].push(anpassen(e)); zahlen[art]++; }
    for (const e of v.konflikt) {
      if (beiKonflikt === "ersetzen") { lib[art] = lib[art].map((x) => (x.id === e.id ? anpassen(e) : x)); zahlen.ersetzt++; }
      else { lib[art].push(anpassen({ ...e, id: uid() })); zahlen.kopien++; }
      zahlen[art]++;
    }
  }
  return { library: lib, zahlen };
};

// Kurze Rückmeldung nach dem Import
export const importMeldung = (z) => {
  const teile = [];
  if (z.vorlagen) teile.push(`${z.vorlagen} Vorlage${z.vorlagen > 1 ? "n" : ""}`);
  if (z.bestand) teile.push(`${z.bestand} Gerät${z.bestand > 1 ? "e" : ""} in den Bestand`);
  let s = teile.length ? `${teile.join(" und ")} importiert` : "Nichts Neues importiert";
  const extra = [z.ersetzt && `${z.ersetzt} ersetzt`, z.kopien && `${z.kopien} als Kopie`, z.gleich && `${z.gleich} schon vorhanden`, z.icons && `${z.icons} Icon${z.icons > 1 ? "s" : ""}`, z.felder && `${z.felder} neue${z.felder > 1 ? "" : "s"} Feld${z.felder > 1 ? "er" : ""}`].filter(Boolean);
  return s + (extra.length ? ` (${extra.join(", ")})` : "") + ".";
};
