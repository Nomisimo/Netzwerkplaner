import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, INFO, OK, katColor, KATEGORIEN, INPUT, STRONG } from "../../shared/constants.js";
import { KATALOG, ipPorts } from "../../shared/catalog.js";
import { Section, Field } from "../ui.jsx";
import { standortUmbenennen } from "../../shared/model.js";
import { X as XIcon, RotateCcw } from "lucide-react";
import PruefungKompakt from "./PruefungTab.jsx";
import VlanTab from "./VlanTab.jsx";

const Stat = ({ label, value, color, onClick }) => (
  <div onClick={onClick} style={{ background: INPUT, border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 10px", cursor: onClick ? "pointer" : "default" }}>
    <div style={{ fontSize: 10, color: SUB, fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 800, color: color || STRONG }}>{value}</div>
  </div>
);

// Setup: Projektangaben, Übersicht mit Prüfung, Standorte und VLANs auf einer Seite
export default function ProjektTab({ P, X, mutate, issues, goTab, loadDemo, newProject, onShowIssue, onSelectDevice }) {
  const [neuBereich, setNeuBereich] = useState("");
  const m = P.meta;
  const setMeta = (k, v) => mutate((d) => (d.meta[k] = v));
  const n = (s) => issues.filter((i) => i.sev === s).length;
  const ips = P.geraete.reduce((s, d) => s + ipPorts(d).filter((i) => i.ip).length, 0);
  // Standorte: die Liste des Projekts plus alles, was an Geräten steht
  const standorte = [...new Set([...P.bereiche, ...P.geraete.map((d) => (d.bereich || "").trim()).filter(Boolean)])];
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
      <Section title="Setup" subtitle="Projektangaben, Übersicht mit Prüfung, Standorte und VLANs. Die Angaben erscheinen im Kopf der App und in den Exporten.">
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 6 }}>
          <Stat label="Geräte" value={P.geraete.length} onClick={() => goTab("geraete")} />
          <Stat label="Switches" value={P.geraete.filter((d) => d.isSwitch).length} />
          <Stat label="Verbindungen" value={P.verbindungen.length} onClick={() => goTab("topologie")} />
          <Stat label="VLANs" value={P.vlans.length} onClick={() => goTab("vlans")} />
          <Stat label="IP-Adressen" value={ips} onClick={() => goTab("vlans")} />
          <Stat label="Fehler" value={n("error")} color={n("error") ? ERR : OK} onClick={() => goTab("pruefung")} />
          <Stat label="Warnungen" value={n("warn")} color={n("warn") ? WARN : OK} onClick={() => goTab("pruefung")} />
        </div>
        {perKat.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {perKat.map(([k, c]) => <span key={k} style={{ ...S.chip, borderColor: katColor(k) + "88" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: katColor(k) }} />{k}: {c}</span>)}
          </div>
        )}
        <PruefungKompakt issues={issues} onShowIssue={onShowIssue} />
      </Section>

      <Section title="Standorte / Äste" subtitle="Standorte der Geräte (Feld „Standort / Ast“, z. B. FOH, Bühne, Delay-Tower). Umbenennen gilt für das ganze Projekt. Die Anmerkung erscheint nur in der Plott-Ansicht.">
        <div style={{ display: "grid", gap: 8 }}>
          {standorte.map((b) => {
            const anzahl = P.geraete.filter((g) => (g.bereich || "").trim() === b).length;
            return (
              <div key={b} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap", border: `1px solid ${LINE}`, borderRadius: 8, padding: 8 }}>
                <input style={{ ...S.input, width: 200 }} defaultValue={b} key={"n" + b}
                  title="Name ändern: gilt im ganzen Projekt, auch an allen Geräten"
                  onBlur={(e) => { const v = e.target.value.trim(); if (!v || v === b) { e.target.value = b; return; } mutate((d) => standortUmbenennen(d, b, v)); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = b; e.target.blur(); } }} />
                <input style={{ ...S.input, flex: 1, minWidth: 240 }} placeholder="Anmerkung (nur in Plott)" value={P.standortInfo?.[b]?.anmerkung || ""}
                  onChange={(e) => mutate((d) => { const i = d.standortInfo || (d.standortInfo = {}); i[b] = { ...(i[b] || {}), anmerkung: e.target.value }; })} />
                <span style={{ fontSize: 12, color: SUB, alignSelf: "center" }}>{anzahl} {anzahl === 1 ? "Gerät" : "Geräte"}</span>
                <button style={S.smallBtn} title={anzahl ? "Erst die Geräte umtragen" : "Aus der Liste entfernen"} disabled={!!anzahl}
                  onClick={() => mutate((d) => { const i = d.bereiche.indexOf(b); if (i >= 0) d.bereiche.splice(i, 1); if (d.standortInfo) delete d.standortInfo[b]; })}><XIcon size={12} /></button>
              </div>
            );
          })}
        </div>
        <form style={{ ...S.row, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); const v = neuBereich.trim(); if (v && !standorte.includes(v)) mutate((d) => d.bereiche.push(v)); setNeuBereich(""); }}>
          <input style={S.input} placeholder="Neuer Standort" value={neuBereich} onChange={(e) => setNeuBereich(e.target.value)} />
          <button style={S.secondaryBtn}>+ Hinzufügen</button>
        </form>
      </Section>

      <div id="setup-vlans"><VlanTab P={P} X={X} mutate={mutate} issues={issues} onSelectDevice={onSelectDevice} /></div>

      <Section title="Projekt zurücksetzen">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={S.secondaryBtn} onClick={loadDemo}>Beispielprojekt laden</button>
          <button style={{ ...S.dangerBtnWide, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={newProject}><RotateCcw size={14} /> Neues leeres Projekt</button>
        </div>
      </Section>
    </>
  );
}
