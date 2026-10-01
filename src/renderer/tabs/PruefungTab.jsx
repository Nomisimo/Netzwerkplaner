import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, INFO, OK } from "../../shared/constants.js";
import { KATALOG, findProtokoll, ipPorts } from "../../shared/catalog.js";
import { Section, SevBadge, SEV, VlanChip } from "../ui.jsx";
import { GOLD_STANDARDS, maNetGen } from "../../shared/manet.js";
import { Check } from "lucide-react";

export default function PruefungTab({ P, X, issues, onShowIssue }) {
  const [filter, setFilter] = useState({ error: true, warn: true, info: true });
  const shown = issues.filter((i) => filter[i.sev]);
  const count = (s) => issues.filter((i) => i.sev === s).length;

  // Protokolle im Projekt → passende QoS-Empfehlungen
  const used = new Map();
  for (const d of P.geraete) for (const s of d.protokolle || []) { const r = findProtokoll(s); if (r) used.set(r.name, r); }
  const qos = KATALOG.qos.filter((q) => [...used.keys()].some((n) => q.System.split(/[\/,]/).some((s) => s.trim() && n.toLowerCase().includes(s.trim().toLowerCase().split(" ")[0]))));

  return (
    <>
      <Section title="Prüfung" subtitle="IP-Konflikte, VLAN-Zuordnung an Switch-Ports, Punkt-zu-Punkt-Protokolle am Switch, IGMP/EEE je VLAN, PoE-Budget, doppelt belegte Ports und die MA-Net Gold-Standards. Die Regeln leiten sich aus der Protokollrecherche ab.">
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {["error", "warn", "info"].map((s) => (
            <button key={s} onClick={() => setFilter((f) => ({ ...f, [s]: !f[s] }))}
              style={{ ...S.boxTab, ...(filter[s] ? { borderColor: SEV[s].color, color: "#fff", background: SEV[s].color + "22" } : {}) }}>
              {SEV[s].icon} {SEV[s].label}: <b>{count(s)}</b>
            </button>
          ))}
        </div>
        {issues.length === 0 && <div style={{ padding: 16, border: `1px solid ${OK}55`, background: OK + "14", borderRadius: 8, color: OK, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Check size={16} /> Keine Auffälligkeiten gefunden.</div>}
        {shown.map((i, n) => (
          <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
            <SevBadge sev={i.sev} />
            <div style={{ flex: 1, lineHeight: 1.45 }}>{i.msg}</div>
            {(i.dev || i.conn || i.vlan) && <button style={S.smallBtn} onClick={() => onShowIssue(i)}>Zeigen →</button>}
          </div>
        ))}
      </Section>

      {P.geraete.some((d) => maNetGen(d) > 0) && (
        <Section title="MA-Net Gold-Standards" subtitle="Diese Regeln prüft der Netzwerkplaner für alle Geräte mit MA-Net1, MA-Net2 oder MA-Net3. Treffer stehen oben mit dem Präfix „MA-Net:“.">
          <table style={S.table}>
            <tbody>{GOLD_STANDARDS.map(([k, t]) => {
              return <tr key={k}><td style={{ ...S.td, fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td><td style={{ ...S.td, fontSize: 12, color: SUB }}>{t}</td></tr>;
            })}</tbody>
          </table>
          {(() => { const n = issues.filter((i) => i.msg.startsWith("MA-Net:") && i.sev !== "info").length;
            return <div style={{ marginTop: 10, fontSize: 13, color: n ? WARN : OK, fontWeight: 600 }}>{n ? `${n} Abweichung${n > 1 ? "en" : ""} von den Gold-Standards` : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={14} /> Alle MA-Net-Regeln erfüllt</span>}</div>; })()}
        </Section>
      )}

      <Section title="Switch-Konfiguration je VLAN" subtitle="Zusammenfassung dessen, was auf den managed Switches einzustellen ist.">
        <table style={S.table}>
          <thead><tr><th style={S.th}>VLAN</th><th style={S.th}>IGMP</th><th style={S.th}>EEE</th><th style={S.th}>QoS</th><th style={S.th}>Protokolle im VLAN</th></tr></thead>
          <tbody>
            {[...P.vlans].sort((a, b) => a.vid - b.vid).map((v) => {
              const protos = new Set();
              for (const d of P.geraete) if (ipPorts(d).some((i) => i.vlan === v.id)) for (const s of d.protokolle || []) { const r = findProtokoll(s); if (r && !r.flags.p2p && !r.flags.kein_ip) protos.add(r.name); }
              return (
                <tr key={v.id}>
                  <td style={S.td}><VlanChip v={v} /></td>
                  <td style={{ ...S.td, color: v.igmp ? OK : MUTED }}>{v.igmp ? "Snooping an" : "aus"}</td>
                  <td style={{ ...S.td, color: v.eeeAus ? OK : MUTED }}>{v.eeeAus ? "aus" : "–"}</td>
                  <td style={S.td}>{v.qos ? "aktiv" : "–"}</td>
                  <td style={{ ...S.td, fontSize: 11, color: SUB }}>{[...protos].slice(0, 8).join(", ")}{protos.size > 8 ? ` … (+${protos.size - 8})` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {qos.length > 0 && <>
          <h3 style={{ ...S.h3, marginTop: 20 }}>QoS/DSCP der Systeme im Projekt</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>System</th><th style={S.th}>DSCP</th><th style={S.th}>Hinweis</th></tr></thead>
            <tbody>{qos.map((q) => <tr key={q.System}><td style={{ ...S.td, fontWeight: 600 }}>{q.System}</td><td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{q["DSCP-Werte"]}</td><td style={{ ...S.td, fontSize: 12, color: SUB }}>{q.Hinweis}</td></tr>)}</tbody>
          </table>
        </>}
      </Section>
    </>
  );
}
