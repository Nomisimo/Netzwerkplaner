import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, INFO } from "../../shared/constants.js";
import { newVlan, standardVlans } from "../../shared/model.js";
import { Section, Field, Toggle, SevBadge } from "../ui.jsx";

function VlanRow({ v, P, mutate, issues, count }) {
  const [open, setOpen] = useState(false);
  const upd = (fn) => mutate((d) => fn(d.vlans.find((x) => x.id === v.id)));
  const iss = issues.filter((i) => i.vlan === v.id);
  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${v.farbe}` }}>
      <div style={S.cardHead} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16, width: 44, color: v.farbe }}>{v.vid}</span>
          <div style={{ minWidth: 0 }}>
            <div style={S.cardTitle}>{v.name || "(ohne Name)"}</div>
            {v.zweck && <div style={S.cardSub}>{v.zweck}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {v.igmp && <span style={S.chip}>IGMP</span>}
          {v.eeeAus && <span style={S.chip}>EEE aus</span>}
          {v.qos && <span style={S.chip}>QoS</span>}
          {v.dhcp?.aktiv && <span style={S.chip}>DHCP</span>}
          <span style={{ ...S.chip, color: SUB }}>{count} IPs</span>
          {iss.some((i) => i.sev === "error") && <span style={{ color: ERR }}>⚠</span>}
          {!iss.some((i) => i.sev === "error") && iss.some((i) => i.sev === "warn") && <span style={{ color: WARN }}>⚠</span>}
          <span style={{ color: MUTED }}>{open ? "▴" : "▾"}</span>
        </div>
      </div>
      {open && (
        <div style={S.cardBody}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <Field label="VLAN-ID"><input type="number" min="1" max="4094" style={S.inputSm} value={v.vid} onChange={(e) => upd((x) => (x.vid = +e.target.value))} /></Field>
            <Field label="Name"><input style={S.inputSm} value={v.name} onChange={(e) => upd((x) => (x.name = e.target.value))} /></Field>
            <Field label="Farbe"><input type="color" style={{ ...S.inputSm, padding: 2, height: 31 }} value={v.farbe} onChange={(e) => upd((x) => (x.farbe = e.target.value))} /></Field>
          </div>
          <Field label="Zweck / Protokolle" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.zweck} onChange={(e) => upd((x) => (x.zweck = e.target.value))} /></Field>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Toggle checked={v.igmp} onChange={(b) => upd((x) => (x.igmp = b))} label="IGMP-Snooping" />
            <Toggle checked={v.eeeAus} onChange={(b) => upd((x) => (x.eeeAus = b))} label="EEE (802.3az) aus" />
            <Toggle checked={v.qos} onChange={(b) => upd((x) => (x.qos = b))} label="QoS / DSCP aktiv" />
            <Toggle checked={v.dhcp?.aktiv} onChange={(b) => upd((x) => (x.dhcp = { ...x.dhcp, aktiv: b }))} label="DHCP" />
          </div>
          <Field label="Notiz" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.notiz} onChange={(e) => upd((x) => (x.notiz = e.target.value))} /></Field>
          {iss.map((i, n) => <div key={n} style={{ fontSize: 11, marginTop: 6, display: "flex", gap: 6 }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
          <button style={{ ...S.dangerBtnWide, marginTop: 12 }} onClick={() => {
            if (!confirm(`VLAN ${v.vid} löschen? Interfaces und Ports verlieren die Zuordnung.`)) return;
            mutate((d) => {
              d.vlans = d.vlans.filter((x) => x.id !== v.id);
              for (const g of d.geraete) {
                g.interfaces.forEach((i) => { if (i.vlan === v.id) i.vlan = null; });
                g.ports.forEach((p) => { if (p.vlan === v.id) p.vlan = null; p.vlans = (p.vlans || []).filter((x) => x !== v.id); });
              }
            });
          }}>🗑 VLAN löschen</button>
        </div>
      )}
    </div>
  );
}

export default function VlanTab({ P, X, mutate, issues, onSelectDevice }) {
  const counts = useMemo(() => Object.fromEntries(P.vlans.map((v) => [v.id, P.geraete.reduce((s, d) => s + d.interfaces.filter((i) => i.vlan === v.id && i.ip).length, 0)])), [P]);
  const sorted = [...P.vlans].sort((a, b) => a.vid - b.vid);
  return (
    <>
      <Section title="VLANs" subtitle="ID, Name und Switch-Einstellungen je VLAN. Die Prüfung meldet fehlendes IGMP bei Multicast-Protokollen (sACN, Dante-Multicast, MA-Net3, NDI …) und eingeschaltetes EEE bei Audio over IP."
        right={<div style={{ display: "flex", gap: 6 }}>
          <button style={S.secondaryBtn} onClick={() => mutate((d) => {
            const have = new Set(d.vlans.map((v) => +v.vid));
            d.vlans.push(...standardVlans().filter((v) => !have.has(+v.vid)));
          })} title="Fehlende Standard-VLANs aus der Protokollrecherche ergänzen">+ Standard-VLANs</button>
          <button style={S.primaryBtn} onClick={() => mutate((d) => {
            const vid = Math.max(0, ...d.vlans.map((v) => +v.vid)) + 1;
            d.vlans.push(newVlan({ vid, name: `VLAN ${vid}`, farbe: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"), subnetz: vid < 256 ? `10.10.${vid}.0/24` : "" }));
          })}>+ VLAN</button>
        </div>}>
        {sorted.length === 0 && <p style={S.empty}>Keine VLANs angelegt.</p>}
        {sorted.map((v) => <VlanRow key={v.id} v={v} P={P} mutate={mutate} issues={issues} count={counts[v.id]} />)}
      </Section>

    </>
  );
}
