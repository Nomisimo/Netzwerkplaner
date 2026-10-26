import React, { useEffect, useReducer, useRef } from "react";
import { S, STRONG, TEXT2 } from "../shared/constants.js";

/* Ersatz für window.alert/confirm. Die nativen Dialoge geben unter Electron (v. a. Windows) den
   Tastatur-Fokus nicht sauber an die Seite zurück, danach nehmen Textfelder keine Eingaben mehr an,
   bis die App neu startet (electron/electron#35872, #41602). Deshalb laufen alle Rückfragen als
   In-App-Dialog:
     await uiAlert("…")             → Promise<void>
     if (!await uiConfirm("…")) return;   → Promise<boolean>
   <DialogHost /> hängt einmal in der App. Mehrere Aufrufe kurz hintereinander landen in einer Warteschlange.
   Nie innerhalb einer setState-Updater-Funktion aufrufen: Prüfungen vorher am aktuellen State machen. */
const schlange = [];
let melden = null;
const einreihen = (d) => new Promise((resolve) => { schlange.push({ ...d, resolve }); melden?.(); });

export const uiAlert = (text, titel = "Hinweis") => einreihen({ art: "alert", text: String(text ?? ""), titel }).then(() => undefined);
export const uiConfirm = (text, titel = "Bitte bestätigen") => einreihen({ art: "confirm", text: String(text ?? ""), titel });

export function DialogHost() {
  const [, neuZeichnen] = useReducer((n) => n + 1, 0);
  const boxRef = useRef(null);
  const okRef = useRef(null);
  const vorher = useRef(null); // Element, das vor dem ersten Dialog den Fokus hatte
  const taste = useRef(false); // Enter/Leertaste wurde gedrückt, während der Dialog offen ist
  useEffect(() => { melden = neuZeichnen; if (schlange.length) neuZeichnen(); return () => { melden = null; }; }, []);

  const d = schlange[0];
  const schliessen = (antwort) => {
    const cur = schlange.shift();
    if (!cur) return;
    cur.resolve(cur.art === "confirm" ? antwort : undefined);
    if (!schlange.length) {
      const el = vorher.current;
      vorher.current = null;
      // Nach dem Rendern zurück aufs vorherige Feld, falls es noch existiert
      setTimeout(() => { if (el && el.isConnected && typeof el.focus === "function") el.focus(); }, 0);
    }
    neuZeichnen();
  };

  useEffect(() => {
    if (!d) return;
    if (!vorher.current) vorher.current = document.activeElement;
    taste.current = false;
    okRef.current?.focus();
    // Tasten fängt der Dialog ab (Capture-Phase), damit Kürzel der App dahinter nicht auslösen.
    // Standardaktionen (Enter/Leertaste auf dem fokussierten Knopf) bleiben erhalten.
    const tasten = (e) => {
      if (e.key === "Enter" || e.key === " ") taste.current = true;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); schliessen(false); return; }
      if (e.key === "Tab") {
        const knoepfe = [...(boxRef.current?.querySelectorAll("button") || [])];
        if (knoepfe.length) {
          e.preventDefault();
          const i = knoepfe.indexOf(document.activeElement);
          knoepfe[(i + (e.shiftKey ? -1 : 1) + knoepfe.length) % knoepfe.length].focus();
        }
      }
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", tasten, true);
    return () => window.removeEventListener("keydown", tasten, true);
  }, [d]);

  if (!d) return null;
  // Öffnet ein Enter in einem Eingabefeld den Dialog, landet derselbe Tastendruck sonst gleich als
  // Klick auf dem frisch fokussierten OK-Knopf. Tastatur-Klicks (detail 0) zählen erst nach einem
  // Tastendruck im offenen Dialog.
  const klick = (antwort) => (e) => { if (e.detail === 0 && !taste.current) return; schliessen(antwort); };
  return (
    <div style={{ ...S.modalOverlay, zIndex: 3000 }} data-dialog-host=""
      onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); okRef.current?.focus(); } }}>
      <div ref={boxRef} role={d.art === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="np-dialog-titel"
        style={{ ...S.modalBox, width: 440, maxWidth: "94vw" }}>
        <div id="np-dialog-titel" style={{ fontSize: 16, fontWeight: 700, color: STRONG, marginBottom: 12 }}>{d.titel}</div>
        <div style={{ fontSize: 13, color: TEXT2, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{d.text}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          {d.art === "confirm" && <button style={S.ghostBtn} onClick={klick(false)}>Abbrechen</button>}
          <button ref={okRef} style={S.primaryBtn} onClick={klick(true)}>OK</button>
        </div>
      </div>
    </div>
  );
}
