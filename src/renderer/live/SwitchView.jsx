import React, { useState, useMemo } from "react";
import { S, OK, ERR, WARN, MUTED, SUB, LINE } from "../../shared/constants.js";
import { snmpSwitches, compareSwitchPorts, fmtUptime } from "../../shared/live.js";
import { useMonitor } from "./store.js";
import { Table, td, Hint, Empty, Card, Pill, Age, mono } from "./common.jsx";
import { Toggle, Dot } from "../ui.jsx";
import { Play, OctagonX, RefreshCw } from "lucide-react";

const speed = (m) => (!m ? "" : m >= 1000 ? `${m / 1000}G` : `${m}M`);

export default function SwitchView({ P, X, onSelectDevice }) {
  const mon = useMonitor("snmp");
  const s = mon.snapshot;
  const switches = useMemo(() => snmpSwitches(P), [P]);
  const [host, setHost] = useState(switches[0]?.ip || "");
  const [community, setCommunity] = useState("public");
  const vlanByVid = useMemo(() => new Map(P.vlans.map((v) => [+v.vid, v])), [P.vlans]);
  const hosts = [...new Set([...(host ? [host] : []), ...Object.keys(s?.results || {}), ...Object.keys(s?.errors || {})])];

  const query = (h = host) => h && mon.action("query", { host: h.trim(), community });
  const auto = (on) => mon.action("auto", { on, targets: hosts.map((h) => ({ host: h, community })) });

  return (
    <div>
      <div style={{ ...S.row, alignItems: "flex-end" }}>
        <label style={S.field}>
          <span style={S.fieldLabel}>Switch (Management-IP)</span>
          <input list="np-snmp-switches" style={{ ...S.input, width: 200 }} value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.99.10" />
          <datalist id="np-snmp-switches">{switches.map((x) => <option key={x.dev.id} value={x.ip}>{x.dev.name}</option>)}</datalist>
        </label>
        <label style={S.field}>
          <span style={S.fieldLabel}>Community (nur lesen)</span>
          <input style={{ ...S.input, width: 140 }} value={community} onChange={(e) => setCommunity(e.target.value)} />
        </label>
        <button style={S.primaryBtn} disabled={!host.trim()} onClick={() => query()}><Play size={12} fill="currentColor" /> Abfragen</button>
        {switches.length > 1 && <button style={S.secondaryBtn} onClick={() => switches.forEach((x) => query(x.ip))}>Alle {switches.length} Switches aus dem Plan</button>}
        <Toggle checked={s?.auto} onChange={auto} label="alle 10 s aktualisieren" />
      </div>
      {mon.error && <div style={{ color: ERR, fontSize: 12, marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 5 }}><OctagonX size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {mon.error}</div>}
      {!hosts.length && <Empty>Noch kein Switch abgefragt. Managed Switches aus dem Plan stehen in der Auswahlliste.</Empty>}
      {hosts.map((h) => {
        const r = s?.results?.[h];
        const err = s?.errors?.[h];
        const busy = s?.busy?.includes(h);
        const dev = switches.find((x) => x.ip === h)?.dev;
        const cmp = r && dev ? compareSwitchPorts(dev, X, r.ports) : r ? r.ports.map((sp) => ({ snmp: sp, istUntagged: sp.untagged?.length ? sp.untagged : sp.pvid != null ? [sp.pvid] : [], hinweise: [] })) : [];
        const probleme = cmp.filter((c) => c.hinweise.length).length;
        return (
          <Card key={h} title={<>{r?.sysName || dev?.name || h} <span style={{ ...mono, color: SUB, fontWeight: 400 }}>{h}</span></>}
            right={<>{busy && <span style={{ fontSize: 12, color: SUB }}>frage ab …</span>}{r && <Age ms={Date.now() - r.t} />}<button style={S.smallBtn} onClick={() => query(h)}><RefreshCw size={12} /></button></>}>
            {err && <div style={{ color: ERR, fontSize: 12, display: "flex", alignItems: "flex-start", gap: 5 }}><OctagonX size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {err}</div>}
            {r && (
              <>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>
                  {r.sysDescr.slice(0, 160)} · läuft seit {fmtUptime(r.uptime)}
                  {dev ? <> · im Plan: <a href="#" style={{ color: "#fff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(dev.id); }}>{dev.name}</a></> : <> · nicht als Switch im Plan</>}
                  <div style={{ marginTop: 4 }}>
                    <Pill color={r.supports.qbridge ? OK : MUTED}>VLAN-Tabelle {r.supports.qbridge ? "ja" : "nein"}</Pill>
                    <Pill color={r.supports.lldp ? OK : MUTED}>LLDP {r.supports.lldp ? "ja" : "nein"}</Pill>
                    <Pill color={r.supports.poe ? OK : MUTED}>PoE {r.supports.poe ? "ja" : "nein"}</Pill>
                    {dev && <Pill color={probleme ? WARN : OK}>{probleme ? `${probleme} Abweichungen zum Plan` : "passt zum Plan"}</Pill>}
                  </div>
                </div>
                {/* Portleiste: Füllung = VLAN-Farbe (untagged), Rahmen grün = Link */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
                  {cmp.map((c) => {
                    const v = vlanByVid.get(+c.istUntagged[0]);
                    return (
                      <div key={c.snmp.ifIndex} title={`${c.snmp.ifName || c.snmp.ifDescr}: ${c.snmp.up ? "Link" : "kein Link"}${c.istUntagged.length ? `, VLAN ${c.istUntagged.join("/")}` : ""}${c.snmp.tagged?.length ? `, tagged ${c.snmp.tagged.join(",")}` : ""}${c.hinweise.length ? `\nHinweis: ${c.hinweise.join("; ")}` : ""}`}
                        style={{ width: 26, height: 22, borderRadius: 3, background: v?.farbe || "#2a313a", border: `2px solid ${c.hinweise.length ? WARN : c.snmp.up ? OK : LINE}`, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Consolas,monospace", opacity: c.snmp.adminUp === false ? 0.4 : 1 }}>
                        {(c.snmp.ifName || String(c.snmp.ifIndex)).replace(/^\D+/, "").slice(-3)}
                      </div>
                    );
                  })}
                </div>
                {!r.ports.length ? <Empty>Keine Ethernet-Ports gemeldet.</Empty> : (
                  <Table head={["Port", "Link", "VLAN live", "VLAN Plan", "Tagged", "PoE", "LLDP-Nachbar", "Plan: verbunden mit", "Hinweis"]}>
                    {cmp.map((c) => {
                      const sp = c.snmp;
                      const vl = vlanByVid.get(+c.istUntagged[0]);
                      return (
                        <tr key={sp.ifIndex}>
                          <td style={td()}><span style={mono}>{sp.ifName || sp.ifDescr}</span>{sp.ifAlias && <div style={{ fontSize: 10, color: MUTED }}>{sp.ifAlias}</div>}</td>
                          <td style={td({ fontSize: 12, whiteSpace: "nowrap" })}><Dot color={sp.up ? OK : sp.adminUp === false ? MUTED : "#5b6570"} size={8} /> {sp.up ? speed(sp.ifHighSpeed) || "up" : sp.adminUp === false ? "aus" : "down"}</td>
                          <td style={td(mono)}>{c.istUntagged.length ? <span style={{ borderLeft: `4px solid ${vl?.farbe || MUTED}`, paddingLeft: 5 }}>{c.istUntagged.join(", ")}{vl ? ` ${vl.name}` : ""}</span> : "–"}</td>
                          <td style={td(mono)}>{c.plan ? (c.sollTagged?.length ? `Trunk ${c.sollTagged.join(",")}` : c.sollVid ?? "–") : <span style={{ color: MUTED }}>–</span>}</td>
                          <td style={td({ ...mono, fontSize: 11 })}>{(sp.tagged || []).join(", ")}</td>
                          <td style={td({ fontSize: 12, color: sp.poe === "liefert" ? OK : SUB })}>{sp.poe || ""}</td>
                          <td style={td({ fontSize: 12 })}>{(sp.lldp || []).map((n, i) => <div key={i}>{n.system}{n.port && <span style={{ color: SUB }}> · {n.port}</span>}</div>)}</td>
                          <td style={td({ fontSize: 12 })}>{c.peer ? <a href="#" style={{ color: "#fff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(c.peer.id); }}>{c.peer.name}</a> : ""}</td>
                          <td style={td({ fontSize: 12, color: WARN })}>{c.hinweise.join("; ")}</td>
                        </tr>
                      );
                    })}
                  </Table>
                )}
              </>
            )}
          </Card>
        );
      })}
      <Hint>
        Abfrage per SNMPv2c, nur lesend (IF-MIB, Q-BRIDGE-MIB, POWER-ETHERNET-MIB, LLDP-MIB). SNMP muss am Switch eingeschaltet sein; bei Cisco Business etwa unter „SNMP“ mit einer Read-Only-Community.
        Ob Luminex GigaCore SNMP anbietet, ist nicht geprüft. Die Zuordnung zum Plan geschieht über die Reihenfolge: der n-te Ethernet-Port am Switch entspricht dem n-ten Port im Plan.
      </Hint>
    </div>
  );
}
