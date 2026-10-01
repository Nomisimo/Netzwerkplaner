/* ── Anschlüsse: Steckertyp und Geräteseite (vorne/hinten) je Port ─────────
   Datenbasis ist die Recherche aus den Herstellerhandbüchern
   (data/anschluesse.json, Schlüssel „Hersteller|Modell“ wie im Katalog).
   Ein Port kann seine Seite selbst tragen (port.seite = "vorne" | "hinten"),
   sonst wird sie aus der Recherche abgeleitet: die Netzwerkbuchsen des Modells
   werden der Reihe nach auf die Ports passenden Typs verteilt. */
import DATEN from "./data/anschluesse.json";

export const STECKER = DATEN.typen;            // id → { name, kat, rund }
export const STECKER_KATEGORIEN = DATEN.kategorien;
export const SEITEN = { vorne: "Vorderseite", hinten: "Rückseite" };

// Steckertyp eines Ports aus seinem Porttyp (RJ45, etherCON, SFP+, opticalCON …)
export const steckerTyp = (port) => {
  if (port?.stecker && STECKER[port.stecker]) return port.stecker;
  const t = port?.typ || "";
  if (/etherCON/i.test(t)) return "ethercon";
  if (/opticalCON\s*QUAD/i.test(t)) return "opticalcon_quad";
  if (/opticalCON/i.test(t)) return "opticalcon_duo";
  if (/QSFP/i.test(t)) return "qsfp";
  if (/SFP28/i.test(t)) return "sfp28";
  if (/SFP\+/i.test(t)) return "sfp_plus";
  if (/SFP/i.test(t)) return "sfp";
  if (/\bLC\b/i.test(t)) return "lc_duplex";
  if (/WLAN/i.test(t)) return null;
  return "rj45";
};

// Grobe Familie für die Zuordnung zur Recherche (SFP, SFP+, SFP28 passen ineinander)
const fam = (id) => (/^sfp|^qsfp/.test(id || "") ? "sfp" : /^opticalcon|^lc|fiber/.test(id || "") ? "glas" : id === "ethercon" ? "ethercon" : "rj45");
const NETZ = new Set(["netzwerk", "glasfaser"]);
const istNetz = (id) => NETZ.has(STECKER[id]?.kat) && !/console|proprietaer|dmx/.test(id);

export const recherche = (dev) => (dev ? DATEN.geraete[`${dev.hersteller}|${dev.modell}`] || null : null);

/* Seite je Port: Map portId → "vorne" | "hinten" | null (unbekannt) */
export const portSeiten = (dev) => {
  const out = new Map();
  const r = recherche(dev);
  const pools = r ? [["vorne", r.v || []], ["hinten", r.h || []]].map(([s, l]) => [s, l.filter(([t]) => istNetz(t)).map(([t, n]) => ({ t, rest: n }))]) : [];
  const standard = r?.ns === "vorne" || r?.ns === "hinten" ? r.ns : null;
  for (const p of dev?.ports || []) {
    if (p.virtuell) continue;
    if (p.seite === "vorne" || p.seite === "hinten") { out.set(p.id, p.seite); continue; }
    const st = steckerTyp(p);
    let seite = null;
    // erst exakt gleicher Typ, dann gleiche Familie (etherCON nimmt auch RJ45-Angaben und umgekehrt nicht)
    for (const genau of [true, false]) {
      for (const [s, pool] of pools) {
        const e = pool.find((x) => x.rest > 0 && (genau ? x.t === st : fam(x.t) === fam(st)));
        if (e) { e.rest--; seite = s; break; }
      }
      if (seite) break;
    }
    out.set(p.id, seite || standard);
  }
  return out;
};

/* Alle recherchierten Anschlüsse eines Geräts je Seite, für Tooltips:
   { vorne: [[typ, anzahl, bezeichnung]], hinten: [...], unbekannt: [...] } oder null */
export const geraeteAnschluesse = (dev) => {
  const r = recherche(dev);
  return r ? { vorne: r.v || [], hinten: r.h || [], unbekannt: r.u || [], sicherheit: r.sich, quelle: r.q } : null;
};

export const anschlussText = (l) => l.map(([t, n, b]) => `${n}× ${STECKER[t]?.name || t}${b ? ` (${b})` : ""}`).join(", ");
