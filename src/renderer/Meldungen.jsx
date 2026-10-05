import React, { useState, useEffect, useRef } from "react";
import { S, LINE, MUTED, PANEL, LINE2, TEXT2 } from "../shared/constants.js";
import { SEV } from "./ui.jsx";
import { ArrowRight } from "lucide-react";

/* Meldungszentrum links in der Werkzeugleiste: Fehler, Warnungen und Hinweise der Prüfung
   als Zähler. Klick auf einen Zähler zeigt die Meldungen dieser Art, „Zeigen“ springt zum
   Gerät oder zur Verbindung, „Alle in Prüfung“ öffnet den Prüfungs-Tab. */
export default function Meldungen({ issues, onShowIssue, goPruefung, breite = 176 }) {
  const [offen, setOffen] = useState(null); // "error" | "warn" | "info"
  const ref = useRef(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e) => { if (!ref.current?.contains(e.target)) setOffen(null); };
    const esc = (e) => { if (e.key === "Escape") setOffen(null); };
    window.addEventListener("mousedown", zu);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", zu); window.removeEventListener("keydown", esc); };
  }, [offen]);
  const n = (s) => issues.filter((i) => i.sev === s).length;
  const liste = offen ? issues.filter((i) => i.sev === offen) : [];

  return (
    <div ref={ref} style={{ position: "relative", width: breite, flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, paddingRight: 10, marginRight: 4, borderRight: `1px solid ${LINE}` }}>
      <button onClick={goPruefung} title="Prüfung öffnen" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: 0, cursor: "pointer", color: MUTED }}>
        <span className="sp-section-label" style={{ margin: 0 }}>Meldungen</span><ArrowRight size={12} />
      </button>
      <div style={{ display: "flex", gap: 4 }}>
        {["error", "warn", "info"].map((s) => {
          const z = n(s), aktiv = offen === s;
          return (
            <button key={s} onClick={() => setOffen(aktiv ? null : s)} title={`${z} ${SEV[s].label}${z === 1 ? "" : s === "info" ? "e" : s === "warn" ? "en" : ""}`}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: `1px solid ${z ? SEV[s].color + "77" : LINE}`, background: aktiv ? SEV[s].color + "33" : z ? SEV[s].color + "18" : "transparent", color: z ? SEV[s].color : MUTED }}>
              {SEV[s].icon}{z}
            </button>
          );
        })}
      </div>
      {offen && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, width: 420, maxHeight: 380, display: "flex", flexDirection: "column", background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: "0 8px 24px #0008", zIndex: 50 }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 6, color: SEV[offen].color, fontSize: 12, fontWeight: 700 }}>
            {SEV[offen].icon}{liste.length} {offen === "error" ? "Fehler" : offen === "warn" ? "Warnungen" : "Hinweise"}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {!liste.length && <div style={{ ...S.empty, padding: 12 }}>Keine.</div>}
            {liste.map((i, k) => (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 10px", borderBottom: `1px solid ${LINE2}`, fontSize: 12, color: TEXT2 }}>
                <span style={{ flex: 1 }}>{i.msg}</span>
                {(i.dev || i.conn || i.vlan) && <button style={{ ...S.smallBtn, flexShrink: 0 }} onClick={() => { setOffen(null); onShowIssue(i); }}>Zeigen</button>}
              </div>
            ))}
          </div>
          <button onClick={() => { setOffen(null); goPruefung(); }} style={{ ...S.ghostBtn, border: "none", borderTop: `1px solid ${LINE}`, borderRadius: 0, justifyContent: "center" }}>Alle in Prüfung <ArrowRight size={13} /></button>
        </div>
      )}
    </div>
  );
}
