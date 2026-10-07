import { useEffect, useState } from "react";

/* Einstellungen dieses Rechners (nicht im Projekt gespeichert):
   - lasche: Port-Lasche an Geräten in „Anschlüsse“ – "standard" zeigt nur den
     Port, über den das Gerät hängt, "erweitert" alle belegten eigenen Ports
   - fokusHersteller: Hersteller für den Filter „nur Fokus“ im Katalog
     (null = die recherchierten Fokus-Hersteller aus dem Katalog)
   - topo: Standard-Anzeige der Topologie. Gilt, solange das Projekt selbst
     nichts anderes eingestellt hat. */
const KEY = "netzwerkplaner_einstellungen";
const EVENT = "np-einstellungen";
export const TOPO_STANDARD = { ansicht: "mindmap", linien: "rund", kabelBuendel: false, titel: "name", einrasten: true, autoAnordnen: true, farbe: "vlan", portVlan: true };
export const STANDARD = { lasche: "standard", fokusHersteller: null, topo: TOPO_STANDARD };

let cache = null;
export const einstellungen = () => {
  if (cache) return cache;
  let roh = {};
  try { roh = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { roh = {}; }
  cache = { ...STANDARD, ...roh, topo: { ...TOPO_STANDARD, ...(roh.topo || {}) } };
  return cache;
};
export const setzeEinstellungen = (fn) => {
  const neu = structuredClone(einstellungen());
  fn(neu);
  cache = neu;
  try { localStorage.setItem(KEY, JSON.stringify(neu)); } catch { /* ohne Speicher */ }
  window.dispatchEvent(new Event(EVENT));
};
export const useEinstellungen = () => {
  const [e, setE] = useState(einstellungen);
  useEffect(() => {
    const f = () => setE(einstellungen());
    window.addEventListener(EVENT, f);
    return () => window.removeEventListener(EVENT, f);
  }, []);
  return e;
};

// Topologie-Anzeige: Projektwert, sonst Standard aus den Einstellungen
export const ansichtVon = (P) => P?.layout?.ansicht || einstellungen().topo.ansicht || "mindmap";
export const topoWert = (P, k) => (P?.layout?.[k] ?? einstellungen().topo[k]);

// Fokus-Filter im Katalog
export const istFokus = (g, e = einstellungen()) => (Array.isArray(e.fokusHersteller) ? e.fokusHersteller.includes(g.hersteller) : !!g.fokus);
