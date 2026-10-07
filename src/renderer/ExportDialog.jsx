import React, { useState } from "react";
import { S, LINE, SUB, MUTED, STRONG, ACCENT } from "../shared/constants.js";
import { Modal, Toggle } from "./ui.jsx";
import { PDF_TEILE, XLSX_BLAETTER } from "./exports.js";
import { Download, FileText, Sheet, Table2, Image as ImageIcon } from "lucide-react";

/* Export-Dialog: Format, Inhalt, Topologie-Ansicht und Seite wählen.
   Die letzte Auswahl merkt sich die App auf diesem Rechner. */
const FORMATE = [
  ["pdf", "PDF", FileText, "Dokumentation zum Ausdrucken"],
  ["xlsx", "Excel", Sheet, "Ein Blatt je Liste"],
  ["csv", "CSV", Table2, "Eine Liste als Tabelle"],
  ["svg", "SVG", ImageIcon, "Topologie als Vektorgrafik"],
  ["png", "PNG", ImageIcon, "Topologie als Bild"],
];
export const ANSICHTEN = [["aktuell", "Wie gerade eingestellt"], ["mindmap", "Mindmap"], ["front", "Anschlüsse"], ["cleancat", "Plott"]];
const CSV_LISTEN = [["patch", "Patchliste"], ["ip", "IP-Liste"]];

const LS = "netzwerkplaner_export";
const STANDARD = { format: "pdf", teile: PDF_TEILE.map(([k]) => k), blaetter: XLSX_BLAETTER, csv: "patch", ansicht: "aktuell", seite: "A4", hoch: false };
const lade = () => { try { return { ...STANDARD, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return STANDARD; } };

const Wahl = ({ aktiv, onClick, children, title }) => (
  <button title={title} onClick={onClick} style={{ ...S.boxTab, display: "inline-flex", alignItems: "center", gap: 5, ...(aktiv ? { ...S.boxTabActive, borderColor: ACCENT } : {}) }}>{children}</button>
);
const Gruppe = ({ titel, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>{titel}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
  </div>
);

export default function ExportDialog({ onClose, onExport, planPfad }) {
  const [o, setO] = useState(lade);
  const set = (k, v) => setO((x) => ({ ...x, [k]: v }));
  const umschalten = (k, wert) => setO((x) => ({ ...x, [k]: x[k].includes(wert) ? x[k].filter((y) => y !== wert) : [...x[k], wert] }));
  const mitTopo = o.format === "svg" || o.format === "png" || (o.format === "pdf" && o.teile.includes("topologie"));
  const leer = (o.format === "pdf" && !o.teile.length) || (o.format === "xlsx" && !o.blaetter.length);
  const los = () => {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch {}
    onExport(o);
  };
  return (
    <Modal title="Exportieren" width={560} onClose={onClose}
      footer={<>
        <span style={{ flex: 1, fontSize: 11, color: MUTED }}>{planPfad ? `Speichert neben dem Plan: ${planPfad.split(/[\\/]/).slice(0, -1).pop() || ""}` : "Speichert im zuletzt benutzten Export-Ordner"}</span>
        <button style={S.secondaryBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} disabled={leer} onClick={los}><Download size={14} /> Exportieren</button>
      </>}>
      <Gruppe titel="Format">
        {FORMATE.map(([k, l, Ic, t]) => <Wahl key={k} aktiv={o.format === k} onClick={() => set("format", k)} title={t}><Ic size={14} />{l}</Wahl>)}
      </Gruppe>

      {o.format === "pdf" && <Gruppe titel="Inhalt">
        {PDF_TEILE.map(([k, l]) => <Toggle key={k} checked={o.teile.includes(k)} onChange={() => umschalten("teile", k)} label={l} />)}
      </Gruppe>}
      {o.format === "xlsx" && <Gruppe titel="Blätter">
        {XLSX_BLAETTER.map((k) => <Toggle key={k} checked={o.blaetter.includes(k)} onChange={() => umschalten("blaetter", k)} label={k} />)}
      </Gruppe>}
      {o.format === "csv" && <Gruppe titel="Liste">
        {CSV_LISTEN.map(([k, l]) => <Wahl key={k} aktiv={o.csv === k} onClick={() => set("csv", k)}>{l}</Wahl>)}
      </Gruppe>}

      {mitTopo && <Gruppe titel="Topologie-Ansicht">
        {ANSICHTEN.map(([k, l]) => <Wahl key={k} aktiv={o.ansicht === k} onClick={() => set("ansicht", k)}>{l}</Wahl>)}
      </Gruppe>}

      {o.format === "pdf" && <Gruppe titel="Seite">
        {["A4", "A3"].map((k) => <Wahl key={k} aktiv={o.seite === k} onClick={() => set("seite", k)}>{k}</Wahl>)}
        <span style={{ width: 10 }} />
        <Wahl aktiv={!o.hoch} onClick={() => set("hoch", false)}>Quer</Wahl>
        <Wahl aktiv={o.hoch} onClick={() => set("hoch", true)}>Hoch</Wahl>
      </Gruppe>}
    </Modal>
  );
}
