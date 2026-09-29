import React, { useState, useMemo } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK } from "../../shared/constants.js";
import { KERN, KERN_BY_ID, defaultParams } from "../../shared/kernprotokolle.js";
import { statistik, leitungslast, danteHops, pfad, switchHops, laufzeit, danteLatenz, fmtMbit } from "../../shared/analyse.js";
import { buildTree } from "../../shared/model.js";
import { WERKZEUGE, WIRESHARK, CISCO } from "../../shared/wissen.js";
import { Section, Field, Toggle, VlanChip, Dot } from "../ui.jsx";
import { ParamInput } from "../StroemeEditor.jsx";

const fmtUs = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : x >= 10 ? `${x.toFixed(0)} µs` : `${x.toFixed(1)} µs`);

function Bar({ value, max = 1, color }) {
  const pct = Math.min(1, value / max);
  const c = color || (value > 1 ? ERR : value > 0.7 ? WARN : OK);
  return (
    <div style={{ height: 8, background: "#2a313a", borderRadius: 4, overflow: "hidden", minWidth: 80 }}>
      <div style={{ width: `${Math.max(pct * 100, value > 0 ? 2 : 0)}%`, height: "100%", background: c }} />
    </div>
  );
}

function Zahl({ label, value, sub, color }) {
  return (
    <div style={{ ...S.card, padding: "12px 14px", margin: 0 }}>
      <div style={{ fontSize: 11, color: SUB, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "#fff", marginTop: 2, fontFamily: "Consolas,monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ProtokollRechner() {
  const [id, setId] = useState("dante");
  const k = KERN_BY_ID[id];
  const [menge, setMenge] = useState(k.menge);
  const [par, setPar] = useState(() => defaultParams(id));
  const r = k.rechne(+menge || 0, { ...defaultParams(id), ...par });
  const wahl = (nid) => { setId(nid); setMenge(KERN_BY_ID[nid].menge); setPar(defaultParams(nid)); };
  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {KERN.map((x) => <button key={x.id} style={{ ...S.boxTab, ...(id === x.id ? { ...S.boxTabActive, background: x.farbe, borderColor: x.farbe, color: "#15191e" } : {}) }} onClick={() => wahl(x.id)}>{x.name}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Field label={k.einheit}><input type="number" min="0" style={S.inputSm} value={menge} onChange={(e) => setMenge(e.target.value)} /></Field>
        {k.params.map((p) => (
          <Field key={p.key} label={p.type === "bool" ? " " : p.label} hint={p.hint}>
            <ParamInput p={p} value={par[p.key]} onChange={(v) => setPar((o) => ({ ...o, [p.key]: v }))} />
          </Field>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 12 }}>
        <Zahl label="Bandbreite" value={fmtMbit(r.mbit)} color={ACCENT} />
        {r.pps != null && <Zahl label="Pakete/s" value={Math.round(r.pps).toLocaleString("de-DE")} />}
        {r.flows != null && <Zahl label="Flows" value={r.flows} />}
        {r.gruppen != null && <Zahl label="Multicast-Gruppen" value={r.gruppen} />}
        <Zahl label="Anteil 1 Gbit/s" value={`${((r.mbit / 1000) * 100).toFixed(1)} %`} sub={`10 Gbit/s: ${((r.mbit / 10000) * 100).toFixed(2)} %`} />
      </div>
      {r.hinweis && <p style={{ ...S.hint, marginTop: 8 }}>{r.hinweis}</p>}
    </div>
  );
}

function LaufzeitRechner({ P, X }) {
  const [v, setV] = useState({ hops: 3, mbit: 1000, bytes: 1500, switchUs: 3, meter: 200, queue: true });
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const t = laufzeit(v);
  const devs = P.geraete.filter((d) => !d.isSwitch).sort((x, y) => x.name.localeCompare(y.name, "de", { numeric: true }));
  const p = a && b ? pfad(P, X, a, b) : null;
  const hops = switchHops(p, X);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <Field label="Switches im Pfad"><input type="number" min="0" style={S.inputSm} value={v.hops} onChange={(e) => set("hops", +e.target.value)} /></Field>
          <Field label="Port"><select style={S.selectSm} value={v.mbit} onChange={(e) => set("mbit", +e.target.value)}>{[[100, "100 Mbit/s"], [1000, "1 Gbit/s"], [10000, "10 Gbit/s"], [25000, "25 Gbit/s"]].map(([x, l]) => <option key={x} value={x}>{l}</option>)}</select></Field>
          <Field label="Paket (Byte)"><input type="number" min="64" max="9000" style={S.inputSm} value={v.bytes} onChange={(e) => set("bytes", +e.target.value)} /></Field>
          <Field label="Switch-Durchlauf (µs)"><input type="number" min="0" step="0.5" style={S.inputSm} value={v.switchUs} onChange={(e) => set("switchUs", +e.target.value)} /></Field>
          <Field label="Kabel gesamt (m)"><input type="number" min="0" style={S.inputSm} value={v.meter} onChange={(e) => set("meter", +e.target.value)} /></Field>
          <Field label=" "><Toggle checked={v.queue} onChange={(c) => set("queue", c)} label="volle Queue je Hop" /></Field>
        </div>
        <table style={{ ...S.table, fontSize: 12 }}><tbody>
          <tr><td style={S.td}>Serialisierung je Übertragung</td><td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{fmtUs(t.ser)}</td></tr>
          <tr><td style={S.td}>Warteschlange je Hop (Worst Case)</td><td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{fmtUs(t.q)}</td></tr>
          <tr><td style={S.td}>je Switch gesamt</td><td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{fmtUs(t.proHop)}</td></tr>
          <tr><td style={S.td}>Kabel ({v.meter} m)</td><td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{fmtUs(t.kabel)}</td></tr>
          <tr><td style={{ ...S.td, fontWeight: 700 }}>Laufzeit Ende zu Ende</td><td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: ACCENT }}>{fmtUs(t.gesamt)}</td></tr>
          <tr><td style={S.td}>Dante-Latenz (Empfehlung)</td><td style={{ ...S.td, textAlign: "right" }}>{danteLatenz(v.hops, v.mbit < 1000)}</td></tr>
        </tbody></table>
      </div>
      <div>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>Pfad zwischen zwei Geräten im Projekt</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[[a, setA, "von"], [b, setB, "nach"]].map(([val, fn, l]) => (
            <select key={l} style={S.selectSm} value={val} onChange={(e) => fn(e.target.value)}>
              <option value="">{l} …</option>{devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ))}
        </div>
        {a && b && (p ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", fontSize: 12 }}>
              {p.map((id, n) => <React.Fragment key={id}>{n > 0 && <span style={{ color: MUTED }}>→</span>}<span style={{ ...S.chip, borderColor: X.devById.get(id)?.isSwitch ? ACCENT + "88" : LINE }}>{X.devById.get(id)?.name}</span></React.Fragment>)}
            </div>
            <p style={{ fontSize: 12, color: SUB }}>{hops} Switch{hops === 1 ? "" : "es"} im kürzesten Weg. Dante-Empfehlung: <b>{danteLatenz(hops)}</b>. <button style={S.smallBtn} onClick={() => set("hops", hops)}>in Rechner übernehmen</button></p>
          </div>
        ) : <p style={{ ...S.hint, color: WARN }}>Keine Verbindung über Switches zwischen diesen Geräten.</p>)}
      </div>
    </div>
  );
}

export default function AnalyseTab({ P, X, onSelectDevice, goTab }) {
  const T = useMemo(() => buildTree(P, X), [P, X]);
  const st = useMemo(() => statistik(P, X), [P, X]);
  const L = useMemo(() => leitungslast(P, X, T, st.stroeme), [P, X, T, st]);
  const dh = useMemo(() => danteHops(P, X), [P, X]);
  const [alleLeitungen, setAlleLeitungen] = useState(false);
  const [offen, setOffen] = useState(null);
  const name = (id) => X.devById.get(id)?.name || "?";
  const maxLast = L[0]?.last || 0;

  return (
    <>
      <Section title="Überblick" subtitle="Alle Werte sind Planungsabschätzungen aus den Datenströmen der Geräte (Geräte-Editor → Datenströme), keine Messungen.">
        {!st.stroeme.length && <p style={{ ...S.hint, color: WARN }}>Noch keine Datenströme eingetragen. Im Geräte-Editor unter „Datenströme“ eintragen, was jedes Gerät sendet, oder „⟳ Vorschlag aus Protokollen“ nutzen.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <Zahl label="Summe aller Ströme" value={fmtMbit(st.summe.mbit)} sub={`${st.stroeme.length} Ströme`} />
          <Zahl label="Dante" value={st.summe.danteKanaele} sub={`Kanäle · ${st.summe.danteFlows} Flows`} color={KERN_BY_ID.dante.farbe} />
          <Zahl label="DMX-Universen" value={st.summe.universen} sub="MA-Net, Art-Net, sACN" color={KERN_BY_ID.sacn.farbe} />
          <Zahl label="NDI-Quellen" value={st.summe.ndi} color={KERN_BY_ID.ndi.farbe} />
          <Zahl label="Multicast-Gruppen" value={st.summe.gruppen} />
          <Zahl label="Höchste Leitungslast" value={`${Math.round(maxLast * 100)} %`} color={maxLast > 1 ? ERR : maxLast > 0.7 ? WARN : OK} sub={L[0] ? `${name(L[0].parent)} ↔ ${name(L[0].child)}` : "–"} />
          <Zahl label="Dante-Hops (max.)" value={dh.hops} sub={dh.a ? `${dh.a.name} ↔ ${dh.b.name} · Latenz ≥ ${dh.empfehlung}` : `${dh.geraete} Dante-Geräte`} />
        </div>
      </Section>

      <Section title="Leitungslast" subtitle="Je Verbindung im Topologiebaum: „hoch“ Richtung Core, „runter“ in den Ast. Ströme ohne Empfänger zählen im Worst Case bis zum Core; Multicast ohne IGMP-Snooping und Art-Net-Broadcast laufen in jeden Ast des VLANs."
        right={<Toggle checked={alleLeitungen} onChange={setAlleLeitungen} label="alle Leitungen" />}>
        {!L.length ? <p style={S.empty}>Keine Verbindungen.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Verbindung</th><th style={{ ...S.th, textAlign: "right" }}>hoch</th><th style={{ ...S.th, textAlign: "right" }}>runter</th><th style={{ ...S.th, textAlign: "right" }}>Port</th><th style={{ ...S.th, width: 180 }}>Auslastung</th></tr></thead>
              <tbody>
                {L.filter((l) => alleLeitungen || l.hoch + l.runter > 0).slice(0, alleLeitungen ? 500 : 25).map((l) => (
                  <React.Fragment key={l.c.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setOffen(offen === l.c.id ? null : l.c.id)}>
                      <td style={S.td}><b>{name(l.parent)}</b> <span style={{ color: MUTED }}>↔</span> {name(l.child)}{l.c.label && <span style={{ color: MUTED, fontSize: 11 }}> · {l.c.label}</span>}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtMbit(l.hoch)}</td>
                      <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtMbit(l.runter)}</td>
                      <td style={{ ...S.td, textAlign: "right", fontSize: 12, color: SUB }}>{fmtMbit(l.speed)}</td>
                      <td style={S.td}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bar value={l.last} /><span style={{ fontSize: 11, fontFamily: "monospace", width: 38, textAlign: "right" }}>{Math.round(l.last * 100)} %</span></div></td>
                    </tr>
                    {offen === l.c.id && (
                      <tr><td colSpan="5" style={{ ...S.td, background: "#1b2026" }}>
                        {l.anteile.length ? l.anteile.slice(0, 12).map((a, n) => (
                          <div key={n} style={{ display: "flex", gap: 8, fontSize: 12, padding: "1px 0" }}>
                            <Dot color={KERN_BY_ID[a.x.s.proto].farbe} size={8} />
                            <span style={{ flex: 1 }}>{KERN_BY_ID[a.x.s.proto].name} von <a href="#" style={{ color: "#8ec5ff" }} onClick={(e) => { e.preventDefault(); onSelectDevice(a.x.dev.id); }}>{a.x.dev.name}</a> · {a.x.s.menge} {KERN_BY_ID[a.x.s.proto].einheit}{a.x.s.mc ? " · Multicast" : ""}{a.x.broadcast ? " · Broadcast" : ""}</span>
                            <span style={{ fontFamily: "monospace", color: SUB }}>{a.up ? `↑ ${fmtMbit(a.up)}` : ""} {a.down ? `↓ ${fmtMbit(a.down)}` : ""}</span>
                          </div>
                        )) : <span style={{ fontSize: 12, color: MUTED }}>Keine Ströme über diese Leitung.</span>}
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(460px,1fr))", gap: 20 }}>
        <Section title="Protokolle">
          <table style={S.table}>
            <thead><tr><th style={S.th}>Protokoll</th><th style={{ ...S.th, textAlign: "right" }}>Geräte</th><th style={{ ...S.th, textAlign: "right" }}>Menge</th><th style={{ ...S.th, textAlign: "right" }}>Last</th><th style={{ ...S.th, textAlign: "right" }}>Gruppen</th></tr></thead>
            <tbody>
              {st.proto.map((p) => (
                <tr key={p.k.id}>
                  <td style={S.td}><Dot color={p.k.farbe} size={8} /> {p.k.name}</td>
                  <td style={{ ...S.td, textAlign: "right", fontSize: 12 }} title="sendet (Datenströme) / spricht das Protokoll laut Geräteliste">{p.geraete} / {p.sprechen}</td>
                  <td style={{ ...S.td, textAlign: "right", fontSize: 12 }}>{p.menge ? `${p.menge} ${p.k.einheit}` : "–"}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{p.mbit ? fmtMbit(p.mbit) : "–"}</td>
                  <td style={{ ...S.td, textAlign: "right", fontSize: 12 }}>{p.gruppen || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="VLANs" subtitle="„an jedem Port“ = Last, die jeder Port im VLAN sieht (Broadcast und Multicast ohne IGMP-Snooping).">
          <table style={S.table}>
            <thead><tr><th style={S.th}>VLAN</th><th style={S.th}>IGMP</th><th style={{ ...S.th, textAlign: "right" }}>Summe</th><th style={{ ...S.th, textAlign: "right" }}>Multicast</th><th style={{ ...S.th, textAlign: "right" }}>an jedem Port</th><th style={{ ...S.th, textAlign: "right" }}>Gruppen</th></tr></thead>
            <tbody>
              {st.vlan.map((v) => (
                <tr key={v.v.id}>
                  <td style={S.td}><VlanChip v={v.v} /></td>
                  <td style={{ ...S.td, fontSize: 12, color: v.v.igmp ? OK : v.mcMbit ? WARN : MUTED }}>{v.v.igmp ? "an" : "aus"}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtMbit(v.mbit)}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtMbit(v.mcMbit)}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: v.flutMbit > 50 ? WARN : undefined }}>{fmtMbit(v.flutMbit)}</td>
                  <td style={{ ...S.td, textAlign: "right", fontSize: 12 }}>{v.gruppen || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="Bandbreitenrechner" subtitle="Richtwerte je Kernprotokoll. Die Rechenwege stehen im Wissen-Tab.">
        <ProtokollRechner />
      </Section>

      <Section title="Laufzeit & Hops" subtitle="Store-and-Forward-Laufzeit über Switches und die passende Dante-Latenz.">
        <LaufzeitRechner P={P} X={X} />
      </Section>

      <Section title="Analyse-Werkzeuge" right={<button style={S.smallBtn} onClick={() => goTab("wissen")}>Wissen →</button>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 20 }}>
          <table style={{ ...S.table, fontSize: 12 }}><tbody>
            {WERKZEUGE.map(([n, t]) => <tr key={n}><td style={{ ...S.td, fontWeight: 600, width: 170, verticalAlign: "top" }}>{n}</td><td style={S.td}>{t}</td></tr>)}
          </tbody></table>
          <div>
            <div className="sp-section-label">Wireshark-Filter</div>
            <table style={{ ...S.table, fontSize: 12, marginTop: 4 }}><tbody>
              {WIRESHARK.map(([n, f]) => <tr key={n}><td style={{ ...S.td, width: 130 }}>{n}</td><td style={{ ...S.td, fontFamily: "Consolas,monospace", color: "#8ec5ff" }}>{f}</td></tr>)}
            </tbody></table>
            <div className="sp-section-label" style={{ marginTop: 14 }}>Cisco Catalyst (IOS XE, Beispiele)</div>
            <table style={{ ...S.table, fontSize: 12, marginTop: 4 }}><tbody>
              {CISCO.map(([n, f]) => <tr key={n}><td style={{ ...S.td, width: 130 }}>{n}</td><td style={{ ...S.td, fontFamily: "Consolas,monospace", color: "#8ec5ff" }}>{f}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      </Section>
    </>
  );
}
