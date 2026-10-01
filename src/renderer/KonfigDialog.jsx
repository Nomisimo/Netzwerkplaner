import React, { useMemo, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, OK, WARN, TYPEN } from "../shared/constants.js";
import { KONFIG_TEILE, konfigTeileVon, konfigAus, konfigAnwenden } from "../shared/konfig.js";
import { Modal } from "./ui.jsx";
import { ablegen } from "./zwischenablage.js";
import { Copy, ClipboardPaste, Undo2 } from "lucide-react";

const Haken = ({ checked, onChange, children, hint, disabled }) => (
  <label title={hint} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 13, opacity: disabled ? 0.45 : 1, cursor: disabled ? "default" : "pointer" }}>
    <input type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT, marginTop: 2 }} />
    <span>{children}{hint && <div style={{ fontSize: 11, color: MUTED }}>{hint}</div>}</span>
  </label>
);

const modellVon = (g) => [g.hersteller, g.modell].filter(Boolean).join(" ");

/* Konfiguration kopieren: welche Teile sollen in die Zwischenablage */
export function KonfigKopieren({ P, dev, onClose }) {
  const vorhanden = konfigTeileVon(dev);
  const [teile, setTeile] = useState(vorhanden.filter((k) => k !== "notizen" && k !== "allgemein")); // Bereich und Notizen sind meist gerätespezifisch
  const umschalten = (k, an) => setTeile((t) => (an ? [...t, k] : t.filter((x) => x !== k)));
  return (
    <Modal title={`Konfiguration von „${dev.name}“ kopieren`} width={520} onClose={onClose}
      footer={<>
        <button style={S.secondaryBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} disabled={!teile.length} onClick={() => { ablegen(konfigAus(dev, P.vlans, teile)); onClose(); }}><Copy size={14} /> Kopieren</button>
      </>}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>Welche Daten sollen kopiert werden? Einfügen geht danach bei jedem anderen Gerät über „Konfig einfügen“, auch in einem anderen Projekt.</div>
      {KONFIG_TEILE.map((t) => (
        <Haken key={t.key} checked={teile.includes(t.key)} disabled={!vorhanden.includes(t.key)} hint={t.hint} onChange={(an) => umschalten(t.key, an)}>{t.label}</Haken>
      ))}
    </Modal>
  );
}

/* Konfiguration einfügen: Teile und Zielgeräte wählen */
export function KonfigEinfuegen({ P, clip, ziele: start, mutate, onClose }) {
  const [teile, setTeile] = useState(clip.teile);
  const [ziele, setZiele] = useState(start);
  const [ergebnis, setErgebnis] = useState(null);
  const q = clip.quelle;
  const liste = useMemo(() => [...P.geraete].sort((a, b) => (b.isSwitch === q.isSwitch) - (a.isSwitch === q.isSwitch) || a.name.localeCompare(b.name, "de")), [P.geraete, q.isSwitch]);
  const schnell = [
    ["Gleiches Modell", (g) => q.modell && modellVon(g) === q.modell],
    ["Gleicher Typ", (g) => g.typ === q.typ],
    [q.isSwitch ? "Alle Switches" : "Alle Endgeräte", (g) => !!g.isSwitch === q.isSwitch],
  ];
  const umschalten = (set, k, an) => set((t) => (an ? [...t, k] : t.filter((x) => x !== k)));
  const einfuegen = () => {
    let fehlend = 0;
    mutate((d) => {
      for (const id of ziele) {
        const g = d.geraete.find((x) => x.id === id);
        if (g) fehlend += konfigAnwenden(g, clip, teile, d.vlans).fehlendePorts;
      }
    });
    setErgebnis({ n: ziele.length, fehlend });
  };
  if (ergebnis) return (
    <Modal title="Konfiguration eingefügt" width={460} onClose={onClose} footer={<button style={S.primaryBtn} onClick={onClose}>Schließen</button>}>
      <div style={{ color: OK }}>In {ergebnis.n} {ergebnis.n === 1 ? "Gerät" : "Geräte"} eingefügt: {KONFIG_TEILE.filter((t) => teile.includes(t.key)).map((t) => t.label).join(", ")}.</div>
      {ergebnis.fehlend > 0 && <div style={{ color: WARN, marginTop: 8 }}>{ergebnis.fehlend} Port-Einstellungen hatten im Ziel keinen passenden Port und wurden ausgelassen.</div>}
      <div style={{ ...S.hint, marginTop: 10 }}>Rückgängig geht wie immer mit <Undo2 size={12} style={{ verticalAlign: "-2px" }} /> oder {navigator.platform?.startsWith("Mac") ? "⌘" : "Strg"}+Z.</div>
    </Modal>
  );
  return (
    <Modal title="Konfiguration einfügen" width={640} onClose={onClose}
      footer={<>
        <button style={S.secondaryBtn} onClick={onClose}>Abbrechen</button>
        <button style={S.primaryBtn} disabled={!teile.length || !ziele.length} onClick={einfuegen}><ClipboardPaste size={14} /> In {ziele.length} {ziele.length === 1 ? "Gerät" : "Geräte"} einfügen</button>
      </>}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>Kopiert von <b style={{ color: "#fff" }}>{q.name}</b>{q.modell ? ` (${q.modell})` : ""}. Namen, IP- und MAC-Adressen und Verbindungen der Zielgeräte bleiben.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        <div>
          <div className="sp-section-label">Was einfügen</div>
          {KONFIG_TEILE.filter((t) => clip.teile.includes(t.key)).map((t) => (
            <Haken key={t.key} checked={teile.includes(t.key)} hint={t.hint} onChange={(an) => umschalten(setTeile, t.key, an)}>{t.label}</Haken>
          ))}
        </div>
        <div>
          <div className="sp-section-label">In welche Geräte</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {schnell.map(([l, f]) => <button key={l} style={S.smallBtn} onClick={() => setZiele(P.geraete.filter(f).map((g) => g.id))}>{l}</button>)}
            <button style={S.smallBtn} onClick={() => setZiele([])}>Keine</button>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 6, padding: "2px 8px" }}>
            {liste.map((g) => (
              <Haken key={g.id} checked={ziele.includes(g.id)} onChange={(an) => umschalten(setZiele, g.id, an)}>
                {g.name} <span style={{ fontSize: 11, color: MUTED }}>{modellVon(g) || TYPEN[g.typ]?.label} · {g.ports.length} Ports</span>
              </Haken>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
