/* ── Plan-Profile für Plott ─────────────────────────────────────────────────
   Ein Profil beschreibt, wie der Plan aussieht (design), was er zeigt (inhalt),
   wie Kabel gefärbt und geführt werden (kabel) und wie dicht angeordnet wird
   (anordnung). Profile lassen sich als .npprofil-Datei weitergeben.

   - Drei Vorlagen sind eingebaut und nicht änderbar: Standard (Aussehen wie bisher),
     Druck A3 hell, Patchplan.
   - Eigene Profile liegen in der Bibliothek auf dem Rechner (library.planProfile).
   - Das aktive Profil steht als Kopie im Projekt (P.planProfil); so sieht der Plan
     bei allen gleich aus, auch ohne die Profil-Datei.
   - basiertAuf: ein Profil übernimmt alles, was es nicht selbst setzt, von seiner Basis.
   - profilPruefen ignoriert unbekannte Schlüssel und falsche Typen; was fehlt oder
     nicht passt, kommt aus der Basis (zuletzt aus Standard). */
import { KATEGORIEN } from "./constants.js";

export const PROFIL_FORMAT = "netzwerkplaner-planprofil";
export const PROFIL_VERSION = 1;
export const PROFIL_ENDUNG = "npprofil";

/* Detailstufen: welche Felder der Plan zeigt. Einzelne Felder lassen sich im Profil
   (inhalt.felder) an- oder ausschalten, das geht vor der Stufe. */
export const STUFEN = [
  { nr: 1, name: "Übersicht", info: "Nur Namen, gleiche Endgeräte am selben Switch als Sammelkasten" },
  { nr: 2, name: "Netz", info: "Namen, Modelle, Kabelart und Switch-Ports" },
  { nr: 3, name: "Adressen", info: "Wie Netz, dazu IP-Adressen und Notizen" },
  { nr: 4, name: "Patch", info: "Wie Adressen, dazu Ports an beiden Enden, Kabeltyp und Länge" },
];
export const FELDER = [
  { k: "modell", name: "Hersteller und Modell" },
  { k: "ip", name: "IP-Adressen" },
  { k: "notiz", name: "Notizen im Kasten" },
  { k: "anmerkung", name: "Anmerkungen zum Standort" },
  { k: "kabeltext", name: "Beschriftung an Kabeln" },
  { k: "switchPorts", name: "Port-Namen am Switch" },
  { k: "geraetPorts", name: "Port-Namen am Endgerät" },
  { k: "kabelDetails", name: "Kabeltyp und Länge an jedem Kabel" },
  { k: "portKaesten", name: "Ports als farbige Kästchen (VLAN-Farbe)" },
];
const STUFEN_FELDER = {
  1: { modell: false, ip: false, notiz: false, anmerkung: false, kabeltext: false, switchPorts: false, geraetPorts: false, kabelDetails: false, portKaesten: false },
  2: { modell: true, ip: false, notiz: false, anmerkung: true, kabeltext: true, switchPorts: true, geraetPorts: false, kabelDetails: false, portKaesten: false },
  3: { modell: true, ip: true, notiz: true, anmerkung: true, kabeltext: true, switchPorts: true, geraetPorts: false, kabelDetails: false, portKaesten: false },
  4: { modell: true, ip: true, notiz: true, anmerkung: true, kabeltext: true, switchPorts: true, geraetPorts: true, kabelDetails: true, portKaesten: true },
};

/* Gewerke-Filter: Kategorie eines Geräts → Gewerk. Switches und Geräte ohne Gewerk
   (Netzwerk, Steuerung, Bühne, Sonstiges) bleiben immer sichtbar, damit der Weg
   zum Core erhalten bleibt. */
export const GEWERKE = { Licht: ["Licht"], Ton: ["Ton", "Intercom"], Video: ["Bild"] };
export const gewerkVon = (d) => (d?.isSwitch ? null : Object.keys(GEWERKE).find((g) => GEWERKE[g].includes(d?.kategorie)) || null);

const FARBE = /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i;

export const STANDARD_PROFIL = Object.freeze({
  format: PROFIL_FORMAT, version: PROFIL_VERSION,
  id: "standard", name: "Standard", basiertAuf: null, eingebaut: true,
  design: {
    schrift: "'Segoe UI',system-ui,sans-serif",
    papier: "#ffffff",
    rahmen: "#222",
    text: "#111",
    textNeben: "#333",
    linienBreite: 1.5,
    farben: { primary: "#e53935", secondary: "#2e9e44", glas: "#c05bd6", trunk: "#3a3f45", sonst: "#55595f" },
    switchFuellung: "#fff176",
    kategorieAufhellen: 0.5,
    kategorieFarben: {}, // eigene Grundfarbe je Kategorie, z. B. { Ton: "#3b82f6" }
    boxRand: "#3b3f45",
    raum: { fuellung: "#f6f7f8", rand: "#8a8f96", kopf: "#dfeefb", kopfLinie: "#b9cfe3", strich: "6 4" },
    stack: { fuellung: "#ffffff", rand: "#6f7680", kopf: "#eceef1", kopfLinie: "#c3c8ce" },
  },
  inhalt: { stufe: 3, felder: {}, gewerke: [], fremde: "blass" },
  kabel: { farbe: "dante", spur: 7 },
  anordnung: { maxSpalten: 6, kastenAbstand: 30, reihenAbstand: 26, gruppeAbstand: 46, raumAbstand: 70 },
});

const tief = (x) => JSON.parse(JSON.stringify(x));
const ableiten = (basis, teil) => {
  const out = tief(basis);
  const misch = (z, q) => { for (const [k, v] of Object.entries(q)) { if (v && typeof v === "object" && !Array.isArray(v) && z[k] && typeof z[k] === "object") misch(z[k], v); else z[k] = tief(v); } };
  misch(out, teil);
  return out;
};

export const EINGEBAUTE_PROFILE = [
  STANDARD_PROFIL,
  Object.freeze(ableiten(STANDARD_PROFIL, {
    id: "druck-a3-hell", name: "Druck A3 hell", basiertAuf: "standard",
    design: {
      rahmen: "#333333", textNeben: "#3a3a3a", linienBreite: 1.3, switchFuellung: "#fff9c4", kategorieAufhellen: 0.78, boxRand: "#6b7078",
      raum: { fuellung: "#ffffff", rand: "#a5aab0", kopf: "#f1f4f7", kopfLinie: "#d5dbe1" },
      stack: { kopf: "#f5f6f8", kopfLinie: "#d9dde2" },
    },
  })),
  Object.freeze(ableiten(STANDARD_PROFIL, {
    id: "patchplan", name: "Patchplan", basiertAuf: "standard",
    design: { linienBreite: 1.3, kategorieAufhellen: 0.72, switchFuellung: "#fff59d" },
    inhalt: { stufe: 4 },
    kabel: { spur: 9 },
  })),
];
export const eingebautesProfil = (id) => EINGEBAUTE_PROFILE.find((p) => p.id === id) || null;

/* Werte aus roh übernehmen, soweit Schlüssel und Typ zur Vorlage passen. */
const uebernehmen = (vorlage, roh, pfad, warn) => {
  const out = tief(vorlage);
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return out;
  for (const [k, v] of Object.entries(roh)) {
    const p = pfad ? `${pfad}.${k}` : k;
    if (!(k in vorlage)) { warn.push(`Unbekannte Angabe „${p}“ ignoriert`); continue; }
    const soll = vorlage[k];
    if (soll && typeof soll === "object" && !Array.isArray(soll)) {
      if (p === "design.kategorieFarben") { // nur bekannte Kategorien mit gültiger Farbe
        for (const [kat, farbe] of Object.entries(v && typeof v === "object" ? v : {})) {
          if (KATEGORIEN[kat] && typeof farbe === "string" && FARBE.test(farbe)) out.kategorieFarben[kat] = farbe;
          else warn.push(`Kategorie-Farbe „${kat}“ ignoriert`);
        }
        continue;
      }
      if (p === "inhalt.felder") { // nur bekannte Felder mit wahr/falsch
        for (const [f, an] of Object.entries(v || {})) {
          if (FELDER.some((x) => x.k === f) && typeof an === "boolean") out.felder[f] = an;
          else warn.push(`Feld „${f}“ ignoriert`);
        }
        continue;
      }
      out[k] = uebernehmen(soll, v, p, warn);
    } else if (Array.isArray(soll)) {
      if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string");
      else warn.push(`„${p}“ ist keine Liste`);
    } else if (typeof soll === typeof v || (soll === null && typeof v === "string")) {
      if (typeof v === "string" && FARBE.test(String(soll)) && !FARBE.test(v)) { warn.push(`„${p}“ ist keine Farbe`); continue; }
      if (typeof v === "number" && !Number.isFinite(v)) { warn.push(`„${p}“ ist keine Zahl`); continue; }
      out[k] = v;
    } else warn.push(`„${p}“ hat den falschen Typ`);
  }
  return out;
};

/* Profil prüfen und vervollständigen. eigene: Liste weiterer Profile für basiertAuf.
   → { profil, warnungen } */
export const profilPruefen = (roh, eigene = []) => {
  const warnungen = [];
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return { profil: tief(STANDARD_PROFIL), warnungen: ["Kein Profil gefunden, Standard verwendet"] };
  if (roh.format && roh.format !== PROFIL_FORMAT) warnungen.push("Unbekanntes Dateiformat, so gut wie möglich gelesen");
  if (+roh.version > PROFIL_VERSION) warnungen.push("Profil stammt aus einer neueren Version, neue Angaben werden ignoriert");
  // Basis auflösen (mit Schutz gegen Kreise)
  const kette = [];
  let b = roh.basiertAuf, n = 0;
  while (typeof b === "string" && n++ < 8) {
    const x = eingebautesProfil(b) || eigene.find((p) => p?.id === b);
    if (!x) { warnungen.push(`Basis „${b}“ nicht gefunden, Standard verwendet`); break; }
    kette.unshift(x);
    if (x.eingebaut) break;
    b = x.basiertAuf;
  }
  let basis = tief(STANDARD_PROFIL);
  for (const x of kette) basis = uebernehmen(basis, x, "", []);
  const profil = uebernehmen(basis, roh, "", warnungen);
  // Grenzen
  const i = profil.inhalt;
  if (![1, 2, 3, 4].includes(i.stufe)) { warnungen.push("Detailstufe ungültig, Stufe 3 verwendet"); i.stufe = 3; }
  i.gewerke = [...new Set(i.gewerke.filter((g) => GEWERKE[g]))];
  if (!["blass", "aus"].includes(i.fremde)) i.fremde = "blass";
  if (!["dante", "vlan"].includes(profil.kabel.farbe)) profil.kabel.farbe = "dante";
  profil.kabel.spur = Math.max(4, Math.min(16, profil.kabel.spur));
  const a = profil.anordnung, grenze = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
  a.maxSpalten = grenze(a.maxSpalten, 1, 12);
  a.kastenAbstand = grenze(a.kastenAbstand, 10, 120);
  a.reihenAbstand = grenze(a.reihenAbstand, 10, 120);
  a.gruppeAbstand = grenze(a.gruppeAbstand, 10, 200);
  a.raumAbstand = grenze(a.raumAbstand, 20, 300);
  profil.design.linienBreite = Math.max(0.5, Math.min(4, profil.design.linienBreite));
  profil.design.kategorieAufhellen = Math.max(0, Math.min(0.95, profil.design.kategorieAufhellen));
  profil.format = PROFIL_FORMAT; profil.version = PROFIL_VERSION;
  profil.eingebaut = !!eingebautesProfil(profil.id) && JSON.stringify(profilVergleich(profil)) === JSON.stringify(profilVergleich(eingebautesProfil(profil.id)));
  if (typeof profil.name !== "string" || !profil.name.trim()) profil.name = "Eigenes Profil";
  return { profil, warnungen };
};
// Inhalt ohne Name und Kennung, um „geändert“ zu erkennen
export const profilVergleich = (p) => { const { design, inhalt, kabel, anordnung } = p || {}; return { design, inhalt, kabel, anordnung }; };

/* Aktives Profil eines Projekts. Ohne P.planProfil gilt Standard; vorgaben (Farbe,
   IP aus den Einstellungen dieses Rechners, wie bisher) füllen es dann. */
export const projektProfil = (P, vorgaben = {}) => {
  if (P?.planProfil) return profilPruefen(P.planProfil).profil;
  const p = tief(STANDARD_PROFIL);
  if (vorgaben.farbe === "vlan") p.kabel.farbe = "vlan";
  if (vorgaben.zeigeIp === false) p.inhalt.felder.ip = false;
  return p;
};

// Felder, die der Plan zeigt: Stufe plus einzelne Schalter
export const profilFelder = (profil) => {
  const i = profil?.inhalt || STANDARD_PROFIL.inhalt;
  return { ...(STUFEN_FELDER[i.stufe] || STUFEN_FELDER[3]), ...(i.felder || {}), sammeln: i.stufe === 1 };
};

// Kästen-Füllung je Kategorie, aufgehellt wie im Profil
const mische = (hex, anteil) => {
  const n = parseInt(hex.slice(1), 16);
  const k = (v) => Math.round(v + (255 - v) * anteil);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => k(v).toString(16).padStart(2, "0")).join("");
};
export const katGrundfarbe = (design, kat) => design.kategorieFarben?.[kat] || (KATEGORIEN[kat] || KATEGORIEN.Sonstiges).color;
export const katFuellung = (design, kat) => mische(katGrundfarbe(design, kat), design.kategorieAufhellen);

/* Datei zum Weitergeben: ohne „eingebaut“, mit Format und Version */
export const profilDatei = (profil) => {
  const { eingebaut, ...rest } = profil; // eslint-disable-line no-unused-vars
  return JSON.stringify({ ...rest, format: PROFIL_FORMAT, version: PROFIL_VERSION }, null, 2);
};
export const profilLesen = (text, eigene = []) => {
  let roh;
  try { roh = JSON.parse(text); } catch { return { fehler: "Die Datei ist kein gültiges Profil (kein JSON)." }; }
  if (!roh || typeof roh !== "object" || (!roh.design && !roh.inhalt && !roh.kabel && !roh.anordnung)) return { fehler: "In der Datei steht kein Plan-Profil." };
  return profilPruefen(roh, eigene);
};
