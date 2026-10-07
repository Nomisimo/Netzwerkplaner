import React, { useState } from "react";
import { S, ACCENT, OK, WARN, ERR, MUTED, SUB, INFO, STRONG } from "../../shared/constants.js";
import { useMonitor } from "./store.js";
import { MonBar, Table, td, Hint, Empty, PlanName, Age, Levels, LevelModeSwitch, Card, Pill, mono, zeile, MacHersteller } from "./common.jsx";
import { useSichtbar } from "./store.js";
import { Toggle } from "../ui.jsx";
import { ChevronUp, ChevronDown } from "lucide-react";

// "1-4, 10" → [1,2,3,4,10]
export const parseList = (s, max = 64) => {
  const out = new Set();
  for (const part of String(s).split(/[,; ]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && out.size < max; i++) out.add(i);
  }
  return [...out];
};

/* ── sACN ───────────────────────────────────────────────────────────────── */
export function SacnView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("sacn");
  const s = mon.snapshot;
  const sichtbar = useSichtbar();
  const [unis, setUnis] = useState("1-4");
  const [add, setAdd] = useState("");
  const [mode, setMode] = useState("dez");
  const sel = s?.detail?.universe ?? null;

  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface, universes: parseList(unis) })}>
        {!mon.running && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB }}>
            Universen <input style={{ ...S.inputSm, width: 120 }} value={unis} onChange={(e) => setUnis(e.target.value)} placeholder="1-4, 10" />
          </label>
        )}
        {mon.running && (
          <>
            <input style={{ ...S.inputSm, width: 110 }} value={add} onChange={(e) => setAdd(e.target.value)} placeholder="weitere, z. B. 5-8" onKeyDown={(e) => e.key === "Enter" && (parseList(add).forEach((u) => mon.action("watch", { universe: u })), setAdd(""))} />
            <button style={S.smallBtn} onClick={() => { parseList(add).forEach((u) => mon.action("watch", { universe: u })); setAdd(""); }}>+ Beobachten</button>
            {s?.discovery?.length > 0 && <button style={S.smallBtn} onClick={() => mon.action("watchDiscovered")}>Alle gemeldeten Universen beobachten</button>}
          </>
        )}
      </MonBar>

      {s && (
        <>
          <Card title="Universen">
            {!s.universes.length ? <Empty>Noch keine Daten.</Empty> : (
              <Table head={["Univ.", "Quelle", "IP / Gerät", "Prio", "fps", "Kanäle", "Seq-Fehler", "zuletzt", ""]}>
                {s.universes.flatMap((u) => {
                  const live = u.sources.filter((x) => x.age < 2500 && !x.preview && x.zustand !== "beendet");
                  const prios = new Set(live.map((x) => x.priority));
                  const merge = live.length > 1 && prios.size === 1;
                  const quellen = sichtbar(u.sources);
                  const rows = quellen.length ? quellen : [null];
                  return rows.map((src, i) => (
                    <tr key={u.universe + ":" + (src?.cid || "leer")} onClick={() => mon.action("select", { universe: sel === u.universe ? null : u.universe })}
                      style={zeile(src?.zustand, { cursor: "pointer", background: sel === u.universe ? ACCENT + "22" : undefined })}>
                      <td style={td({ fontWeight: 700 })}>{i === 0 ? u.universe : ""}
                        {i === 0 && merge && <div><Pill color={WARN}>HTP-Merge</Pill></div>}
                        {i === 0 && prios.size > 1 && <div><Pill color={INFO}>Prioritäten</Pill></div>}
                      </td>
                      {src ? (
                        <>
                          <td style={td()}>{src.source}{src.preview && <Pill color={MUTED}>Preview</Pill>}{src.perAddrPrio && <Pill color={INFO}>Prio je Kanal</Pill>}</td>
                          <td style={td()}><span style={mono}>{src.ip}</span><div style={{ fontSize: 11 }}><PlanName P={P} ip={src.ip} onSelectDevice={onSelectDevice} /></div></td>
                          <td style={td(mono)}>{src.priority}</td>
                          <td style={td({ ...mono, color: src.fps < 1 ? ERR : src.fps < 20 ? WARN : STRONG })}>{src.fps}</td>
                          <td style={td(mono)}>{src.slots}</td>
                          <td style={td({ ...mono, color: src.seqErr ? WARN : MUTED })}>{src.seqErr}</td>
                          <td style={td()}><Age ms={src.age} z={src.zustand} /></td>
                          <td style={td()}>{i === 0 && <span style={{ fontSize: 11, color: SUB, display: "inline-flex", alignItems: "center", gap: 3 }}>{sel === u.universe ? <ChevronUp size={12} /> : <>Werte <ChevronDown size={12} /></>}</span>}</td>
                        </>
                      ) : <td colSpan={8} style={td({ color: MUTED, fontSize: 12 })}>beobachtet, keine Quelle <button style={{ ...S.smallBtn, marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); mon.action("unwatch", { universe: u.universe }); }}>entfernen</button></td>}
                    </tr>
                  ));
                })}
              </Table>
            )}
          </Card>
          {s.detail && (
            <Card title={`Universum ${s.detail.universe}: Kanalwerte`} right={<LevelModeSwitch mode={mode} setMode={setMode} />}>
              <div style={{ fontSize: 11, color: SUB }}>Zusammengeführt wie ein Empfänger: höchste Priorität gewinnt, bei gleicher Priorität der höchste Wert (HTP).</div>
              <Levels levels={s.detail.levels} mode={mode} />
            </Card>
          )}
          <Card title="Universe Discovery (E1.31, Universum 64214)">
            {!s.discovery.length ? <Empty>Noch keine Quelle hat ihre Universen gemeldet (Meldung kommt alle 10 s).</Empty> : (
              <Table head={["Quelle", "IP / Gerät", "sendet Universen", "zuletzt"]}>
                {sichtbar(s.discovery).map((d) => (
                  <tr key={d.cid} style={zeile(d.zustand)}>
                    <td style={td()}>{d.source}</td>
                    <td style={td()}><span style={mono}>{d.ip}</span> <span style={{ fontSize: 11 }}><PlanName P={P} ip={d.ip} onSelectDevice={onSelectDevice} /></span></td>
                    <td style={td({ ...mono, maxWidth: 420 })}>{d.universes.join(", ")}</td>
                    <td style={td()}><Age ms={d.age} z={d.zustand} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
      <Hint>
        sACN läuft per Multicast (239.255.x.y, UDP 5568). Der Rechner tritt nur den beobachteten Universen bei; bei aktivem IGMP-Snooping kommt nur deren Verkehr an.
        Unicast-sACN zwischen anderen Geräten ist ohne Port-Mirroring am Switch nicht sichtbar. Es werden keine Daten gesendet.
      </Hint>
    </div>
  );
}

/* ── Art-Net ────────────────────────────────────────────────────────────── */
export function ArtnetView({ P, iface, onSelectDevice }) {
  const mon = useMonitor("artnet");
  const s = mon.snapshot;
  const sichtbar = useSichtbar();
  const [mode, setMode] = useState("dez");
  const sel = s?.detail?.portAddress ?? null;
  return (
    <div>
      <MonBar mon={mon} onStart={() => mon.start({ iface })}>
        {mon.running && (
          <>
            <button style={S.smallBtn} onClick={() => mon.action("poll")} title="Sendet ein ArtPoll an die Broadcast-Adresse. Alle Art-Net-Nodes antworten mit Name, IP und Ports.">ArtPoll senden</button>
            <Toggle checked={s?.autoPoll} onChange={(on) => mon.action("autoPoll", { on })} label="alle 10 s" />
            {s?.targets?.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>an {s.targets.join(", ")}</span>}
          </>
        )}
      </MonBar>
      {s && (
        <>
          <Card title={`Nodes (${s.nodes.length})`} right={mon.running && s.nodes.length > 0 && <button style={S.smallBtn} onClick={() => mon.action("clearNodes")}>Liste leeren</button>}>
            {!s.nodes.length ? <Empty>Noch keine Antwort auf ArtPoll.</Empty> : (
              <Table head={["IP / Gerät", "Name", "Ports (Net:Sub:Uni)", "MAC", "Meldung", "zuletzt"]}>
                {sichtbar(s.nodes).map((n) => (
                  <tr key={n.ip + "#" + n.bindIndex} style={zeile(n.zustand)}>
                    <td style={td()}><span style={mono}>{n.ip}</span>{n.bindIndex > 1 && <span style={{ color: MUTED, fontSize: 11 }}> #{n.bindIndex}</span>}<div style={{ fontSize: 11 }}><PlanName P={P} ip={n.ip} mac={n.mac} onSelectDevice={onSelectDevice} /></div></td>
                    <td style={td()}><b>{n.shortName}</b><div style={{ fontSize: 11, color: SUB }}>{n.longName}</div></td>
                    <td style={td({ fontSize: 11 })}>{n.ports.map((p, i) => <span key={i} style={{ ...S.chip, marginRight: 3, color: p.dir === "out" ? OK : INFO }}>{p.dir === "out" ? "Out" : "In"} {p.label}</span>)}</td>
                    <td style={td(mono)}>{n.mac}<MacHersteller mac={n.mac} /></td>
                    <td style={td({ fontSize: 11, color: SUB, maxWidth: 260 })}>{n.report}</td>
                    <td style={td()}><Age ms={n.age} z={n.zustand} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Card title="Universen (ArtDmx)">
            {!s.universes.length ? <Empty>Kein ArtDmx empfangen. Art-Net per Unicast an andere Geräte ist hier nicht sichtbar.</Empty> : (
              <Table head={["Universum", "Portadresse", "Sender", "fps", "Kanäle", "zuletzt", ""]}>
                {s.universes.flatMap((u) => sichtbar(u.senders).map((x, i) => (
                  <tr key={u.portAddress + x.ip} style={zeile(x.zustand, { cursor: "pointer", background: sel === u.portAddress ? ACCENT + "22" : undefined })}
                    onClick={() => mon.action("select", { portAddress: sel === u.portAddress ? null : u.portAddress })}>
                    <td style={td({ fontWeight: 700 })}>{i === 0 ? u.label : ""}{i === 0 && u.senders.filter((y) => y.zustand === "aktiv").length > 1 && <div><Pill color={WARN}>{u.senders.filter((y) => y.zustand === "aktiv").length} Sender</Pill></div>}</td>
                    <td style={td(mono)}>{i === 0 ? u.portAddress : ""}</td>
                    <td style={td()}><span style={mono}>{x.ip}</span> <span style={{ fontSize: 11 }}><PlanName P={P} ip={x.ip} onSelectDevice={onSelectDevice} /></span></td>
                    <td style={td({ ...mono, color: x.fps < 1 ? ERR : STRONG })}>{x.fps}</td>
                    <td style={td(mono)}>{x.slots}</td>
                    <td style={td()}><Age ms={x.age} z={x.zustand} /></td>
                    <td style={td()}>{i === 0 && <span style={{ fontSize: 11, color: SUB, display: "inline-flex", alignItems: "center", gap: 3 }}>{sel === u.portAddress ? <ChevronUp size={12} /> : <>Werte <ChevronDown size={12} /></>}</span>}</td>
                  </tr>
                )))}
              </Table>
            )}
          </Card>
          {s.detail && (
            <Card title={`Universum ${s.detail.label}: Kanalwerte`} right={<LevelModeSwitch mode={mode} setMode={setMode} />}>
              <div style={{ fontSize: 11, color: SUB }}>Bei mehreren Sendern zeigt die Ansicht den höchsten Wert je Kanal (HTP).</div>
              <Levels levels={s.detail.levels} mode={mode} />
            </Card>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card title="Pulte / Controller (senden ArtPoll)">
              {!sichtbar(s.controllers).length ? <Empty>Keine.</Empty> : sichtbar(s.controllers).map((c) => <div key={c.ip} style={zeile(c.zustand, { fontSize: 12, marginBottom: 4 })}><span style={mono}>{c.ip}</span> · <PlanName P={P} ip={c.ip} onSelectDevice={onSelectDevice} /> · <Age ms={c.age} z={c.zustand} /></div>)}
            </Card>
            <Card title="Pakettypen">
              {!s.ops.length ? <Empty>Keine.</Empty> : s.ops.map((o) => <div key={o.op} style={{ fontSize: 12, marginBottom: 3 }}><b>{o.name}</b> <span style={{ color: SUB }}>{o.rate}/s · gesamt {o.total}</span></div>)}
            </Card>
          </div>
        </>
      )}
      <Hint>Art-Net nutzt UDP 6454 (Broadcast oder Unicast). „ArtPoll senden“ ist die einzige Aktion, die Pakete ins Netz schickt; Pulte tun das ohnehin alle paar Sekunden. DMX wird nie gesendet.</Hint>
    </div>
  );
}
