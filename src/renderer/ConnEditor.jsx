import React from "react";
import { S, KABEL, MUTED, ERR } from "../shared/constants.js";
import { connVlan, isP2PConn } from "../shared/model.js";
import { Field, VlanChip, SevBadge } from "./ui.jsx";

export default function ConnEditor({ P, X, conn, mutate, onDelete, onSelectDevice, issues = [] }) {
  const upd = (fn) => mutate((d) => fn(d.verbindungen.find((c) => c.id === conn.id)));
  const cv = connVlan(conn, X);
  const End = ({ end, k }) => {
    const dev = X.devById.get(end.dev);
    if (!dev) return <div style={{ color: ERR }}>Gerät fehlt</div>;
    const usedHere = (pid) => (X.connsByPort.get(`${dev.id}:${pid}`) || []).some((c) => c.id !== conn.id);
    return (
      <div style={{ border: "1px solid #3a424c", borderRadius: 7, padding: 10, background: "#1f242b" }}>
        <a style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => onSelectDevice && onSelectDevice(dev.id)}>{dev.name}</a>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{dev.hersteller} {dev.modell}</div>
        <Field label="Port">
          <select style={S.selectSm} value={end.port} onChange={(e) => upd((c) => (c[k].port = e.target.value))}>
            {dev.ports.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.typ}{p.p2p ? " · P2P" : ""}{usedHere(p.id) ? " (belegt)" : ""}</option>)}
          </select>
        </Field>
      </div>
    );
  };
  return (
    <div>
      <div className="sp-section-label">Verbindung</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <End end={conn.a} k="a" />
        <div style={{ textAlign: "center", color: MUTED }}>⇅</div>
        <End end={conn.b} k="b" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <Field label="Kabel">
          <select style={S.selectSm} value={conn.kabel} onChange={(e) => upd((c) => (c.kabel = e.target.value))}>
            {Object.entries(KABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Länge (m)"><input type="number" min="0" style={S.inputSm} value={conn.laenge} onChange={(e) => upd((c) => (c.laenge = e.target.value))} /></Field>
        <Field label="Kabelbezeichnung" style={{ gridColumn: "1 / -1" }}><input style={S.inputSm} value={conn.label} placeholder="z. B. NET-FOH-01" onChange={(e) => upd((c) => (c.label = e.target.value))} /></Field>
        <Field label="Notiz" style={{ gridColumn: "1 / -1" }}><input style={S.inputSm} value={conn.notiz || ""} onChange={(e) => upd((c) => (c.notiz = e.target.value))} /></Field>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: MUTED }}>{cv.kind === "trunk" ? "Trunk:" : "VLAN:"}</span>
        {cv.vlans.length ? cv.vlans.map((id) => <VlanChip key={id} v={X.vlanById.get(id)} small={cv.vlans.length > 2} />) : <span style={{ color: MUTED }}>nicht festgelegt</span>}
        {isP2PConn(conn, X) && <span style={{ ...S.chip, borderColor: ERR }}>⛓ Punkt-zu-Punkt</span>}
      </div>
      {issues.map((i, n) => <div key={n} style={{ fontSize: 11, marginTop: 6, display: "flex", gap: 6 }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
      <button style={{ ...S.dangerBtnWide, marginTop: 14 }} onClick={() => onDelete(conn.id)}>🗑 Verbindung löschen</button>
    </div>
  );
}
