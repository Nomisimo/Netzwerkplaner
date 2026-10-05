import React, { useMemo, useState } from "react";
import { S, OK, WARN, ERR, MUTED, SUB, INFO } from "../../shared/constants.js";
import { fmtBps, findPlanned } from "../../shared/live.js";
import { useMonitor } from "./store.js";
import { MonBar, Table, td, Hint, Empty, PlanName, Age, Card, Pill, mono } from "./common.jsx";
import { ipPorts } from "../../shared/catalog.js";
import { Toggle } from "../ui.jsx";
import { parseList } from "./LichtViews.jsx";
import { TriangleAlert, OctagonX } from "lucide-react";

const TxtList = ({ txt }) => {
  const e = Object.entries(txt || {}).filter(([k]) => k);
  if (!e.length) return null;
  return <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{e.slice(0, 8).map(([k, v]) => `${k}=${v === true ? "" : v}`).join(" · ")}</div>;
};

/* ── Dante (mDNS) ───────────────────────────────────────────────────────── */
const DANTE_SVC = { "_netaudio-arc._udp.local": "ARC", "_netaudio-cmc._udp.local": "CMC", "_netaudio-dbc._udp.local": "DBC", "_netaudio-chan._udp.local": "Kanal" };

export function DanteView({ P, iface, onSelectDevice, goSub }) {
  const mon = useMonitor("dante");
  const ptp = useMonitor("ptp");
  const s = mon.snapshot;
  const devices = useMemo(() => {
    const m = new Map();
    for (const i of s?.instances || []) {
      const isChan = i.service.startsWith("_netaudio-chan");
      const name = isChan && i.label.includes("@") ? i.label.slice(i.label.lastIndexOf("@") + 1) : i.label;
      const d = m.get(name) || { name, ip: "", ips: new Set(), services: new Set(), chans: [], txt: {}, chanTxt: {}, age: Infinity, host: "" };
      d.services.add(DANTE_SVC[i.service] || i.service);
      if (isChan) { d.chans.push(i.label.slice(0, i.label.lastIndexOf("@")) || i.label); d.chanTxt = { ...d.chanTxt, ...i.txt }; }
      else { d.txt = { ...d.txt, ...i.txt }; if (i.ip) d.ip = i.ip; if (i.host) d.host = i.host; }
      if (!d.ip && i.ip) d.ip = i.ip;
      for (const x of i.ips || (i.ip ? [i.ip] : [])) d.ips.add(x);
      d.age = Math.min(d.age, i.age);
      m.set(name, d);
    }
    // Primary/Secondary: über den Plan zuordnen (erste bzw. zweite IP des Geräts), sonst in der gemeldeten Reihenfolge
    return [...m.values()].map((d) => {
      const ips = [...d.ips];
      const hit = ips.map((ip) => findPlanned(P, { ip })).find(Boolean);
      const plan = hit ? ipPorts(hit.dev).filter((i) => i.ip) : [];
      const pri = plan[0] && ips.includes(plan[0].ip) ? plan[0].ip : ips.find((ip) => !plan[1] || ip !== plan[1].ip) || d.ip;
      const sec = plan[1] && ips.includes(plan[1].ip) ? plan[1].ip : ips.find((ip) => ip !== pri) || "";
      return { ...d, plan: hit?.dev || null, pri, sec, secPlan: !sec && plan[1] ? plan[1].ip : "" };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [s?.instances, P]);
  const masters = (ptp.snapshot?.clocks || []).filter((c) => c.isMaster);

  return (
    <div>
      <MonBar mon={mon} label="Geräte suchen" onStart={() => mon.start({ iface })}>
        {mon.running && <button style={S.smallBtn} onClick={() => mon.action("query")}>Erneut fragen</button>}
        {mon.running && <span style={{ fontSize: 11, color: MUTED }}>fragt alle 15 s per mDNS</span>}
      </MonBar>
      {s?.notes?.map((n, i) => <div key={i} style={{ fontSize: 12, color: WARN, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {n}</div>)}
      {s && (
        <Card title={`Dante-Geräte (${devices.length})`}>
          {!devices.length ? <Empty>Noch keine Antwort. Dante-Geräte melden sich per mDNS, wenn der Rechner im selben Netz hängt.</Empty> : (
            <Table head={["Gerätename", "Modell", "Dante-Version", "Primäre Adresse", "Sekundäre Adresse", "Abtastrate", "Kanäle (mDNS)", "Plan", "zuletzt"]}>
              {devices.map((d) => {
                const t = d.txt, modell = [t.mf, t.model].filter((x) => x && x !== true).join(" ");
                const planModell = d.plan ? [d.plan.hersteller, d.plan.modell].filter(Boolean).join(" ") : "";
                return (
                  <tr key={d.name}>
                    <td style={td()}><b>{d.name}</b><div style={{ marginTop: 2 }}>{[...d.services].map((x) => <Pill key={x} color={INFO}>{x}</Pill>)}</div></td>
                    <td style={td({ fontSize: 12 })}>{modell || <span style={{ color: MUTED }}>{planModell ? `${planModell} (Plan)` : "–"}</span>}{t.router_info && t.router_info !== true && <div style={{ fontSize: 10, color: MUTED }}>{t.router_info}</div>}</td>
                    <td style={td(mono)}>{t.router_vers || t.server_vers || <span style={{ color: MUTED }}>–</span>}{t.arcp_vers && <div style={{ fontSize: 10, color: MUTED }}>ARCP {t.arcp_vers}</div>}</td>
                    <td style={td(mono)}>{d.pri || "–"}</td>
                    <td style={td(mono)}>{d.sec || (d.secPlan ? <span style={{ color: MUTED }} title="Im Plan eingetragen, über die gewählte Netzwerkkarte nicht gemeldet">{d.secPlan} (Plan)</span> : <span style={{ color: MUTED }}>–</span>)}</td>
                    <td style={td({ fontSize: 12 })}>{d.chanTxt.rate ? `${(+d.chanTxt.rate / 1000).toLocaleString("de-DE")} kHz` : <span style={{ color: MUTED }}>–</span>}{d.chanTxt.latency_ns && <div style={{ fontSize: 10, color: MUTED }}>Latenz {(+d.chanTxt.latency_ns / 1e6).toLocaleString("de-DE")} ms</div>}</td>
                    <td style={td({ fontSize: 11, maxWidth: 260 })}>{d.chans.length ? <span title={d.chans.join(", ")}>{d.chans.length}: {d.chans.slice(0, 6).join(", ")}{d.chans.length > 6 ? " …" : ""}</span> : <span style={{ color: MUTED }}>–</span>}</td>
                    <td style={td({ fontSize: 11 })}><PlanName P={P} ip={d.pri} onSelectDevice={onSelectDevice} /><TxtList txt={t} /></td>
                    <td style={td()}><Age ms={d.age} /></td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}
      <Card title="Clock (PTP)" right={<button style={S.smallBtn} onClick={() => goSub("ptp")}>PTP-Monitor öffnen</button>}>
        {!ptp.running ? <div style={{ fontSize: 12, color: SUB }}>PTP-Monitor ist aus. <button style={{ ...S.smallBtn, marginLeft: 6 }} onClick={() => ptp.start({ iface })}>Starten</button></div>
          : !masters.length ? <Empty>Kein PTP-Master gehört.</Empty>
          : masters.map((c) => <div key={c.version + c.domain + c.clock} style={{ fontSize: 12, marginBottom: 4 }}>PTPv{c.version} Domain {c.domain}: Master <span style={mono}>{c.ip}</span> <PlanName P={P} ip={c.ip} onSelectDevice={onSelectDevice} /> · Sync {c.syncRate}/s</div>)}
        {ptp.snapshot?.conflicts?.length > 0 && <div style={{ color: ERR, fontSize: 12, marginTop: 6, display: "flex", alignItems: "flex-start", gap: 5 }}><OctagonX size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Mehrere Master in derselben Domain: {ptp.snapshot.conflicts.map((c) => `${c.domain} (${c.ips.join(", ")})`).join("; ")}</div>}
      </Card>
      <Hint>
        Gelistet wird, was die Geräte per mDNS (DNS-SD) ankündigen: Name, Modell, Dante-Version, Adressen, Abtastrate und die Kanalnamen. Primär und Sekundär ordnet der Plan zu. Die Sekundär-Adresse erscheint nur, wenn die gewählte Netzwerkkarte auch das Secondary-Netz sieht. Produktversion, Gerätesperre, Link-Geschwindigkeit, Abos und Routing liest nur Dante Controller über das nicht offene Audinate-Protokoll; diese App ändert nichts an Dante-Geräten.
      </Hint>
    </div>
  );
}

/* ── NDI (mDNS) ─────────────────────────────────────────────────────────── */
export function NdiView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("ndi");
  const s = mon.snapshot;
  const list = (s?.instances || []).slice().sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div>
      <MonBar mon={mon} label="Quellen suchen" onStart={() => mon.start({ iface })}>
        {mon.running && <button style={S.smallBtn} onClick={() => mon.action("query")}>Erneut fragen</button>}
      </MonBar>
      {s?.notes?.map((n, i) => <div key={i} style={{ fontSize: 12, color: WARN, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 5 }}><TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {n}</div>)}
      {s && (
        <Card title={`NDI-Quellen (${list.length})`}>
          {!list.length ? <Empty>Keine NDI-Quelle gefunden. Mit NDI Discovery Server (TCP 5959) melden sich Quellen nicht per mDNS.</Empty> : (
            <Table head={["Quelle", "Host", "IP / Plan", "Port", "zuletzt"]}>
              {list.map((i) => (
                <tr key={i.instance}>
                  <td style={td()}><b>{i.label}</b><TxtList txt={i.txt} /></td>
                  <td style={td({ fontSize: 12 })}>{i.host}</td>
                  <td style={td()}><span style={mono}>{i.ip}</span><div style={{ fontSize: 11 }}><PlanName P={P} ip={i.ip} onSelectDevice={onSelectDevice} /></div></td>
                  <td style={td(mono)}>{i.port}</td>
                  <td style={td()}><Age ms={i.age} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      <Hint>Die Liste kommt aus mDNS (_ndi._tcp). Bild und Bandbreite zeigt sie nicht, dafür bräuchte es das NDI-SDK.</Hint>
    </div>
  );
}

/* ── MA-Net ─────────────────────────────────────────────────────────────── */
export function ManetView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("manet");
  const s = mon.snapshot;
  const sum = (s?.flows || []).reduce((a, f) => a + f.bps, 0);
  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface })}>
        {mon.running && <button style={S.smallBtn} onClick={() => mon.action("clear")}>Leeren</button>}
        {mon.running && <span style={{ fontSize: 12, color: SUB }}>gesamt {fmtBps(sum)}</span>}
      </MonBar>
      {s && (
        <>
          <Card title="Sender">
            {!s.flows.length ? <Empty>Kein MA-Net-Verkehr empfangen.</Empty> : (
              <Table head={["IP / Gerät", "Netz", "UDP-Port", "Pakete/s", "Bandbreite", "häufige Größen", "seit", "zuletzt"]}>
                {s.flows.map((f) => (
                  <tr key={f.ip + f.port}>
                    <td style={td()}><span style={mono}>{f.ip}</span><div style={{ fontSize: 11 }}><PlanName P={P} ip={f.ip} onSelectDevice={onSelectDevice} /></div></td>
                    <td style={td()}><Pill color={f.netz === "MA-Net3" ? OK : INFO}>{f.netz}</Pill></td>
                    <td style={td(mono)}>{f.port}</td>
                    <td style={td(mono)}>{f.pps}</td>
                    <td style={td(mono)}>{fmtBps(f.bps)}</td>
                    <td style={td({ ...mono, color: SUB })}>{f.sizes.join(", ")} B</td>
                    <td style={td({ fontSize: 12, color: SUB })}>{Math.round(f.since / 1000)} s</td>
                    <td style={td()}><Age ms={f.age} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <div style={{ fontSize: 11, color: MUTED }}>
            {s.sockets.map((x) => <div key={x.port}>{x.netz} UDP {x.port}{x.joined.length ? `, Gruppen ${x.joined.join(", ")}` : ", Broadcast"}{x.failed.length ? ` (fehlgeschlagen: ${x.failed.join(", ")})` : ""}</div>)}
          </div>
        </>
      )}
      <Hint>
        MA-Net ist nicht offen dokumentiert. Die Ansicht zeigt nur, wer wie viel sendet, nicht was. MA-Net3 nutzt laut MA UDP 30020 mit Multicast 236.4.1.0–.4 (etwa 200 Mbit/s reservieren);
        die MA-Net2-Ports 29998/29999 stammen aus dem MA-Forum. MA-Net1 ist ohne veröffentlichte Ports und wird nicht erkannt.
      </Hint>
    </div>
  );
}

/* ── OSC ────────────────────────────────────────────────────────────────── */
export function OscView({ iface }) {
  const mon = useMonitor("osc");
  const s = mon.snapshot;
  const [ports, setPorts] = useState("8000, 8001, 49900");
  const [view, setView] = useState("log");
  const [q, setQ] = useState("");
  const fmtArgs = (a) => (a || []).map((x) => (typeof x === "string" ? `"${x}"` : String(x))).join(", ");
  const log = (s?.log || []).filter((m) => !q || m.address.toLowerCase().includes(q.toLowerCase())).slice().reverse();
  const addrs = (s?.addresses || []).filter((m) => !q || m.address.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface, ports: parseList(ports, 8) })}>
        {!mon.running && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB }}>UDP-Ports <input style={{ ...S.inputSm, width: 140 }} value={ports} onChange={(e) => setPorts(e.target.value)} /></label>}
        {mon.running && (
          <>
            <span style={{ fontSize: 12, color: SUB }}>Ports {s?.ports?.join(", ")}</span>
            <Toggle checked={s?.paused} onChange={(on) => mon.action("pause", { on })} label="Protokoll anhalten" />
            <button style={S.smallBtn} onClick={() => mon.action("clear")}>Leeren</button>
          </>
        )}
      </MonBar>
      {s && (
        <>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <div style={S.boxTabs}>
              {[["log", "Protokoll"], ["addr", `Adressen (${s.addresses.length})`]].map(([k, l]) => <button key={k} style={{ ...S.boxTab, ...(view === k ? S.boxTabActive : {}) }} onClick={() => setView(k)}>{l}</button>)}
            </div>
            <input style={{ ...S.inputSm, width: 220 }} placeholder="Adresse filtern, z. B. /gma3" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {view === "log" ? (!log.length ? <Empty>Noch keine OSC-Nachricht.</Empty> : (
            <Table head={["Zeit", "von", "Port", "Adresse", "Typen", "Werte"]}>
              {log.slice(0, 150).map((m, i) => (
                <tr key={m.t + ":" + i}>
                  <td style={td({ ...mono, color: SUB })}>{new Date(m.t).toLocaleTimeString("de-DE")}</td>
                  <td style={td(mono)}>{m.from}</td>
                  <td style={td(mono)}>{m.port}</td>
                  <td style={td(mono)}>{m.address}</td>
                  <td style={td({ ...mono, color: SUB })}>{m.types}</td>
                  <td style={td(mono)}>{fmtArgs(m.args)}</td>
                </tr>
              ))}
            </Table>
          )) : (!addrs.length ? <Empty>Keine Adressen.</Empty> : (
            <Table head={["Adresse", "letzter Wert", "Anzahl", "pro s", "von", "zuletzt"]}>
              {addrs.map((a) => (
                <tr key={a.address}>
                  <td style={td(mono)}>{a.address}</td>
                  <td style={td(mono)}>{fmtArgs(a.last)}</td>
                  <td style={td(mono)}>{a.count}</td>
                  <td style={td(mono)}>{a.rate}</td>
                  <td style={td(mono)}>{a.from}:{a.port}</td>
                  <td style={td()}><Age ms={a.age} /></td>
                </tr>
              ))}
            </Table>
          ))}
        </>
      )}
      <Hint>OSC hat keinen Standardport: grandMA3 nutzt meist 8000, Eos 8000/8001, Yamaha RIVAGE/DME7 49900. Sichtbar sind Nachrichten an diesen Rechner sowie Broadcast. Blockiert ein anderes Programm den Port exklusiv, kann er nicht geöffnet werden.</Hint>
    </div>
  );
}

/* ── CITP ───────────────────────────────────────────────────────────────── */
export function CitpView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("citp");
  const s = mon.snapshot;
  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface })} />
      {s && (
        <>
          <Card title={`Teilnehmer (${s.peers.length})`}>
            {!s.peers.length ? <Empty>Noch kein CITP-Teilnehmer. Medienserver und Pulte melden sich etwa jede Sekunde per PINF/PLoc.</Empty> : (
              <Table head={["Name", "Typ", "Status", "IP / Plan", "TCP-Port", "CITP", "zuletzt"]}>
                {s.peers.map((p) => (
                  <tr key={p.ip}>
                    <td style={td()}><b>{p.name}</b></td>
                    <td style={td()}><Pill color={p.type === "MediaServer" ? OK : INFO}>{p.type || "?"}</Pill></td>
                    <td style={td({ fontSize: 12 })}>{p.state}</td>
                    <td style={td()}><span style={mono}>{p.ip}</span><div style={{ fontSize: 11 }}><PlanName P={P} ip={p.ip} onSelectDevice={onSelectDevice} /></div></td>
                    <td style={td(mono)}>{p.tcpPort}</td>
                    <td style={td(mono)}>{p.version}</td>
                    <td style={td()}><Age ms={p.age} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <div style={{ fontSize: 12, color: SUB }}>{s.layers.map((l) => `${l.key}: ${l.rate}/s`).join(" · ")}</div>
        </>
      )}
      <Hint>CITP-Discovery läuft über Multicast 224.0.0.180 (UDP 4809). Diese Gruppe ist Link-Local: Sie wird nicht geroutet, man sieht nur Teilnehmer im selben VLAN.</Hint>
    </div>
  );
}

/* ── PTP ────────────────────────────────────────────────────────────────── */
const CLOCK_CLASS = { 6: "primäre Referenz (GPS)", 7: "primär, Holdover", 13: "anwendungsspezifisch", 52: "degradiert", 187: "degradiert", 248: "Standard (frei laufend)", 255: "nur Slave" };
export function PtpView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("ptp");
  const s = mon.snapshot;
  const clocks = (s?.clocks || []).slice().sort((a, b) => b.isMaster - a.isMaster || a.ip.localeCompare(b.ip, undefined, { numeric: true }));
  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface })}>
        {mon.running && <button style={S.smallBtn} onClick={() => mon.action("clear")}>Leeren</button>}
      </MonBar>
      {s?.conflicts?.length > 0 && <div style={{ color: ERR, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 5 }}><OctagonX size={14} style={{ flexShrink: 0, marginTop: 2 }} /> Mehrere Master senden in derselben Domain: {s.conflicts.map((c) => `${c.domain}: ${c.ips.join(", ")}`).join("; ")}. Das deutet auf getrennte Clock-Inseln oder eine Fehlkonfiguration hin.</div>}
      {s && (
        <Card title={`Clocks (${clocks.length})`}>
          {!clocks.length ? <Empty>Noch kein PTP-Paket. Sichtbar sind Master (Sync/Announce) und Slaves, die Delay_Req per Multicast senden.</Empty> : (
            <Table head={["Rolle", "IP / Plan", "Version / Domain", "Clock-ID", "Grandmaster", "Sync/s", "Announce/s", "Details", "zuletzt"]}>
              {clocks.map((c) => (
                <tr key={c.version + c.domain + c.clock}>
                  <td style={td()}>{c.isMaster ? <Pill color={OK}>Master</Pill> : <Pill color={MUTED}>Slave</Pill>}</td>
                  <td style={td()}><span style={mono}>{c.ip}</span><div style={{ fontSize: 11 }}><PlanName P={P} ip={c.ip} onSelectDevice={onSelectDevice} /></div></td>
                  <td style={td({ fontSize: 12 })}>PTPv{c.version} · {c.domain}{c.version === 1 && <div style={{ fontSize: 10, color: MUTED }}>Dante (Standard)</div>}</td>
                  <td style={td({ ...mono, fontSize: 11 })}>{c.clock}</td>
                  <td style={td({ ...mono, fontSize: 11 })}>{c.gm || "–"}</td>
                  <td style={td(mono)}>{c.syncRate}</td>
                  <td style={td(mono)}>{c.announceRate}</td>
                  <td style={td({ fontSize: 11, color: SUB })}>
                    {c.version === 2 && c.prio1 != null && <>Prio {c.prio1}/{c.prio2} · Klasse {c.clockClass}{CLOCK_CLASS[c.clockClass] ? ` (${CLOCK_CLASS[c.clockClass]})` : ""} · {c.stepsRemoved} Hops</>}
                    {c.version === 1 && c.stratum != null && <>Stratum {c.stratum}{c.gmIdent ? ` · ${c.gmIdent}` : ""}{c.preferred ? " · bevorzugt" : ""}</>}
                  </td>
                  <td style={td()}><Age ms={c.age} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      <Hint>
        PTP läuft über Multicast 224.0.1.129 (UDP 319/320). Dante nutzt standardmäßig PTPv1, AES67 nutzt PTPv2. MA-Net, Art-Net, sACN und NDI verwenden kein PTP. Ein zweiter Master in derselben Domain ist fast immer ein Fehler (zum Beispiel ein Switch als Boundary Clock oder zwei getrennte Netze, die zusammengesteckt wurden).
      </Hint>
    </div>
  );
}
