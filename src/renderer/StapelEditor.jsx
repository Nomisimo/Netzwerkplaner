import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, TYPEN, katColor } from "../shared/constants.js";
import { entstapeln } from "../shared/anordnung.js";
import { stapelAus, stapelEinfuegen } from "../shared/konfig.js";
import { IconView } from "./icons.jsx";
import { Field } from "./ui.jsx";
import { KonfigEinfuegen } from "./KonfigDialog.jsx";
import { ablegen, useZwischenablage } from "./zwischenablage.js";
import { Layers, Pin, CopyPlus, Copy, Check, ClipboardPaste, Ungroup, ChevronUp, ChevronDown, X as XIcon } from "lucide-react";

/* Bearbeitungsfenster eines Stapels (Rack, Tower): Name, Reihenfolge,
   Geräte hinzufügen oder lösen, kopieren, duplizieren, Konfiguration in alle einfügen. */
export default function StapelEditor({ P, stapelId, mutate, onSelectDevice, onSelectStapel, onClose, pinned, onPin }) {
  const s = (P.layout.stapel || []).find((x) => x.id === stapelId);
  const konfigClip = useZwischenablage("konfig");
  const [konfigDlg, setKonfigDlg] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  if (!s) return null;
  const devs = s.ids.map((id) => P.geraete.find((g) => g.id === id)).filter(Boolean);
  const inStapel = new Set((P.layout.stapel || []).flatMap((x) => x.ids));
  const frei = P.geraete.filter((g) => !inStapel.has(g.id)).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const aendern = (fn) => mutate((d) => { const x = (d.layout.stapel || []).find((y) => y.id === stapelId); if (x) fn(x, d); });
  const schiebe = (i, r) => aendern((x) => { const j = i + r; if (j < 0 || j >= x.ids.length) return; [x.ids[i], x.ids[j]] = [x.ids[j], x.ids[i]]; });
  const loesen = (id) => mutate((d) => { d.layout.stapel = entstapeln(d.layout.stapel, id); });
  const duplizieren = () => {
    let neu = null;
    mutate((d) => { const clip = stapelAus(d, stapelId); if (clip) neu = stapelEinfuegen(d, clip).stapelId; });
    if (neu) onSelectStapel(neu);
  };

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Layers size={16} /> Stapel bearbeiten</div>
      <Field label="Name" hint="z. B. Rack FOH, Tower Bühne links">
        <input style={S.input} value={s.name || ""} placeholder="Stapel" onChange={(e) => aendern((x) => { x.name = e.target.value; })} />
      </Field>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {onPin && <button style={{ ...S.smallBtn, ...(pinned ? { borderColor: ACCENT, color: ACCENT } : {}) }} onClick={onPin} title="Taste P · Der ganze Stapel bleibt stehen, wenn sich die Anordnung ändert. Ziehen verschiebt ihn trotzdem."><Pin size={14} />{pinned ? "Angepinnt" : "Anpinnen"}</button>}
        <button style={S.smallBtn} onClick={duplizieren} title="Alle Geräte des Stapels mit ihren Einstellungen und den Verbindungen untereinander als neuen Stapel anlegen (ohne IP- und MAC-Adressen)"><CopyPlus size={14} /> Duplizieren</button>
        <button style={S.smallBtn} onClick={() => { const c = stapelAus(P, stapelId); if (c) { ablegen(c); setKopiert(true); setTimeout(() => setKopiert(false), 1500); } }}
          title="Stapel in die Zwischenablage. Einfügen in der Werkzeugleiste mit „Stapel einfügen“, auch in einem anderen Projekt.">{kopiert ? <><Check size={14} /> Kopiert</> : <><Copy size={14} /> Kopieren</>}</button>
        {konfigClip && <button style={S.smallBtn} onClick={() => setKonfigDlg(true)} title={`Kopierte Konfiguration von „${konfigClip.quelle.name}“ in die Geräte dieses Stapels einfügen`}><ClipboardPaste size={14} /> Konfig in alle einfügen</button>}
        <button style={{ ...S.dangerBtn, marginLeft: "auto" }} onClick={() => { mutate((d) => { d.layout.stapel = (d.layout.stapel || []).filter((x) => x.id !== stapelId); }); onClose(); }}
          title="Stapel auflösen. Die Geräte bleiben im Projekt."><Ungroup size={14} /> Auflösen</button>
      </div>

      <div className="sp-section-label" style={{ marginTop: 18 }}>Geräte von oben nach unten ({devs.length})</div>
      {devs.map((g, i) => (
        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", border: `1px solid ${LINE}`, borderLeft: `3px solid ${katColor(g.kategorie)}`, borderRadius: 6, marginBottom: 4, background: "#1f242b" }}>
          <IconView icon={g.icon} customIcons={P.icons} color={katColor(g.kategorie)} size={18} />
          <a style={{ flex: 1, minWidth: 0, cursor: "pointer", fontSize: 13 }} onClick={() => onSelectDevice(g.id)} title="Gerät bearbeiten">
            {g.name}<div style={{ fontSize: 11, color: MUTED }}>{[g.hersteller, g.modell].filter(Boolean).join(" ") || TYPEN[g.typ]?.label}{i === 0 ? " · oben (Anker)" : ""}</div>
          </a>
          <button style={{ ...S.smallBtn, padding: "1px 6px" }} disabled={i === 0} onClick={() => schiebe(i, -1)} title="Nach oben"><ChevronUp size={12} /></button>
          <button style={{ ...S.smallBtn, padding: "1px 6px" }} disabled={i === devs.length - 1} onClick={() => schiebe(i, 1)} title="Nach unten"><ChevronDown size={12} /></button>
          <button style={{ ...S.dangerBtn, padding: "1px 6px" }} onClick={() => loesen(g.id)} title="Aus dem Stapel lösen (Gerät bleibt im Projekt)"><XIcon size={12} /></button>
        </div>
      ))}
      {frei.length > 0 && (
        <select style={{ ...S.selectSm, marginTop: 6 }} value="" onChange={(e) => e.target.value && aendern((x) => { x.ids.push(e.target.value); })}>
          <option value="">+ Gerät zum Stapel hinzufügen …</option>
          {frei.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <div style={{ ...S.hint, marginTop: 12, color: SUB }}>Ein Stapel ist nur grafisch (Rack, Tower). Verbindungen legst du wie gewohnt an. Im Werkzeug „Stapeln“ (Taste S) ziehst du Geräte aufeinander.</div>
      {konfigDlg && konfigClip && <KonfigEinfuegen P={P} clip={konfigClip} ziele={s.ids} mutate={mutate} onClose={() => setKonfigDlg(false)} />}
    </div>
  );
}
