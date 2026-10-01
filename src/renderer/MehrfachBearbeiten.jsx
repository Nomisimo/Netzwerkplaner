import React from "react";
import { S, KATEGORIEN, MUTED } from "../shared/constants.js";
import { Field } from "./ui.jsx";

/* Gemeinsame Felder mehrerer Geräte auf einmal bearbeiten: Bereich, Standort, PoE-Bedarf,
   eigene Felder und Notizen. Sind die Werte verschieden, steht „verschieden“ im Feld;
   eine Eingabe setzt den Wert in allen gewählten Geräten. */
const VERSCHIEDEN = "__verschieden";

export default function MehrfachBearbeiten({ P, devs, mutate }) {
  const ids = new Set(devs.map((g) => g.id));
  const alle = (fn) => mutate((d) => { for (const g of d.geraete) if (ids.has(g.id)) fn(g); });
  const gemeinsam = (get) => { const w = devs.map(get); return w.every((x) => x === w[0]) ? w[0] : VERSCHIEDEN; };
  const feldIds = [...new Map(devs.flatMap((g) => g.felder || []).map((f) => [f.id, f.name])).entries()];
  const katalogFrei = (P.feldKatalog || []).filter((f) => !feldIds.some(([id]) => id === f.id));
  const endgeraete = devs.filter((g) => !g.isSwitch);

  const text = (label, get, set, opts = {}) => {
    const w = gemeinsam(get);
    return (
      <Field label={label}>
        <input style={S.inputSm} list={opts.list} value={w === VERSCHIEDEN ? "" : w || ""} placeholder={w === VERSCHIEDEN ? "verschieden" : opts.placeholder || ""}
          onChange={(e) => { const v = e.target.value; alle((g) => set(g, v)); }} />
      </Field>
    );
  };

  return (
    <div>
      <div className="sp-section-label" style={{ marginTop: 16 }}>Gemeinsam bearbeiten</div>
      <div style={{ ...S.hint, marginTop: 0, marginBottom: 8 }}>Eine Eingabe gilt für alle {devs.length} Geräte. „verschieden“: die Geräte haben unterschiedliche Werte.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Bereich (Anwendung)">
          {(() => { const w = gemeinsam((g) => g.kategorie); return (
            <select style={S.selectSm} value={w} onChange={(e) => { const v = e.target.value; if (v !== VERSCHIEDEN) alle((g) => { g.kategorie = v; }); }}>
              {w === VERSCHIEDEN && <option value={VERSCHIEDEN}>verschieden</option>}
              {Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
            </select>); })()}
        </Field>
        {text("Standort / Ast", (g) => g.bereich || "", (g, v) => { g.bereich = v; }, { list: "np-bereiche-multi", placeholder: "z. B. FOH" })}
        {endgeraete.length > 0 && (() => { const w = gemeinsam((g) => (g.isSwitch ? null : g.poeBedarf || 0)); return (
          <Field label={`PoE-Bedarf (W)${endgeraete.length < devs.length ? " · nur Endgeräte" : ""}`}>
            <input type="number" min="0" style={S.inputSm} value={w === VERSCHIEDEN ? "" : w ?? ""} placeholder={w === VERSCHIEDEN ? "verschieden" : ""}
              onChange={(e) => { const v = +e.target.value || 0; alle((g) => { if (!g.isSwitch) g.poeBedarf = v; }); }} />
          </Field>); })()}
      </div>
      <datalist id="np-bereiche-multi">{P.bereiche.map((b) => <option key={b} value={b} />)}</datalist>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>Eigene Felder</span>
        {katalogFrei.length > 0 && (
          <select style={{ ...S.selectSm, width: "auto" }} value="" title="Feld aus dem Katalog in alle gewählten Geräte einfügen"
            onChange={(e) => { const f = katalogFrei.find((x) => x.id === e.target.value); if (f) alle((g) => { if (!(g.felder || []).some((x) => x.id === f.id)) g.felder = [...(g.felder || []), { id: f.id, name: f.name, wert: "" }]; }); }}>
            <option value="">+ Feld …</option>
            {katalogFrei.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>
      {!feldIds.length && <div style={{ fontSize: 12, color: MUTED }}>Keine eigenen Felder in der Auswahl.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {feldIds.map(([id, name]) => {
          const hat = devs.filter((g) => (g.felder || []).some((f) => f.id === id)).length;
          return text(`${name}${hat < devs.length ? ` (${hat}/${devs.length})` : ""}`,
            (g) => (g.felder || []).find((f) => f.id === id)?.wert || "",
            (g, v) => { g.felder = g.felder || []; const f = g.felder.find((x) => x.id === id); if (f) f.wert = v; else g.felder.push({ id, name, wert: v }); });
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        {(() => { const w = gemeinsam((g) => g.notizen || ""); return (
          <Field label="Notizen">
            <textarea rows={3} style={{ ...S.inputSm, resize: "vertical", fontFamily: "inherit" }} value={w === VERSCHIEDEN ? "" : w} placeholder={w === VERSCHIEDEN ? "verschieden (Eingabe ersetzt alle)" : ""}
              onChange={(e) => { const v = e.target.value; alle((g) => { g.notizen = v; }); }} />
          </Field>); })()}
      </div>
    </div>
  );
}
