import React, { useState } from "react";
import { S, LINE, SUB, MUTED, ACCENT } from "../shared/constants.js";
import { KERN, KERN_BY_ID, defaultParams, streamRate, streamVorschlag } from "../shared/kernprotokolle.js";
import { newStream, streamVlans, fmtMbit } from "../shared/analyse.js";
import { Toggle, VlanChip } from "./ui.jsx";
import { ipPorts } from "../shared/catalog.js";

// Eingabefeld für einen Protokollparameter
export function ParamInput({ p, value, onChange, small = true }) {
  const st = small ? S.inputSm : S.input;
  if (p.type === "select") return (
    <select style={{ ...(small ? S.selectSm : S.select) }} value={value} onChange={(e) => onChange(typeof p.options[0] === "number" ? +e.target.value : e.target.value)}>
      {p.options.map((o) => <option key={o} value={o}>{p.labels?.[o] || o}</option>)}
    </select>
  );
  if (p.type === "bool") return <Toggle checked={!!value} onChange={onChange} label={p.label} />;
  return <input type="number" style={st} value={value} min={0} onChange={(e) => onChange(+e.target.value)} />;
}

function ZielePicker({ P, dev, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = new Set(value || []);
  const cand = P.geraete.filter((d) => d.id !== dev.id && !d.isSwitch && (!q || d.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const label = sel.size ? `${sel.size} Ziel${sel.size > 1 ? "e" : ""}` : "offen";
  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...S.smallBtn, width: "100%", textAlign: "left" }} title={[...sel].map((id) => P.geraete.find((d) => d.id === id)?.name).filter(Boolean).join("\n") || "Keine Empfänger festgelegt: Worst Case (alles Richtung Core)"} onClick={() => setOpen((o) => !o)}>{label} ▾</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 40, top: "100%", right: 0, background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: 8, width: 240, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }} onMouseLeave={() => setOpen(false)}>
          <input autoFocus style={{ ...S.inputSm, marginBottom: 6 }} placeholder="Empfänger suchen" value={q} onChange={(e) => setQ(e.target.value)} />
          {cand.map((d) => (
            <div key={d.id} style={{ padding: "2px 0" }}>
              <Toggle checked={sel.has(d.id)} label={d.name} onChange={(c) => onChange(c ? [...sel, d.id] : [...sel].filter((x) => x !== d.id))} />
            </div>
          ))}
          {sel.size > 0 && <button style={{ ...S.smallBtn, marginTop: 6 }} onClick={() => onChange([])}>alle entfernen</button>}
        </div>
      )}
    </div>
  );
}

export default function StroemeEditor({ P, X, dev, upd, onShowKern }) {
  const list = dev.stroeme || [];
  const vorschlag = streamVorschlag(dev);
  const set = (n, fn) => upd((g) => { g.stroeme = g.stroeme || []; fn(g.stroeme[n]); });
  const summe = list.reduce((a, s) => a + (streamRate(s).mbit || 0), 0);

  return (
    <div>
      {list.length === 0 ? (
        <p style={{ ...S.hint, margin: "0 0 6px" }}>Keine Datenströme. Ströme beschreiben, was dieses Gerät sendet (Dante-Kanäle, Universen, NDI-Quellen …). Daraus berechnet der Analyse-Tab Leitungslast und Multicast.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...S.table, marginTop: 0 }}>
            <thead><tr>
              <th style={S.th}>Protokoll</th><th style={S.th}>Menge</th><th style={S.th}>Parameter</th><th style={S.th}>Netz</th><th style={S.th}>Empfänger</th><th style={{ ...S.th, textAlign: "right" }}>Last</th><th style={S.th}></th>
            </tr></thead>
            <tbody>
              {list.map((s, n) => {
                const k = KERN_BY_ID[s.proto];
                const r = streamRate(s);
                const par = { ...defaultParams(s.proto), ...(s.param || {}) };
                const vl = streamVlans(dev, s).map((id) => X.vlanById.get(id)).filter(Boolean);
                const mediaIfs = ipPorts(dev).filter((i) => i.vlan);
                return (
                  <tr key={s.id}>
                    <td style={{ ...S.td, minWidth: 110 }}>
                      <select style={{ ...S.selectSm, borderColor: (k?.farbe || LINE) + "aa" }} value={s.proto}
                        onChange={(e) => set(n, (x) => { x.proto = e.target.value; x.param = {}; x.menge = KERN_BY_ID[e.target.value].menge; })}>
                        {KERN.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                      </select>
                    </td>
                    <td style={{ ...S.td, width: 92 }}>
                      <input type="number" min={0} style={S.inputSm} value={s.menge} onChange={(e) => set(n, (x) => (x.menge = +e.target.value))} title={k?.einheit} />
                      <div style={{ fontSize: 10, color: MUTED }}>{k?.einheit}</div>
                    </td>
                    <td style={{ ...S.td, minWidth: 150 }}>
                      <div style={{ display: "grid", gap: 3 }}>
                        {(k?.params || []).filter((p) => !["proFlow", "pps", "bytes"].includes(p.key) || s.proto === "osc").map((p) => (
                          <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: SUB }}>
                            {p.type !== "bool" && <span style={{ minWidth: 58 }}>{p.label.replace(/\s*\(.*\)/, "")}</span>}
                            <ParamInput p={p} value={par[p.key]} onChange={(v) => set(n, (x) => (x.param = { ...(x.param || {}), [p.key]: v }))} />
                          </label>
                        ))}
                        {(s.proto === "dante" || s.proto === "ndi") && <Toggle checked={!!s.mc} onChange={(c) => set(n, (x) => (x.mc = c))} label="Multicast" />}
                      </div>
                    </td>
                    <td style={{ ...S.td, minWidth: 100 }}>
                      <select style={S.selectSm} value={s.iface || ""} onChange={(e) => set(n, (x) => (x.iface = e.target.value || null))}>
                        <option value="">automatisch</option>
                        {mediaIfs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>{vl.map((v) => <VlanChip key={v.id} v={v} small />)}</div>
                    </td>
                    <td style={{ ...S.td, width: 90 }}><ZielePicker P={P} dev={dev} value={s.ziele} onChange={(z) => set(n, (x) => (x.ziele = z))} /></td>
                    <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }} title={r.hinweis}>
                      {fmtMbit(r.mbit || 0)}
                      {vl.length > 1 && <div style={{ fontSize: 10, color: MUTED }}>je Netz</div>}
                    </td>
                    <td style={{ ...S.td, width: 28 }}>
                      <button style={{ ...S.dangerBtn, padding: "1px 6px" }} title="Strom löschen" onClick={() => upd((g) => g.stroeme.splice(n, 1))}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <select style={{ ...S.selectSm, width: "auto" }} value="" onChange={(e) => e.target.value && upd((g) => { g.stroeme = [...(g.stroeme || []), newStream({ proto: e.target.value, menge: KERN_BY_ID[e.target.value].menge })]; })}>
          <option value="">+ Datenstrom …</option>
          {KERN.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        {vorschlag.length > 0 && list.length === 0 && (
          <button style={S.smallBtn} title={vorschlag.map((v) => `${KERN_BY_ID[v.proto].name}: ${v.menge} ${KERN_BY_ID[v.proto].einheit}`).join("\n")}
            onClick={() => upd((g) => { g.stroeme = vorschlag.map((v) => newStream(v)); })}>⟳ Vorschlag aus Protokollen</button>
        )}
        <span style={{ flex: 1 }} />
        {list.length > 0 && <span style={{ fontSize: 12, color: SUB }}>Summe <b style={{ color: ACCENT, fontFamily: "monospace" }}>{fmtMbit(summe)}</b></span>}
      </div>
      <div style={{ ...S.hint, marginTop: 6 }}>Empfänger „offen“ bedeutet Worst Case: der Strom läuft bis zum Core. Mit Empfängern rechnet die Analyse den echten Weg.</div>
    </div>
  );
}
