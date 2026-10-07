import React, { useState } from "react";
import { S, LINE, SUB, MUTED, OK, STRONG } from "../../shared/constants.js";
import { SevBadge, SEV } from "../ui.jsx";
import { Check } from "lucide-react";

/* Prüfung im Setup: nur Fehler und Warnungen, kompakt im Übersichts-Block.
   Hinweise (info) zeigt die Liste nicht mehr; sie stehen weiter am Gerät bzw. VLAN. */
export default function PruefungKompakt({ issues, onShowIssue }) {
  const relevant = issues.filter((i) => i.sev === "error" || i.sev === "warn");
  const [filter, setFilter] = useState({ error: true, warn: true });
  const shown = relevant.filter((i) => filter[i.sev]);
  const count = (s) => relevant.filter((i) => i.sev === s).length;
  return (
    <div id="setup-pruefung" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <span className="sp-section-label" style={{ margin: 0 }}>Prüfung</span>
        {["error", "warn"].map((s) => (
          <button key={s} onClick={() => setFilter((f) => ({ ...f, [s]: !f[s] }))}
            style={{ ...S.boxTab, padding: "2px 8px", fontSize: 11, ...(filter[s] ? { borderColor: SEV[s].color, color: STRONG, background: SEV[s].color + "22" } : {}) }}>
            {SEV[s].icon} {SEV[s].label}: <b>{count(s)}</b>
          </button>
        ))}
      </div>
      {relevant.length === 0
        ? <div style={{ padding: "6px 10px", border: `1px solid ${OK}55`, background: OK + "14", borderRadius: 6, color: OK, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Keine Fehler oder Warnungen.</div>
        : (
          <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 6 }}>
            {shown.map((i, n) => (
              <div key={n} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 8px", borderBottom: `1px solid ${LINE}`, fontSize: 12 }}>
                <SevBadge sev={i.sev} />
                <div style={{ flex: 1, lineHeight: 1.4 }}>{i.msg}</div>
                {(i.dev || i.conn || i.vlan) && <button style={{ ...S.smallBtn, padding: "1px 6px", fontSize: 11 }} onClick={() => onShowIssue(i)}>Zeigen →</button>}
              </div>
            ))}
            {!shown.length && <div style={{ padding: 8, fontSize: 12, color: MUTED }}>Alles ausgefiltert.</div>}
          </div>
        )}
    </div>
  );
}
