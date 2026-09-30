/* Interne Zwischenablage für Gerätekonfiguration und Stapel. Bleibt beim
   Öffnen eines anderen Projekts erhalten (localStorage), damit man
   Einstellungen auch zwischen Projekten übertragen kann. */
import { useSyncExternalStore } from "react";

const KEY = "np-zwischenablage";
let inhalt = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch { return {}; } })();
const hoerer = new Set();

export const ablegen = (clip) => {
  inhalt = { ...inhalt, [clip.art]: clip };
  try { localStorage.setItem(KEY, JSON.stringify(inhalt)); } catch { /* ohne Speicher nur für diese Sitzung */ }
  hoerer.forEach((f) => f());
};

const abo = (f) => { hoerer.add(f); return () => hoerer.delete(f); };
// art: "konfig" oder "stapel"
export const useZwischenablage = (art) => useSyncExternalStore(abo, () => inhalt[art] || null);
