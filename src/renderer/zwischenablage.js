/* Interne Zwischenablage für Gerätekonfiguration und Stapel. Bleibt beim
   Öffnen eines anderen Projekts erhalten (localStorage), damit man
   Einstellungen auch zwischen Projekten übertragen kann. */
import { useSyncExternalStore } from "react";
import { konfigNormal } from "../shared/konfig.js";

const KEY = "np-zwischenablage";
let inhalt = (() => { try { const x = JSON.parse(localStorage.getItem(KEY) || "null") || {}; if (x.konfig) x.konfig = konfigNormal(x.konfig); return x; } catch { return {}; } })();
const hoerer = new Set();

export const ablegen = (clip) => {
  inhalt = { ...inhalt, [clip.art]: clip };
  try { localStorage.setItem(KEY, JSON.stringify(inhalt)); } catch { /* ohne Speicher nur für diese Sitzung */ }
  hoerer.forEach((f) => f());
};

const abo = (f) => { hoerer.add(f); return () => hoerer.delete(f); };
// art: "konfig" oder "stapel"
export const useZwischenablage = (art) => useSyncExternalStore(abo, () => inhalt[art] || null);
