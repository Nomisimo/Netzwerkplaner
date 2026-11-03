// Geräte als Datei teilen: Export der gewählten Vorlagen/Bestandsgeräte und Import in die Bibliothek
import { api } from "./api.js";
import { uiConfirm } from "./dialoge.jsx";
import { geraeteDatei, geraeteDateiName, geraeteDateiLesen, geraeteImportVorschau, geraeteImportieren, importMeldung } from "../shared/geraeteteilen.js";

export const geraeteExportieren = async ({ vorlagen = [], bestand = [], library, notify }) => {
  const eintraege = [...vorlagen, ...bestand];
  if (!eintraege.length) return;
  const app = await api.appVersion().catch(() => null);
  const datei = geraeteDatei({ vorlagen, bestand, library, app: app ? `Netzwerkplaner ${app}` : null });
  const r = await api.saveFile(JSON.stringify(datei, null, 2), geraeteDateiName(eintraege), [{ name: "Netzwerkplaner-Geräte", extensions: ["json"] }], "utf8");
  if (r) notify?.(eintraege.length === 1 ? `„${eintraege[0].name}“ als Datei gespeichert.` : `${eintraege.length} Geräte als Datei gespeichert.`);
};

/* Text einer Gerätedatei in die Bibliothek übernehmen. Liefert (als Promise) die Zahlen oder null
   (Fehler wurde gemeldet). Bei Einträgen, die es hier mit anderem Stand schon gibt, wird gefragt. */
export const geraeteDateiImportieren = async (text, { library, setLibrary, notify }) => {
  let datei;
  try { datei = geraeteDateiLesen(text); } catch (e) { notify(e.message, "err"); return null; }
  const v = geraeteImportVorschau(datei, library);
  const konflikte = [...v.vorlagen.konflikt, ...v.bestand.konflikt];
  let beiKonflikt = "kopie";
  if (konflikte.length) {
    const namen = konflikte.slice(0, 5).map((e) => `• ${e.name}`).join("\n") + (konflikte.length > 5 ? `\n• … und ${konflikte.length - 5} weitere` : "");
    beiKonflikt = await uiConfirm(`${konflikte.length === 1 ? "Dieses Gerät gibt" : `Diese ${konflikte.length} Geräte gibt`} es hier schon in einem anderen Stand:\n${namen}\n\nOK: durch die Fassung aus der Datei ersetzen\nAbbrechen: zusätzlich als Kopie anlegen`, "Gerät schon vorhanden") ? "ersetzen" : "kopie";
  }
  const { zahlen } = geraeteImportieren(datei, library, { beiKonflikt });
  setLibrary((l) => geraeteImportieren(datei, l, { beiKonflikt }).library);
  notify(importMeldung(zahlen), zahlen.vorlagen || zahlen.bestand ? "ok" : "warn");
  return zahlen;
};
