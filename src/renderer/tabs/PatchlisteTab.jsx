import React, { useMemo, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, katColor } from "../../shared/constants.js";
import { patchZeilen } from "../../shared/patchliste.js";
import { Section } from "../ui.jsx";
import { GripVertical, ChevronUp, ChevronDown, RotateCcw, Printer, FileSpreadsheet } from "lucide-react";

/* Patchliste: alle Geräte in Aufbau-Reihenfolge, per Ziehen oder Pfeilen umsortierbar.
   Notizen lassen sich direkt bearbeiten; im Druck gibt es zusätzlich leere Zeilen
   für Notizen vor Ort und ein Kästchen zum Abhaken. */
export default function PatchlisteTab({ P, X, mutate, onSelectDevice, onExport }) {
  const zeilen = useMemo(() => patchZeilen(P, X), [P, X]);
  const manuell = (P.patchliste?.reihenfolge || []).length > 0;
  const [zieht, setZieht] = useState(null); // id der gezogenen Zeile
  const [ueber, setUeber] = useState(null);

  const setzeReihenfolge = (ids) => mutate((d) => { d.patchliste = { ...(d.patchliste || {}), reihenfolge: ids }; });
  const verschiebe = (id, ziel) => {
    const ids = zeilen.map((z) => z.id).filter((x) => x !== id);
    const i = ziel == null ? ids.length : ids.indexOf(ziel);
    ids.splice(i < 0 ? ids.length : i, 0, id);
    setzeReihenfolge(ids);
  };
  const schritt = (i, d) => {
    const ids = zeilen.map((z) => z.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setzeReihenfolge(ids);
  };
  const liste = (l) => l.length ? l.map((t, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{t}</div>) : <span style={{ color: MUTED }}>–</span>;

  return (
    <Section title={`Patchliste (${zeilen.length})`}
      subtitle="Alle Geräte in Aufbau-Reihenfolge: vom Haupt-Switch aus, Geräte eines Switches nach Portnummer, Stapel zusammen. Zeilen per Ziehen am Griff oder mit den Pfeilen umsortieren."
      right={<div style={{ display: "flex", gap: 6 }}>
        <button style={S.ghostBtn} disabled={!manuell} onClick={() => mutate((d) => { delete d.patchliste; })} title="Von Hand gesetzte Reihenfolge verwerfen und wieder nach Aufbau-Logik sortieren"><RotateCcw size={14} />Automatisch sortieren</button>
        <button style={S.ghostBtn} onClick={() => onExport("patch-pdf")} title="Patchliste als PDF zum Ausdrucken, mit Platz für Notizen vor Ort"><Printer size={14} />PDF</button>
        <button style={S.ghostBtn} onClick={() => onExport("patch-csv")} title="Patchliste als CSV (Excel, Numbers)"><FileSpreadsheet size={14} />CSV</button>
      </div>}>
      {manuell && <div style={{ ...S.hint, marginTop: 0, marginBottom: 6 }}>Reihenfolge von Hand angepasst. Neue Geräte erscheinen an ihrer automatischen Stelle.</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ ...S.table, fontSize: 12, minWidth: 1100 }}>
          <thead><tr>
            <th style={S.th}></th><th style={S.th}>#</th><th style={S.th}>Gerät</th><th style={S.th}>IPs / Interfaces</th><th style={S.th}>Gesteckt auf</th>
            <th style={S.th}>Weitere Kabel</th><th style={S.th}>Abteilung</th><th style={S.th}>Standort</th><th style={S.th}>Felder</th><th style={{ ...S.th, minWidth: 200 }}>Notizen</th>
          </tr></thead>
          <tbody>
            {zeilen.map((z, i) => {
              const neueGruppe = i > 0 && (z.isSwitch || (z.aufSwitch !== zeilen[i - 1].aufSwitch && !zeilen[i - 1].isSwitch));
              return (
                <tr key={z.id} draggable onDragStart={(e) => { setZieht(z.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", z.id); }}
                  onDragOver={(e) => { if (zieht) { e.preventDefault(); setUeber(z.id); } }} onDragLeave={() => setUeber((u) => (u === z.id ? null : u))}
                  onDrop={(e) => { e.preventDefault(); if (zieht && zieht !== z.id) verschiebe(zieht, z.id); setZieht(null); setUeber(null); }}
                  onDragEnd={() => { setZieht(null); setUeber(null); }}
                  style={{ background: z.isSwitch ? "#ffffff0a" : undefined, opacity: zieht === z.id ? 0.4 : 1, boxShadow: ueber === z.id && zieht !== z.id ? `inset 0 2px 0 ${ACCENT}` : undefined, borderTop: neueGruppe ? `2px solid ${LINE}` : undefined }}>
                  <td style={{ ...S.td, width: 54, whiteSpace: "nowrap", color: MUTED }}>
                    <span style={{ cursor: "grab", display: "inline-flex", verticalAlign: "middle" }} title="Ziehen zum Umsortieren"><GripVertical size={14} /></span>
                    <button style={{ ...S.smallBtn, padding: "1px 2px", background: "none", border: "none" }} disabled={i === 0} onClick={() => schritt(i, -1)} title="Nach oben"><ChevronUp size={12} /></button>
                    <button style={{ ...S.smallBtn, padding: "1px 2px", background: "none", border: "none" }} disabled={i === zeilen.length - 1} onClick={() => schritt(i, 1)} title="Nach unten"><ChevronDown size={12} /></button>
                  </td>
                  <td style={{ ...S.td, color: SUB, width: 28 }}>{z.nr}</td>
                  <td style={{ ...S.td, minWidth: 170 }}>
                    <button onClick={() => onSelectDevice(z.id)} style={{ background: "none", border: "none", padding: 0, color: "#fff", fontWeight: z.isSwitch ? 800 : 700, cursor: "pointer", textAlign: "left", fontSize: 12.5 }}>{z.name}</button>
                    {z.netzname && <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#c8d0ff" }}>{z.netzname}</div>}
                    <div style={{ fontSize: 11, color: MUTED }}>{z.modell}{z.stapel ? ` · Stapel ${z.stapel}` : ""}</div>
                  </td>
                  <td style={{ ...S.td, fontFamily: "ui-monospace,monospace", fontSize: 11 }}>{liste(z.ips)}</td>
                  <td style={{ ...S.td, whiteSpace: "nowrap" }}>{z.gesteckt || <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={{ ...S.td, fontSize: 11 }}>{liste(z.weitereKabel)}</td>
                  <td style={{ ...S.td, color: katColor(z.abteilung) }}>{z.abteilung}</td>
                  <td style={S.td}>{z.standort}</td>
                  <td style={{ ...S.td, fontSize: 11 }}>{z.felder.join(" · ") || <span style={{ color: MUTED }}>–</span>}</td>
                  <td style={S.td}>
                    <textarea rows={1} value={z.notizen} placeholder="Notiz …" onChange={(e) => { const v = e.target.value; mutate((d) => { const g = d.geraete.find((x) => x.id === z.id); if (g) g.notizen = v; }); }}
                      style={{ ...S.inputSm, fontSize: 12, resize: "vertical", minHeight: 26, fontFamily: "inherit" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!zeilen.length && <div style={S.empty}>Noch keine Geräte.</div>}
      <div style={S.hint}>Im PDF bekommt jede Zeile zusätzlich Platz für Notizen vor Ort und ein Kästchen zum Abhaken. Excel- und PDF-Export (oben rechts) enthalten die Patchliste ebenfalls.</div>
    </Section>
  );
}
