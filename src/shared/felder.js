/* ── Eigene Felder ────────────────────────────────────────────────────────
   Frei definierbare Felder je Gerät (z. B. Inventar-Nr., Seriennummer, Case).
   Die Definitionen liegen im Katalog der App (library.felder: [{ id, name }]),
   jedes Gerät trägt seine Werte samt Namen (geraet.felder: [{ id, name, wert }]),
   damit Projektdateien und Bestands-CSV auch ohne den Katalog lesbar bleiben. */
import { uid } from "./catalog.js";

// Frühere feste Inventarfelder → gleichnamige eigene Felder
export const ALTE_INVENTARFELDER = [
  { id: "inventar-nr", name: "Inventar-Nr.", key: "nr" },
  { id: "seriennummer", name: "Seriennummer", key: "sn" },
  { id: "case", name: "Case", key: "case" },
];

export const newFeld = (name = "") => ({ id: uid(), name: String(name).trim() });

// Gerät (Projekt, Bestand, Vorlage) auf eigene Felder umstellen; alte Inventardaten gehen dabei nicht verloren
export const migrateFelder = (d) => {
  if (!d) return d;
  const felder = (d.felder || []).filter((f) => f && f.id).map((f) => ({ id: f.id, name: f.name || "", wert: f.wert ?? "" }));
  for (const a of ALTE_INVENTARFELDER) {
    const w = d.inventar?.[a.key];
    if (w && !felder.some((f) => f.id === a.id)) felder.push({ id: a.id, name: a.name, wert: String(w) });
  }
  const { inventar, ...rest } = d;
  return { ...rest, felder };
};

export const migrateLibrary = (l) => {
  const out = { vorlagen: [], bestand: [], icons: [], felder: [], ...(l || {}) };
  out.vorlagen = out.vorlagen.map((v) => ({ ...v, geraet: migrateFelder(v.geraet) }));
  out.bestand = out.bestand.map((b) => ({ ...b, geraet: migrateFelder(b.geraet) }));
  out.felder = ergaenzeFeldDefs(out.felder, [...out.vorlagen, ...out.bestand].map((x) => x.geraet));
  return out;
};

// Felddefinitionen, die in Geräten vorkommen, aber noch nicht im Katalog stehen
export const fehlendeFeldDefs = (defs = [], geraete = []) => {
  const ids = new Set(defs.map((f) => f.id));
  const out = [];
  for (const g of geraete) for (const f of g?.felder || []) {
    if (ids.has(f.id)) continue;
    ids.add(f.id);
    out.push({ id: f.id, name: f.name || "Feld" });
  }
  return out;
};
export const ergaenzeFeldDefs = (defs = [], geraete = []) => [...defs, ...fehlendeFeldDefs(defs, geraete)];

export const feldWert = (d, id) => (d?.felder || []).find((f) => f.id === id)?.wert || "";

// Ausgefüllte Felder als „Name: Wert“
export const feldZeilen = (d) => (d?.felder || []).filter((f) => f.wert).map((f) => `${f.name}: ${f.wert}`);

// Umbenennen bzw. Entfernen einer Definition in einer Geräteliste
export const feldUmbenennen = (geraete, id, name) => { for (const g of geraete) for (const f of g?.felder || []) if (f.id === id) f.name = name; };
export const feldEntfernen = (geraete, id) => { for (const g of geraete) if (g?.felder) g.felder = g.felder.filter((f) => f.id !== id); };

// Spaltennamen für Tabellenexporte: alle in den Geräten benutzten Felder in Katalogreihenfolge
export const feldSpalten = (geraete, defs = []) => {
  const seen = new Map();
  for (const f of defs) seen.set(f.id, f.name);
  const benutzt = new Set(geraete.flatMap((g) => (g.felder || []).map((f) => f.id)));
  for (const g of geraete) for (const f of g.felder || []) if (!seen.has(f.id)) seen.set(f.id, f.name);
  return [...seen].filter(([id]) => benutzt.has(id)).map(([id, name]) => ({ id, name }));
};
