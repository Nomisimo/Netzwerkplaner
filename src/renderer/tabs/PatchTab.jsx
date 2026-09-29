import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, KABEL } from "../../shared/constants.js";
import { connVlan, otherEnd, isP2PConn, kabelLabel } from "../../shared/model.js";
import { Section, VlanChip } from "../ui.jsx";

export default function PatchTab({ P, X, mutate, issues, onSelectDevice, onDeleteConn }) {
  const [mode, setMode] = useState("switch");
  const connIss = (id) => issues.filter((i) => i.conn === id);
  const updC = (id, fn) => mutate((d) => fn(d.verbindungen.find((c) => c.id === id)));

  const sum = {};
  for (const c of P.verbindungen) {
    const k = c.kabel || "cat6";
    sum[k] = sum[k] || { n: 0, m: 0, ohne: 0 };
    sum[k].n++; sum[k].m += +c.laenge || 0; if (!+c.laenge) sum[k].ohne++;
  }

  const CableCells = ({ c }) => <>
    <td style={{ ...S.td, width: 150 }}>
      <select style={{ ...S.selectSm, padding: "3px 4px" }} value={c.kabel} onChange={(e) => updC(c.id, (x) => (x.kabel = e.target.value))}>
        {Object.entries(KABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </td>
    <td style={{ ...S.td, width: 70 }}><input type="number" min="0" style={{ ...S.inputSm, padding: "3px 5px" }} value={c.laenge} onChange={(e) => updC(c.id, (x) => (x.laenge = e.target.value))} /></td>
    <td style={{ ...S.td, width: 130 }}><input style={{ ...S.inputSm, padding: "3px 5px" }} value={c.label} placeholder="Label" onChange={(e) => updC(c.id, (x) => (x.label = e.target.value))} /></td>
  </>;
  const IssCell = ({ c }) => {
    const iss = connIss(c.id);
    if (!iss.length) return <td style={S.td}></td>;
    const col = iss.some((i) => i.sev === "error") ? ERR : iss.some((i) => i.sev === "warn") ? WARN : SUB;
    return <td style={{ ...S.td, color: col, cursor: "help" }} title={iss.map((i) => i.msg).join("\n")}>⚠ {iss.length}</td>;
  };
  const Dev = ({ id, port }) => {
    const r = X.portRef.get(`${id}:${port}`);
    if (!r) return <span style={{ color: ERR }}>?</span>;
    return <span><a style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => onSelectDevice(id)}>{r.dev.name}</a> <span style={{ color: MUTED }}>[{r.port.name}]</span></span>;
  };

  const switches = P.geraete.filter((d) => d.isSwitch).sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));

  return (
    <>
      <Section title="Kabel" subtitle="Summen je Kabeltyp aus der Patchliste (Länge in m, soweit eingetragen).">
        {Object.keys(sum).length === 0 ? <p style={S.empty}>Noch keine Verbindungen.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
            {Object.entries(sum).map(([k, s]) => (
              <div key={k} style={{ background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>{kabelLabel(k)}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{s.n}× <span style={{ fontSize: 14, color: SUB }}>{s.m} m</span></div>
                {s.ohne > 0 && <div style={{ fontSize: 10, color: MUTED }}>{s.ohne} ohne Längenangabe</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Patchliste" right={
        <div style={S.boxTabs}>
          {[["switch", "Nach Switch"], ["alle", "Alle Verbindungen"]].map(([k, l]) => <button key={k} style={{ ...S.boxTab, ...(mode === k ? S.boxTabActive : {}) }} onClick={() => setMode(k)}>{l}</button>)}
        </div>}>
        {mode === "switch" && (switches.length === 0 ? <p style={S.empty}>Noch keine Switches im Projekt.</p> : switches.map((sw) => (
          <div key={sw.id} style={{ marginBottom: 22 }}>
            <h3 style={{ ...S.h3, display: "flex", gap: 8, alignItems: "baseline" }}>
              <a style={{ cursor: "pointer" }} onClick={() => onSelectDevice(sw.id)}>{sw.name}</a>
              <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>{sw.hersteller} {sw.modell} · {sw.bereich}</span>
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...S.table, marginTop: 4 }}>
                <thead><tr>
                  <th style={S.th}>Port</th><th style={S.th}>Typ</th><th style={S.th}>Modus / VLAN</th><th style={S.th}>PoE</th><th style={S.th}>Gegenstelle</th>
                  <th style={S.th}>Kabel</th><th style={S.th}>m</th><th style={S.th}>Label</th><th style={S.th}></th><th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {sw.ports.map((p) => {
                    const cs = X.connsByPort.get(`${sw.id}:${p.id}`) || [];
                    const vl = p.modus === "trunk" ? (p.vlans || []).map((id) => X.vlanById.get(id)).filter(Boolean).sort((a, b) => a.vid - b.vid) : [X.vlanById.get(p.vlan)].filter(Boolean);
                    const base = (
                      <>
                        <td style={{ ...S.td, fontWeight: 700 }}>{p.name}</td>
                        <td style={{ ...S.td, fontSize: 12 }}>{p.typ}</td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                            {sw.typ !== "switch_unmanaged" && <span style={{ fontSize: 10, color: SUB, textTransform: "uppercase" }}>{p.modus === "trunk" ? "Trunk" : "Access"}</span>}
                            {vl.length ? vl.map((v) => <VlanChip key={v.id} v={v} small />) : <span style={{ color: MUTED, fontSize: 11 }}>{sw.typ === "switch_unmanaged" ? "unmanaged" : "default"}</span>}
                          </div>
                        </td>
                        <td style={{ ...S.td, fontSize: 12 }}>{p.poe ? "✓" : ""}</td>
                      </>
                    );
                    if (!cs.length) return <tr key={p.id} style={{ opacity: 0.55 }}>{base}<td style={{ ...S.td, color: MUTED }} colSpan="6">frei</td></tr>;
                    return cs.map((c, n) => {
                      const o = otherEnd(c, sw.id);
                      return (
                        <tr key={p.id + c.id} style={{ background: cs.length > 1 ? ERR + "18" : isP2PConn(c, X) ? ERR + "10" : undefined }}>
                          {n === 0 ? base : <td colSpan="4" style={S.td}></td>}
                          <td style={S.td}><Dev id={o.dev} port={o.port} /></td>
                          <CableCells c={c} /><IssCell c={c} />
                          <td style={S.td}><button style={{ ...S.dangerBtn, padding: "1px 6px" }} onClick={() => onDeleteConn(c.id)}>✕</button></td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )))}

        {mode === "alle" && (P.verbindungen.length === 0 ? <p style={S.empty}>Noch keine Verbindungen. In der Topologie mit dem Werkzeug „Verbinden“ von Gerät zu Gerät ziehen.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>#</th><th style={S.th}>Von</th><th style={S.th}>Nach</th><th style={S.th}>VLAN</th><th style={S.th}>Kabel</th><th style={S.th}>m</th><th style={S.th}>Label</th><th style={S.th}></th><th style={S.th}></th></tr></thead>
              <tbody>
                {P.verbindungen.map((c, i) => {
                  const cv = connVlan(c, X);
                  return (
                    <tr key={c.id}>
                      <td style={{ ...S.td, color: MUTED }}>{i + 1}</td>
                      <td style={S.td}><Dev id={c.a.dev} port={c.a.port} /></td>
                      <td style={S.td}><Dev id={c.b.dev} port={c.b.port} /></td>
                      <td style={S.td}><div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{cv.kind === "trunk" && <span style={{ fontSize: 10, color: SUB }}>TRUNK</span>}{cv.vlans.map((id) => <VlanChip key={id} v={X.vlanById.get(id)} small />)}</div></td>
                      <CableCells c={c} /><IssCell c={c} />
                      <td style={S.td}><button style={{ ...S.dangerBtn, padding: "1px 6px" }} onClick={() => onDeleteConn(c.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </Section>
    </>
  );
}
