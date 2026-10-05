import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, STRONG, THEME_KEY, themeWahl, systemHell, HELL } from "../shared/constants.js";
import { Modal } from "./ui.jsx";
import { Monitor, Sun, Moon } from "lucide-react";

/* Einstellungen der App (gelten für diesen Rechner, nicht fürs Projekt).
   Erscheinungsbild: System (Standard), Hell oder Dunkel. Ein Wechsel lädt die
   Oberfläche neu; das Projekt ist vorher automatisch gespeichert. */
const ARTEN = [["system", "Wie das System", Monitor], ["hell", "Hell", Sun], ["dunkel", "Dunkel", Moon]];

export const themeSetzen = (w, vorReload) => {
  try { localStorage.setItem(THEME_KEY, w); } catch { /* ohne Speicher */ }
  const hell = w === "hell" || (w === "system" && systemHell());
  if (hell === HELL) return false; // sieht schon so aus
  vorReload?.();
  location.reload();
  return true;
};

export default function Einstellungen({ onClose, vorReload, inSitzung }) {
  const [wahl, setWahl] = useState(themeWahl);
  return (
    <Modal title="Einstellungen" width={520} onClose={onClose} footer={<button style={S.primaryBtn} onClick={onClose}>Fertig</button>}>
      <div className="sp-section-label">Erscheinungsbild</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {ARTEN.map(([k, l, Ic]) => {
          const an = wahl === k;
          return (
            <button key={k} onClick={() => { setWahl(k); if (inSitzung && !confirm("Zum Umschalten lädt die Oberfläche neu, und du verlässt dabei die laufende Sitzung. Trotzdem umschalten?")) { try { localStorage.setItem(THEME_KEY, k); } catch { /* */ } return; } themeSetzen(k, vorReload); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: an ? 700 : 500,
                border: `2px solid ${an ? ACCENT : LINE}`, background: an ? ACCENT + "1f" : "transparent", color: an ? STRONG : SUB }}>
              <Ic size={22} />{l}
            </button>
          );
        })}
      </div>
      <div style={{ ...S.hint, marginTop: 10 }}>
        „Wie das System“ übernimmt Hell oder Dunkel vom Betriebssystem beim Start der App{wahl === "system" ? ` (gerade ${systemHell() ? "hell" : "dunkel"})` : ""}.
        Beim Umschalten lädt die Oberfläche kurz neu; das Projekt bleibt erhalten.
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Gilt nur auf diesem Rechner.</div>
    </Modal>
  );
}
