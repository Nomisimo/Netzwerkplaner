import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, INFO } from "../../shared/constants.js";
import { newVlan, standardVlans, suggestIp } from "../../shared/model.js";
import { parseCidr, ip2int, int2ip, inSubnet, prefixToMaskStr, ipSort } from "../../shared/net.js";
import { Section, Field, Toggle, Dot, SevBadge } from "../ui.jsx";

function VlanRow({ v, P, mutate, issues, count }) {
  const [open, setOpen] = useState(false);
  const upd = (fn) => mutate((d) => fn(d.vlans.find((x) => x.id === v.id)));
  const c = parseCidr(v.subnetz);
  const iss = issues.filter((i) => i.vlan === v.id);
  return (
    <div style={{ ...S.card, borderLeft: `4px solid ${v.farbe}` }}>
      <div style={S.cardHead} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16, width: 44, color: v.farbe }}>{v.vid}</span>
          <div style={{ minWidth: 0 }}>
            <div style={S.cardTitle}>{v.name || "(ohne Name)"}</div>
            <div style={S.cardSub}>{v.subnetz || "kein Subnetz"}{v.gateway && ` · GW ${v.gateway}`}{v.zweck && ` · ${v.zweck}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {v.igmp && <span style={S.chip}>IGMP</span>}
          {v.eeeAus && <span style={S.chip}>EEE aus</span>}
          {v.qos && <span style={S.chip}>QoS</span>}
          {v.dhcp?.aktiv && <span style={S.chip}>DHCP</span>}
          <span style={{ ...S.chip, color: SUB }}>{count} IPs{c ? ` / ${c.hosts}` : ""}</span>
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
            <Field label="Subnetz (CIDR)" hint={c ? `Maske ${prefixToMaskStr(c.prefix)} · ${c.hosts} Hosts` : ""}><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={v.subnetz} placeholder="10.10.10.0/24" onChange={(e) => upd((x) => (x.subnetz = e.target.value.trim()))} /></Field>
            <Field label="Gateway"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={v.gateway} onChange={(e) => upd((x) => (x.gateway = e.target.value.trim()))} /></Field>
            <Field label="IGMP-Querier (Gerät/Adresse)"><input style={S.inputSm} value={v.querier} placeholder="z. B. Core-Switch" onChange={(e) => upd((x) => (x.querier = e.target.value))} /></Field>
          </div>
          <Field label="Zweck / Protokolle" style={{ marginTop: 10 }}><input style={S.inputSm} value={v.zweck} onChange={(e) => upd((x) => (x.zweck = e.target.value))} /></Field>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <Toggle checked={v.igmp} onChange={(b) => upd((x) => (x.igmp = b))} label="IGMP-Snooping + Querier" />
            <Toggle checked={v.eeeAus} onChange={(b) => upd((x) => (x.eeeAus = b))} label="EEE (802.3az) aus" />
            <Toggle checked={v.qos} onChange={(b) => upd((x) => (x.qos = b))} label="QoS / DSCP aktiv" />
            <Toggle checked={v.dhcp?.aktiv} onChange={(b) => upd((x) => (x.dhcp = { ...x.dhcp, aktiv: b }))} label="DHCP-Bereich" />
          </div>
          {v.dhcp?.aktiv && (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Field label="DHCP von"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={v.dhcp.von} placeholder={c ? int2ip(c.last - 99) : ""} onChange={(e) => upd((x) => (x.dhcp.von = e.target.value.trim()))} /></Field>
              <Field label="DHCP bis"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={v.dhcp.bis} placeholder={c ? int2ip(c.last) : ""} onChange={(e) => upd((x) => (x.dhcp.bis = e.target.value.trim()))} /></Field>
            </div>
          )}
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

function IpPlan({ P, X, v, onSelectDevice }) {
  const c = parseCidr(v.subnetz);
  const rows = useMemo(() => {
    const r = [];
    for (const d of P.geraete) for (const i of d.interfaces) {
      if (i.vlan !== v.id && !(c && i.ip && inSubnet(i.ip, c))) continue;
      r.push({ d, i, n: ip2int(i.ip) });
    }
    return r.sort((a, b) => ipSort(a.i.ip, b.i.ip));
  }, [P, v, c]);
  if (!c) return <p style={S.empty}>Für VLAN {v.vid} ist kein gültiges Subnetz eingetragen.</p>;
  const byN = new Map();
  for (const r of rows) if (r.n !== null) { if (!byN.has(r.n)) byN.set(r.n, []); byN.get(r.n).push(r); }
  const gw = ip2int(v.gateway);
  const dA = ip2int(v.dhcp?.von), dB = ip2int(v.dhcp?.bis);
  const used = [...byN.keys()].filter((n) => inSubnet(n, c)).length;
  const next = suggestIp(P, v);
  const showGrid = c.size <= 1024;
  const cells = showGrid ? Array.from({ length: c.size }, (_, k) => c.net + k) : [];
  const cellColor = (n) => {
    const o = byN.get(n);
    if (o && o.length > 1) return ERR;
    if (o) return o[0].i.vlan === v.id ? v.farbe : WARN;
    if (n === c.net || n === c.bcast) return "#0e1216";
    if (n === gw) return ACCENT;
    if (v.dhcp?.aktiv && dA !== null && dB !== null && n >= dA && n <= dB) return "#2a3b4d";
    return "#343c47";
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 14 }}>
        {[["Netz", c.cidr], ["Maske", prefixToMaskStr(c.prefix)], ["Bereich", `${int2ip(c.first)} – ${int2ip(c.last)}`], ["Belegt", `${used} / ${c.hosts}`], ["Frei", c.hosts - used], ["Nächste freie", next || "–"]].map(([l, val]) => (
          <div key={l} style={{ background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: SUB, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
      {showGrid && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(32, c.size)},1fr)`, gap: 2, maxWidth: 900 }}>
            {cells.map((n) => {
              const o = byN.get(n);
              const t = `${int2ip(n)}${n === c.net ? " · Netzadresse" : n === c.bcast ? " · Broadcast" : n === gw ? " · Gateway" : ""}${o ? " · " + o.map((r) => `${r.d.name} › ${r.i.name}`).join(", ") : ""}`;
              return <div key={n} title={t} onClick={() => o && onSelectDevice(o[0].d.id)}
                style={{ aspectRatio: "1", background: cellColor(n), borderRadius: 2, cursor: o ? "pointer" : "default", fontSize: 8, color: "#0008", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.size <= 256 && (n & 255) % 16 === 0 ? n & 255 : ""}</div>;
            })}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: SUB }}>
            {[[v.farbe, "belegt"], [ERR, "Konflikt"], [WARN, "anderes VLAN eingetragen"], [ACCENT, "Gateway"], ["#2a3b4d", "DHCP-Bereich"], ["#343c47", "frei"]].map(([col, l]) => <span key={l} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />{l}</span>)}
          </div>
        </>
      )}
      <table style={S.table}>
        <thead><tr><th style={S.th}>IP</th><th style={S.th}>Gerät</th><th style={S.th}>Interface</th><th style={S.th}>MAC</th><th style={S.th}>Standort</th><th style={S.th}>Status</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan="6" style={{ ...S.td, ...S.empty }}>Noch keine Interfaces in diesem VLAN.</td></tr>}
          {rows.map(({ d, i, n }) => {
            const dup = n !== null && byN.get(n)?.length > 1;
            const out = i.ip && !inSubnet(i.ip, c);
            const wrongVlan = i.vlan !== v.id;
            return (
              <tr key={i.id} style={{ background: dup ? ERR + "1a" : undefined, cursor: "pointer" }} onClick={() => onSelectDevice(d.id)}>
                <td style={{ ...S.td, fontFamily: "monospace" }}>{i.ip || (i.dhcp ? "DHCP" : "–")}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{d.name}</td>
                <td style={S.td}>{i.name}</td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{i.mac}</td>
                <td style={S.td}>{d.bereich}</td>
                <td style={{ ...S.td, fontSize: 11 }}>
                  {dup ? <span style={{ color: ERR }}>Konflikt</span> : out ? <span style={{ color: ERR }}>außerhalb Subnetz</span> : wrongVlan ? <span style={{ color: WARN }}>anderes VLAN</span> : !i.ip ? <span style={{ color: MUTED }}>{i.dhcp ? "DHCP" : "keine IP"}</span> : <span style={{ color: OK }}>OK</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function VlanTab({ P, X, mutate, issues, onSelectDevice }) {
  const [active, setActive] = useState(P.vlans[0]?.id || null);
  const counts = useMemo(() => Object.fromEntries(P.vlans.map((v) => [v.id, P.geraete.reduce((s, d) => s + d.interfaces.filter((i) => i.vlan === v.id && i.ip).length, 0)])), [P]);
  const sorted = [...P.vlans].sort((a, b) => a.vid - b.vid);
  const cur = P.vlans.find((v) => v.id === active) || sorted[0];
  const unassigned = P.geraete.flatMap((d) => d.interfaces.filter((i) => i.ip && !X.vlanById.get(i.vlan)).map((i) => ({ d, i })));
  return (
    <>
      <Section title="VLANs" subtitle="ID, Subnetz und Switch-Einstellungen je VLAN. Die Prüfung meldet fehlendes IGMP bei Multicast-Protokollen (sACN, Dante-Multicast, MA-Net3, NDI …) und eingeschaltetes EEE bei Audio over IP."
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

      <Section title="IP-Plan" subtitle="Belegte und freie Adressen je VLAN. Klick auf eine Adresse öffnet das Gerät.">
        <div style={S.boxTabs}>
          {sorted.map((v) => (
            <button key={v.id} style={{ ...S.boxTab, ...(cur?.id === v.id ? S.boxTabActive : {}) }} onClick={() => setActive(v.id)}>
              <Dot color={v.farbe} size={8} />{v.vid} {v.name} <span style={{ opacity: 0.7 }}>({counts[v.id]})</span>
            </button>
          ))}
        </div>
        {cur && <IpPlan P={P} X={X} v={cur} onSelectDevice={onSelectDevice} />}
        {unassigned.length > 0 && (
          <>
            <h3 style={{ ...S.h3, marginTop: 20 }}>IPs ohne VLAN</h3>
            <table style={S.table}><tbody>
              {unassigned.map(({ d, i }) => <tr key={i.id} onClick={() => onSelectDevice(d.id)} style={{ cursor: "pointer" }}><td style={{ ...S.td, fontFamily: "monospace" }}>{i.ip}/{i.prefix}</td><td style={S.td}>{d.name} › {i.name}</td></tr>)}
            </tbody></table>
          </>
        )}
      </Section>
    </>
  );
}
