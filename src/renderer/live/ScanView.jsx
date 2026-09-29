import React, { useState, useMemo, useEffect } from "react";
import { S, OK, ERR, WARN, INFO, MUTED, SUB } from "../../shared/constants.js";
import { compareScan, scanTargets } from "../../shared/live.js";
import { inSubnet } from "../../shared/net.js";
import { createDevice, newIface } from "../../shared/catalog.js";
import { useMonitor } from "./store.js";
import { Table, td, Hint, Empty, Pill, mono } from "./common.jsx";

const STATUS = {
  ok: { label: "wie geplant", color: OK },
  offline: { label: "geplant, nicht gefunden", color: ERR },
  unbekannt: { label: "nicht im Plan", color: INFO },
  mac: { label: "MAC weicht ab", color: WARN },
  verschoben: { label: "andere IP als geplant", color: WARN },
};

export default function ScanView({ P, mutate, iface, interfaces, onSelectDevice, notify }) {
  const mon = useMonitor("scan");
  const snap = mon.snapshot;
  const targets = useMemo(() => {
    const t = scanTargets(P);
    for (const i of interfaces) if (!t.some((x) => x.cidr === i.cidr) && i.prefix >= 22) t.push({ cidr: i.cidr, label: `eigenes Netz (${i.name})` });
    return t;
  }, [P, interfaces]);
  const [cidr, setCidr] = useState(() => snap?.cidr || "");
  const [ports, setPorts] = useState("80, 443, 8080, 22, 23, 4440, 5959, 30021, 49280, 161");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (cidr) return;
    const own = interfaces.find((i) => i.address === iface) || interfaces[0];
    setCidr(snap?.cidr || targets.find((t) => own && inSubnet(own.address, t.cidr))?.cidr || targets[0]?.cidr || "");
  }, [targets, interfaces]);

  const run = () => mon.action("scan", { cidr: cidr.trim(), ports: ports.split(/[,; ]+/).map(Number).filter((p) => p > 0 && p < 65536) });
  const cmp = useMemo(() => (snap?.hosts ? compareScan(P, snap.hosts, snap.cidr) : null), [P, snap?.hosts, snap?.cidr]);
  const rows = cmp ? cmp.rows.filter((r) => !filter || r.status === filter) : [];

  const uebernehmen = (h) => {
    mutate((d) => {
      const dev = createDevice({ typ: "sonstiges", vlans: d.vlans, name: (h.name || "").split(".")[0] || `Gerät ${h.ip}` });
      let ifc = dev.interfaces[0];
      if (!ifc) { ifc = newIface(); dev.interfaces.push(ifc); }
      ifc.ip = h.ip; ifc.mac = h.mac || "";
      const v = d.vlans.find((v) => v.subnetz && inSubnet(h.ip, v.subnetz));
      if (v) ifc.vlan = v.id;
      d.geraete.push(dev);
    });
    notify?.(`${h.ip} als Gerät in den Plan übernommen.`);
  };

  const pct = snap?.progress?.total ? Math.round((snap.progress.done / snap.progress.total) * 100) : 0;
  return (
    <div>
      <div style={{ ...S.row, alignItems: "flex-end" }}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Subnetz</span>
          <input list="np-scan-targets" style={{ ...S.input, width: 200 }} value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24" />
          <datalist id="np-scan-targets">{targets.map((t) => <option key={t.cidr} value={t.cidr}>{t.label}</option>)}</datalist>
        </label>
        <label style={{ ...S.field, flex: 1, minWidth: 240 }}>
          <span style={S.fieldLabel}>TCP-Ports prüfen</span>
          <input style={S.input} value={ports} onChange={(e) => setPorts(e.target.value)} />
        </label>
        {snap?.running
          ? <button style={S.secondaryBtn} onClick={() => mon.action("cancel")}>■ Abbrechen</button>
          : <button style={S.primaryBtn} onClick={run} disabled={!cidr.trim()}>▶ Scan starten</button>}
      </div>
      {targets.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: -6, marginBottom: 12 }}>
          {targets.map((t) => <button key={t.cidr} style={{ ...S.smallBtn, borderColor: t.farbe || undefined }} onClick={() => setCidr(t.cidr)}>{t.label} · {t.cidr}</button>)}
        </div>
      )}
      {(mon.error || snap?.err) && <div style={{ color: ERR, fontSize: 12, marginBottom: 10 }}>⛔ {mon.error || snap.err}</div>}
      {snap?.running && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 4 }}>Scanne {snap.cidr} … {snap.progress.done} / {snap.progress.total} Adressen, {snap.hosts.length} Geräte gefunden</div>
          <div style={{ height: 6, background: "#2a313a", borderRadius: 3 }}><div style={{ width: `${pct}%`, height: "100%", background: OK, borderRadius: 3 }} /></div>
        </div>
      )}
      {cmp && !snap.running && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: SUB }}>{snap.cidr}: {snap.hosts.length} Geräte, {Math.round((snap.finished - snap.started) / 100) / 10} s.</span>
          <button style={{ ...S.smallBtn, ...(filter === "" ? { borderColor: "#fff" } : {}) }} onClick={() => setFilter("")}>Alle</button>
          {Object.entries(STATUS).map(([k, s]) => cmp.count[k] > 0 && (
            <button key={k} style={{ ...S.smallBtn, color: s.color, ...(filter === k ? { borderColor: s.color } : {}) }} onClick={() => setFilter(filter === k ? "" : k)}>{s.label}: {cmp.count[k]}</button>
          ))}
        </div>
      )}
      {!cmp ? <Empty>Noch kein Scan. Subnetz wählen und „Scan starten“ drücken.</Empty> : rows.length === 0 ? <Empty>Keine Einträge.</Empty> : (
        <Table head={["Abgleich", "IP", "Gerät im Plan", "Name im Netz", "MAC", "Ping", "offene Ports", ""]}>
          {rows.map((r) => {
            const h = r.host;
            return (
              <tr key={r.status + r.ip + (h?.ip || "")}>
                <td style={td()}><Pill color={STATUS[r.status].color}>{STATUS[r.status].label}</Pill></td>
                <td style={td(mono)}>{h?.ip || r.ip}{r.status === "verschoben" && <span style={{ color: MUTED }}> (Plan: {r.ip})</span>}</td>
                <td style={td()}>{r.dev ? <a href="#" style={{ color: "#fff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(r.dev.id); }}>{r.dev.name}</a> : <span style={{ color: MUTED }}>–</span>}</td>
                <td style={td({ fontSize: 12 })}>{h?.name || (h?.self ? "dieser Rechner" : "")}</td>
                <td style={td(mono)}>{h?.mac || ""}{r.status === "mac" && <div style={{ color: WARN, fontSize: 11 }}>Plan: {r.iface.mac}</div>}</td>
                <td style={td({ fontSize: 12 })}>{!h ? "" : h.ping ? `${h.ms} ms` : h.arpOnly ? <span style={{ color: MUTED }}>nur ARP</span> : <span style={{ color: MUTED }}>blockt</span>}</td>
                <td style={td({ fontSize: 11 })}>{(h?.open || []).map((p) => <span key={p} title={snap.portNames[p] || ""} style={{ ...S.chip, marginRight: 3 }}>{p}</span>)}</td>
                <td style={td()}>{r.status === "unbekannt" && !h.self && <button style={S.smallBtn} onClick={() => uebernehmen(h)}>+ In den Plan</button>}</td>
              </tr>
            );
          })}
        </Table>
      )}
      <Hint>
        Der Scan pingt jede Adresse und probiert die angegebenen TCP-Ports, damit auch Geräte gefunden werden, die Ping blocken. MAC-Adressen stammen aus der ARP-Tabelle des Rechners und sind nur für das eigene Subnetz verfügbar.
        Gescannt werden höchstens 1024 Adressen (/22) auf einmal. Bitte nur in Netzen scannen, für die du zuständig bist.
      </Hint>
    </div>
  );
}
