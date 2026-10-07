import React, { useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, OK, WARN, INPUT, MID, STRONG } from "../../shared/constants.js";
import { findPlanned, fmtAge } from "../../shared/live.js";
import { Dot, Toggle, th, td } from "../ui.jsx";
import { Square, Play, OctagonX, TriangleAlert, X as XIcon, Clock, Eraser } from "lucide-react";
import { useAlteAusblenden } from "./store.js";

export { th, td };

// Kopfzeile eines Monitors: Start/Stopp, Laufanzeige, Fehler, eigene Bedienelemente
export function MonBar({ mon, label = "Mitlesen", onStart, children, stopLabel = "Stoppen" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...S.row, marginBottom: 0 }}>
        {mon.running
          ? <button style={S.secondaryBtn} onClick={mon.stop}><Square size={12} fill="currentColor" /> {stopLabel}</button>
          : <button style={S.primaryBtn} disabled={mon.busy} onClick={onStart}><Play size={12} fill="currentColor" /> {label}</button>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: mon.running ? OK : MUTED }}>
          <Dot color={mon.running ? OK : MID} /> {mon.running ? "läuft" : mon.stopped ? `gestoppt um ${new Date(mon.stopped).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}, letzter Stand` : "gestoppt"}
        </span>
        {!mon.running && mon.snapshot && <button style={S.smallBtn} onClick={mon.verwerfen} title="Die stehen gebliebenen Einträge des letzten Laufs entfernen"><XIcon size={12} /> Einträge verwerfen</button>}
        {children}
        {mon.snapshot && <AlteSchalter mon={mon} />}
      </div>
      {mon.error && <div style={{ color: ERR, fontSize: 12, marginTop: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><OctagonX size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {mon.error}</div>}
      {mon.snapshot?.err && <div style={{ color: WARN, fontSize: 12, marginTop: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {mon.snapshot.err}</div>}
      {(mon.snapshot?.errors || []).map((e, i) => <div key={i} style={{ color: WARN, fontSize: 12, marginTop: 6, display: "flex", alignItems: "flex-start", gap: 5 }}><TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {e}</div>)}
    </div>
  );
}

export const Empty = ({ children }) => <div style={S.empty}>{children}</div>;

// Gerätename aus dem Plan zu einer IP, anklickbar
export function PlanName({ P, ip, mac, onSelectDevice, fallback = "" }) {
  const hit = useMemo(() => findPlanned(P, { ip, mac }), [P, ip, mac]);
  if (!hit) return <span style={{ color: MUTED }}>{fallback || "nicht im Plan"}</span>;
  return <a href="#" onClick={(e) => { e.preventDefault(); onSelectDevice?.(hit.dev.id); }} style={{ color: STRONG, textDecoration: "underline dotted" }}>{hit.dev.name}</a>;
}

// Zeitpunkt, zu dem ein Eintrag zuletzt gesehen wurde. z = Zustand aus dem Monitor (aktiv, alt, beendet).
export const Age = ({ ms, z }) => {
  if (z === "beendet") return <span style={{ color: MUTED, fontSize: 12 }} title="Hat sich abgemeldet">beendet, {fmtAge(ms)}</span>;
  if (z === "alt") return <span style={{ color: MUTED, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3 }} title="Seit einer Weile nicht mehr gesehen"><Clock size={11} /> alt, {fmtAge(ms)}</span>;
  return <span style={{ color: !z && ms > 5000 ? WARN : SUB, fontSize: 12 }}>{fmtAge(ms)}</span>;
};

// Zeilenstil je Zustand: alte Einträge grau, beendete zusätzlich durchgestrichen
export const zeile = (z, style = {}) => (z === "alt" ? { ...style, opacity: 0.5 } : z === "beendet" ? { ...style, opacity: 0.45, textDecoration: "line-through" } : style);

// Gibt es im Schnappschuss Einträge, die nicht mehr aktiv sind? (Listen bis zwei Ebenen tief, z. B. Universen → Quellen)
const zaehleAlte = (v, tiefe = 0) => {
  if (tiefe > 3 || !v || typeof v !== "object") return 0;
  if (Array.isArray(v)) return v.reduce((n, x) => n + (x?.zustand && x.zustand !== "aktiv" ? 1 : 0) + zaehleAlte(x, tiefe + 1), 0);
  return Object.values(v).reduce((n, x) => n + (typeof x === "object" ? zaehleAlte(x, tiefe + 1) : 0), 0);
};

// „Alte ausblenden“ (gilt für alle Monitore) und „Alte entfernen“ (nur dieser Monitor, solange er läuft)
function AlteSchalter({ mon }) {
  const [aus, setAus] = useAlteAusblenden();
  const n = useMemo(() => zaehleAlte(mon.snapshot), [mon.snapshot]);
  if (!n && !aus) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
      <Toggle checked={aus} onChange={setAus} label={`Alte ausblenden${n ? ` (${n})` : ""}`} />
      {mon.running && n > 0 && <button style={S.smallBtn} onClick={() => mon.action("alteEntfernen")} title="Alte und beendete Einträge aus der Liste nehmen"><Eraser size={12} /> Alte entfernen</button>}
    </span>
  );
}

// 512 DMX-Kanäle als Raster (32 Spalten), Wert als Zahl und Helligkeit
export function Levels({ levels, mode = "dez" }) {
  if (!levels) return null;
  const fmt = (v) => (mode === "pct" ? Math.round((v / 255) * 100) : mode === "hex" ? v.toString(16).toUpperCase().padStart(2, "0") : v);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(32, minmax(0, 1fr))", gap: 1, fontFamily: "Consolas,monospace", fontSize: 10, marginTop: 10 }}>
      {levels.map((v, i) => (
        <div key={i} title={`Kanal ${i + 1}: ${v} (${Math.round((v / 255) * 100)} %)`}
          style={{ background: v ? `rgba(179,72,63,${0.18 + (v / 255) * 0.82})` : INPUT, color: v > 140 ? "#fff" : v ? "#f0d0cc" : MID, textAlign: "center", padding: "3px 0", borderRadius: 2 }}>
          {fmt(v)}
        </div>
      ))}
    </div>
  );
}

export function LevelModeSwitch({ mode, setMode }) {
  return (
    <div style={{ display: "inline-flex", gap: 3 }}>
      {[["dez", "0–255"], ["pct", "%"], ["hex", "Hex"]].map(([k, l]) => (
        <button key={k} style={{ ...S.smallBtn, ...(mode === k ? { background: ACCENT, borderColor: ACCENT } : {}) }} onClick={() => setMode(k)}>{l}</button>
      ))}
    </div>
  );
}

export const Hint = ({ children }) => <p style={{ ...S.hint, marginTop: 14 }}>{children}</p>;

export const Pill = ({ children, color = SUB }) => (
  <span style={{ ...S.badge, background: color + "22", color, border: `1px solid ${color}55`, marginRight: 4 }}>{children}</span>
);

export const Table = ({ head, children }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ ...S.table, marginTop: 4 }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={th()}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const Card = ({ title, right, children }) => (
  <div style={{ ...S.card, padding: 14, marginBottom: 14 }}>
    {(title || right) && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><div style={{ ...S.h3, margin: 0, flex: 1 }}>{title}</div>{right}</div>}
    {children}
  </div>
);

export const mono = { fontFamily: "Consolas,monospace", fontSize: 12 };
export const LINE_C = LINE;
