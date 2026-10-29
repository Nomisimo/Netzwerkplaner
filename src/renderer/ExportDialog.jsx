import React, { useState } from "react";
import { S, LINE, SUB, MUTED, STRONG, ACCENT } from "../shared/constants.js";
import { Modal, Toggle } from "./ui.jsx";
import { PDF_TEILE, PDF_STANDARD, XLSX_BLAETTER } from "./exports.js";
import { versionsVorschlag, naechsteVersion } from "../shared/exportplan.js";
import { Download, FileText, Sheet, Table2, Image as ImageIcon } from "lucide-react";

/* Export-Dialog: Planversion, Format, Inhalt, Topologie-Ansicht und Seite wählen.
   Die letzte Auswahl merkt sich die App auf diesem Rechner, die Version steht im Projekt. */
const FORMATE = [
  ["pdf", "PDF", FileText, "Dokumentation zum Ausdrucken"],
  ["xlsx", "Excel", Sheet, "Ein Blatt je Liste"],
  ["csv", "CSV", Table2, "Eine Liste als Tabelle"],
  ["svg", "SVG", ImageIcon, "Topologie als Vektorgrafik"],
  ["png", "PNG", ImageIcon, "Topologie als Bild"],
];
export const ANSICHTEN = [["aktuell", "Wie gerade eingestellt"], ["mindmap", "Mindmap"], ["front", "Anschlüsse"], ["cleancat", "Druckplan"]];
const CSV_LISTEN = [["patch", "Patchliste"], ["ip", "IP-Liste"]];

const LS = "netzwerkplaner_export";
const STANDARD = { format: "pdf", teile: PDF_STANDARD, blaetter: XLSX_BLAETTER, csv: "patch", ansicht: "aktuell", seite: "A4", hoch: false };
// alte Auswahl: „Deckblatt mit VLANs“ und „IP-Liste“ stecken jetzt in „VLAN- und IP-Liste“
const BEKANNT = new Set(PDF_TEILE.map(([k]) => k));
const lade = () => {
  try {
    const o = { ...STANDARD, ...JSON.parse(localStorage.getItem(LS) || "{}") };
    o.teile = [...new Set(o.teile.map((k) => (k === "ip" ? "vlans" : k)).filter((k) => BEKANNT.has(k)))];
    o.blaetter = o.blaetter.filter((k) => XLSX_BLAETTER.includes(k));
    return o;
  } catch { return STANDARD; }
};

const Wahl = ({ aktiv, onClick, children, title }) => (
  <button title={title} onClick={onClick} style={{ ...S.boxTab, display: "inline-flex", alignItems: "center", gap: 5, ...(aktiv ? { ...S.boxTabActive, borderColor: ACCENT } : {}) }}>{children}</button>
);
const Gruppe = ({ titel, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: SUB, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>{titel}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
  </div>
);

export default function ExportDialog({ P, onClose, onExport, planPfad, aktuelleAnsicht = "mindmap" }) {
  const [o, setO] = useState(lade);
  const vorschlag = versionsVorschlag(P);
  const [version, setVersion] = useState(vorschlag.version);
  const set = (k, v) => setO((x) => ({ ...x, [k]: v }));
  const umschalten = (k, wert) => setO((x) => ({ ...x, [k]: x[k].includes(wert) ? x[k].filter((y) => y !== wert) : [...x[k], wert] }));
  const mitTopo = o.format === "svg" || o.format === "png" || (o.format === "pdf" && o.teile.includes("topologie"));
  // Seite gilt fürs PDF und für den Druckplan (der wird auf genau dieses Blatt gezeichnet)
  const plott = mitTopo && (o.ansicht === "aktuell" ? aktuelleAnsicht : o.ansicht) === "cleancat";
  const mitSeite = o.format === "pdf" || ((o.format === "svg" || o.format === "png") && plott);
  const leer = (o.format === "pdf" && !o.teile.length) || (o.format === "xlsx" && !o.blaetter.length);
  const los = () => {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch {}
    onExport({ ...o, version: version.trim() || P.meta.version });
  };
  const letzter = vorschlag.letzter;
  return (
    <Modal title="Exportieren" width={560} onClose={onClose}
      footer={<>
        <span style={{ flex: 1, fontSize: 11, color: MUTED }}>{planPfad ? `Speichert neben dem Plan: ${planPfad.split(/[\\/]/).slice(0, -1).pop() || ""}` : "Speichert im zuletzt benutzten Export-Ordner"}</span>
        <button style={S.secondaryBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} disabled={leer} onClick={los}><Download size={14} /> Exportieren</button>
      </>}>
      <Gruppe titel="Planversion">
        <input style={{ ...S.input, width: 110 }} value={version} onChange={(e) => setVersion(e.target.value)} />
        {version !== P.meta.version
          ? <button style={S.ghostBtn} onClick={() => setVersion(P.meta.version)} title="Version nicht ändern">bei v{P.meta.version} bleiben</button>
          : <button style={S.ghostBtn} onClick={() => setVersion(naechsteVersion(P.meta.version))} title="Nächste Versionsnummer">v{naechsteVersion(P.meta.version)}</button>}
        <span style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>
          {letzter ? `Zuletzt exportiert: v${letzter.version}, ${new Date(letzter.zeit).toLocaleDateString("de-DE")}${vorschlag.geaendert ? " · seitdem geändert" : ""}` : "Noch nicht exportiert"}
        </span>
      </Gruppe>

      <Gruppe titel="Format">
        {FORMATE.map(([k, l, Ic, t]) => <Wahl key={k} aktiv={o.format === k} onClick={() => set("format", k)} title={t}><Ic size={14} />{l}</Wahl>)}
      </Gruppe>

      {o.format === "pdf" && <Gruppe titel="Inhalt">
        {PDF_TEILE.map(([k, l, info]) => <Toggle key={k} checked={o.teile.includes(k)} onChange={() => umschalten("teile", k)} label={l} title={info} />)}
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

      {mitSeite && <Gruppe titel={o.format === "pdf" ? (plott ? "Seite (auch Blatt des Druckplans)" : "Seite") : "Blatt des Druckplans"}>
        {["A4", "A3"].map((k) => <Wahl key={k} aktiv={o.seite === k} onClick={() => set("seite", k)}>{k}</Wahl>)}
        <span style={{ width: 10 }} />
        <Wahl aktiv={!o.hoch} onClick={() => set("hoch", false)}>Quer</Wahl>
        <Wahl aktiv={o.hoch} onClick={() => set("hoch", true)}>Hoch</Wahl>
      </Gruppe>}
    </Modal>
  );
}
