import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, INFO, VLAN_FARBEN } from "../../shared/constants.js";
import { newVlan } from "../../shared/model.js";
import { Section, Field, Toggle, SevBadge } from "../ui.jsx";
import { vlanBaum, vlanPfad, aeusseresVlan, istSvlan, moeglicheAeussere } from "../../shared/qinq.js";
import { ipPorts } from "../../shared/catalog.js";
import { CornerDownRight, TriangleAlert, ChevronUp, ChevronDown, Trash2 } from "lucide-react";

function VlanRow({ v, P, mutate, issues, count, tiefe = 0 }) {
  const [open, setOpen] = useState(false);
  const upd = (fn) => mutate((d) => fn(d.vlans.find((x) => x.id === v.id)));
  const iss = issues.filter((i) => i.vlan === v.id || i.vlans?.includes(v.id));
  const aussen = aeusseresVlan(v, P.vlans);
  const sv = istSvlan(v, P.vlans);
  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${v.farbe}`, marginLeft: tiefe * 28 }}>
      <div style={S.cardHead} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {tiefe > 0 && <span style={{ color: MUTED, marginLeft: -6, display: "inline-flex" }} title="Inneres VLAN (C-VLAN) im äußeren VLAN darüber"><CornerDownRight size={14} /></span>}
          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 44, textAlign: "center", color: "#fff", background: v.farbe + "33", border: `1px solid ${v.farbe}`, borderRadius: 6, padding: "1px 6px" }} title={aussen ? `VLAN-ID ${v.vid} · Tags: ${vlanPfad(v, P.vlans)} (außen › innen)` : `VLAN-ID ${v.vid}`}>{v.vid}</span>
          <div style={{ minWidth: 0 }}>
            <div style={S.cardTitle}>{v.name || "(ohne Name)"}</div>
            {v.zweck && <div style={S.cardSub}>{v.zweck}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {sv && <span style={{ ...S.chip, borderColor: ACCENT, color: ACCENT }} title="Äußeres VLAN (Service-Tag, IEEE 802.1ad)">S-VLAN</span>}
          {aussen && <span style={{ ...S.chip, color: SUB }} title="Inneres VLAN (Customer-Tag) im äußeren VLAN">in S-VLAN {aussen.vid}</span>}
          {v.igmp && <span style={S.chip}>IGMP</span>}
          {v.eeeAus && <span style={S.chip}>EEE aus</span>}
          {v.qos && <span style={S.chip}>QoS</span>}
          {v.dhcp?.aktiv && <span style={S.chip}>DHCP</span>}
          <span style={{ ...S.chip, color: SUB }}>{count} IPs</span>
          {(() => {
            // Warndreieck nur, wenn die Prüfung für dieses VLAN etwas meldet; der Grund steht im Tooltip und aufgeklappt unten
            const w = iss.filter((i) => i.sev === "error" || i.sev === "warn");
            if (!w.length) return null;
            const err = w.some((i) => i.sev === "error");
            return <span style={{ color: err ? ERR : WARN, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }} title={w.map((i) => "• " + i.msg).join("\n")}><TriangleAlert size={13} /> {w.length}</span>;
          })()}
          <span style={{ color: MUTED, display: "inline-flex" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </div>
      {open && (
        <div style={S.cardBody}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <Field label="VLAN-ID"><input type="number" min="1" max="4094" style={S.inputSm} value={v.vid} onChange={(e) => upd((x) => (x.vid = +e.target.value))} /></Field>
            <Field label="Name"><input style={S.inputSm} value={v.name} onChange={(e) => upd((x) => (x.name = e.target.value))} /></Field>
            <Field label="Farbe"><input type="color" style={{ ...S.inputSm, padding: 2, height: 31 }} value={v.farbe} onChange={(e) => upd((x) => (x.farbe = e.target.value))} /></Field>
          </div>
          <Field label="Äußeres VLAN (QinQ, IEEE 802.1ad)" style={{ marginTop: 10 }}>
            <select style={S.selectSm} value={v.svlan || ""} onChange={(e) => upd((x) => (x.svlan = e.target.value || null))}>
              <option value="">– keins, normales VLAN –</option>
              {moeglicheAeussere(v, P.vlans).sort((a, b) => a.vid - b.vid).map((o) => <option key={o.id} value={o.id}>{vlanPfad(o, P.vlans)} · {o.name}</option>)}
            </select>
            <div style={{ ...S.hint, marginTop: 4 }}>Läuft dieses VLAN als inneres C-VLAN in einem S-VLAN, darf seine ID auch in anderen S-VLANs vorkommen. Die Switches müssen dafür QinQ können.</div>
          </Field>
          <Field label="Zweck / Protokolle" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.zweck} onChange={(e) => upd((x) => (x.zweck = e.target.value))} /></Field>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Toggle checked={v.igmp} onChange={(b) => upd((x) => (x.igmp = b))} label="IGMP-Snooping" />
            <Toggle checked={v.eeeAus} onChange={(b) => upd((x) => (x.eeeAus = b))} label="EEE (802.3az) aus" />
            <Toggle checked={v.qos} onChange={(b) => upd((x) => (x.qos = b))} label="QoS / DSCP aktiv" />
            <Toggle checked={v.dhcp?.aktiv} onChange={(b) => upd((x) => (x.dhcp = { ...x.dhcp, aktiv: b }))} label="DHCP" />
          </div>
          <Field label="Notiz" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.notiz} onChange={(e) => upd((x) => (x.notiz = e.target.value))} /></Field>
          {iss.map((i, n) => <div key={n} style={{ fontSize: 11, marginTop: 6, display: "flex", gap: 6 }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
          <button style={{ ...S.dangerBtnWide, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => {
            if (!confirm(`VLAN ${v.vid} löschen? Ports verlieren die Zuordnung.`)) return;
            mutate((d) => {
              d.vlans = d.vlans.filter((x) => x.id !== v.id);
              d.vlans.forEach((x) => { if (x.svlan === v.id) x.svlan = null; });
              for (const g of d.geraete) {
                g.ports.forEach((p) => { if (p.vlan === v.id) p.vlan = null; p.vlans = (p.vlans || []).filter((x) => x !== v.id); });
              }
            });
          }}><Trash2 size={14} /> VLAN löschen</button>
        </div>
      )}
    </div>
  );
}

export default function VlanTab({ P, X, mutate, issues, onSelectDevice }) {
  const counts = useMemo(() => Object.fromEntries(P.vlans.map((v) => [v.id, P.geraete.reduce((s, d) => s + ipPorts(d).filter((i) => i.vlan === v.id && i.ip).length, 0)])), [P]);
  const baum = useMemo(() => vlanBaum(P.vlans), [P.vlans]);
  return (
    <>
      <Section title="VLANs" subtitle={<>ID, Name und Switch-Einstellungen je VLAN. <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> erscheint nur, wenn Geräte im VLAN es verlangen: Multicast-Protokolle (sACN, Dante-Multicast, MA-Net3, NDI …) ohne IGMP-Snooping, Audio over IP ohne „EEE aus“, doppelte IDs oder QinQ-Fehler. Ein leeres VLAN hat keine Warnung. Maus auf <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> zeigt den Grund.</>}
        right={<div style={{ display: "flex", gap: 6 }}>
          <button style={S.primaryBtn} onClick={() => mutate((d) => {
            const vid = Math.max(0, ...d.vlans.map((v) => +v.vid)) + 1;
            d.vlans.push(newVlan({ vid, name: `VLAN ${vid}`, farbe: VLAN_FARBEN[d.vlans.length % VLAN_FARBEN.length], subnetz: vid < 256 ? `10.10.${vid}.0/24` : "" }));
          })}>+ VLAN</button>
        </div>}>
        {baum.length === 0 && <p style={S.empty}>Keine VLANs angelegt.</p>}
        {baum.map(({ v, tiefe }) => <VlanRow key={v.id} v={v} tiefe={tiefe} P={P} mutate={mutate} issues={issues} count={counts[v.id]} />)}
      </Section>

    </>
  );
}
