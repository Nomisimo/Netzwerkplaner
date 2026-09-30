import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, INFO, OK, katColor, KATEGORIEN } from "../../shared/constants.js";
import { KATALOG, ipPorts } from "../../shared/catalog.js";
import { Section, Field } from "../ui.jsx";

const Stat = ({ label, value, color, onClick }) => (
  <div onClick={onClick} style={{ background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
    <div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || "#fff", marginTop: 2 }}>{value}</div>
  </div>
);

export default function ProjektTab({ P, X, mutate, issues, goTab, loadDemo, newProject }) {
  const [neuBereich, setNeuBereich] = useState("");
  const m = P.meta;
  const setMeta = (k, v) => mutate((d) => (d.meta[k] = v));
  const n = (s) => issues.filter((i) => i.sev === s).length;
  const ips = P.geraete.reduce((s, d) => s + ipPorts(d).filter((i) => i.ip).length, 0);
  const perKat = Object.keys(KATEGORIEN).map((k) => [k, P.geraete.filter((d) => d.kategorie === k).length]).filter(([, c]) => c);

  return (
    <>
      {P.geraete.length === 0 && (
        <Section title="Willkommen im Netzwerkplaner" subtitle="Offline-Planung für Veranstaltungsnetze: Topologie als Mindmap oder Frontplatten, VLANs, IP-Adressen und Prüfungen in einer Projektdatei.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.primaryBtn} onClick={() => goTab("topologie")}>Leeres Projekt: zur Topologie</button>
            <button style={S.secondaryBtn} onClick={loadDemo}>Beispielprojekt laden</button>
          </div>
          <p style={S.hint}>Standard-VLANs aus der Protokollrecherche sind bereits angelegt (10 Audio Primary, 11 Audio Secondary, 20 Licht, 30 Video, 40 Intercom, 50 Steuerung, 99 Management). Gerätekatalog: {KATALOG.geraete.length} Modelle, Protokollreferenz: {KATALOG.protokolle.length} Protokolle (Stand {KATALOG.stand}).</p>
        </Section>
      )}
      <Section title="Projekt" subtitle="Diese Angaben erscheinen im Kopf der App und in den Exporten.">
        <div style={S.metaGrid}>
          <Field label="Veranstaltung"><input style={S.input} value={m.veranstaltung} onChange={(e) => setMeta("veranstaltung", e.target.value)} /></Field>
          <Field label="Ort / Venue"><input style={S.input} value={m.ort} onChange={(e) => setMeta("ort", e.target.value)} /></Field>
          <Field label="Ersteller"><input style={S.input} value={m.ersteller} onChange={(e) => setMeta("ersteller", e.target.value)} /></Field>
          <Field label="Datum"><input type="date" style={S.input} value={m.datum} onChange={(e) => setMeta("datum", e.target.value)} /></Field>
          <Field label="Planversion"><input style={S.input} value={m.version} onChange={(e) => setMeta("version", e.target.value)} /></Field>
        </div>
        <Field label="Notiz" style={{ marginTop: 10 }}><textarea style={{ ...S.input, minHeight: 60, fontFamily: "inherit", fontSize: 13 }} value={m.notiz} onChange={(e) => setMeta("notiz", e.target.value)} /></Field>
      </Section>

      <Section title="Übersicht">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <Stat label="Geräte" value={P.geraete.length} onClick={() => goTab("geraete")} />
          <Stat label="Switches" value={P.geraete.filter((d) => d.isSwitch).length} />
          <Stat label="Verbindungen" value={P.verbindungen.length} onClick={() => goTab("topologie")} />
          <Stat label="VLANs" value={P.vlans.length} onClick={() => goTab("vlans")} />
          <Stat label="IP-Adressen" value={ips} onClick={() => goTab("vlans")} />
          <Stat label="Fehler" value={n("error")} color={n("error") ? ERR : OK} onClick={() => goTab("pruefung")} />
          <Stat label="Warnungen" value={n("warn")} color={n("warn") ? WARN : OK} onClick={() => goTab("pruefung")} />
        </div>
        {perKat.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
            {perKat.map(([k, c]) => <span key={k} style={{ ...S.chip, borderColor: katColor(k) + "88" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: katColor(k) }} />{k}: {c}</span>)}
          </div>
        )}
      </Section>

      <Section title="Standorte / Äste" subtitle="Vorschläge für das Feld „Standort / Ast“ der Geräte (z. B. FOH, Bühne, Delay-Tower).">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {P.bereiche.map((b, i) => (
            <span key={b + i} style={S.chip}>{b} <span style={{ cursor: "pointer", color: MUTED }} onClick={() => mutate((d) => d.bereiche.splice(i, 1))}>✕</span></span>
          ))}
        </div>
        <form style={S.row} onSubmit={(e) => { e.preventDefault(); if (neuBereich.trim()) { mutate((d) => d.bereiche.push(neuBereich.trim())); setNeuBereich(""); } }}>
          <input style={S.input} placeholder="Neuer Standort" value={neuBereich} onChange={(e) => setNeuBereich(e.target.value)} />
          <button style={S.secondaryBtn}>+ Hinzufügen</button>
        </form>
      </Section>

      <Section title="Projekt zurücksetzen">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={S.secondaryBtn} onClick={loadDemo}>Beispielprojekt laden</button>
          <button style={S.dangerBtnWide} onClick={newProject}>↺ Neues leeres Projekt</button>
        </div>
      </Section>
    </>
  );
}
