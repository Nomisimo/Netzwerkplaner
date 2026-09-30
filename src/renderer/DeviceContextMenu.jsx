import React, { useEffect, useRef, useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, TYPEN, katColor } from "../shared/constants.js";
import { webUrl, mainIp } from "../shared/model.js";
import { KERN_BY_ID, streamRate } from "../shared/kernprotokolle.js";
import { fmtMbit } from "../shared/analyse.js";
import { IconView } from "./icons.jsx";
import { Dot } from "./ui.jsx";
import { portLabel, portBelegung, vlanKurz, vlanLang } from "./portinfo.js";
import { api } from "./api.js";
import { ipPorts } from "../shared/catalog.js";

const W = 400;
const Row = ({ k, children }) => (
  <div style={{ display: "flex", gap: 8, fontSize: 12, padding: "1px 0" }}>
    <span style={{ color: MUTED, width: 78, flexShrink: 0 }}>{k}</span><span style={{ color: "#dfe3e8", minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
  </div>
);
const Head = ({ children }) => <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: SUB, margin: "10px 0 4px", fontWeight: 700 }}>{children}</div>;

/* Kontextmenü (Rechtsklick) mit allen wichtigen Infos zu einem Gerät */
export default function DeviceContextMenu({ P, X, dev, x, y, status, issues = [], onClose, onEdit, onCheck, onDelete, onSetRoot, onToggleCollapse, collapsed, pinned, onPin, onUnstack, onEditStack }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [kopiert, setKopiert] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    setPos({ left: Math.max(8, Math.min(x, vw - W - 8)), top: Math.max(8, Math.min(y, vh - h - 8)) });
  }, [x, y, dev.id]);
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", down, true);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => { window.removeEventListener("mousedown", down, true); window.removeEventListener("keydown", key); window.removeEventListener("resize", onClose); };
  }, [onClose]);

  const col = katColor(dev.kategorie);
  const url = webUrl(dev);
  const ip = mainIp(dev);
  const belegt = portBelegung(dev, X);
  const stroeme = dev.stroeme || [];
  const copy = (t, what) => { try { navigator.clipboard.writeText(t); setKopiert(what); setTimeout(() => setKopiert(""), 1200); } catch { /* ohne Zwischenablage */ } };
  const act = (fn) => () => { onClose(); fn && fn(); };
  const stTxt = !status ? "nicht geprüft" : status.ok ? `erreichbar (${status.method}, ${status.ms} ms)` : status.ok === false ? `nicht erreichbar (${status.method})` : status.method;
  const stCol = !status || status.ok == null ? MUTED : status.ok ? OK : ERR;

  return (
    <div ref={ref} className="np-ctx" onContextMenu={(e) => e.preventDefault()} onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", zIndex: 200, left: pos.left, top: pos.top, width: W, maxHeight: "80vh", overflowY: "auto", background: "#1b2026", border: `1px solid ${LINE}`, borderTop: `3px solid ${col}`, borderRadius: 10, boxShadow: "0 12px 36px rgba(0,0,0,.6)", color: "#e8eaed" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px 6px" }}>
        <div style={{ background: col + "1f", borderRadius: 8, padding: 6, display: "flex" }}><IconView icon={dev.icon} customIcons={P.icons} color={col} size={26} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{dev.name}</div>
          <div style={{ fontSize: 11, color: SUB }}>{[dev.hersteller, dev.modell].filter(Boolean).join(" ") || TYPEN[dev.typ]?.label}</div>
        </div>
        <span title={stTxt} style={{ width: 10, height: 10, borderRadius: 5, background: stCol }} />
      </div>

      <div style={{ padding: "0 12px 10px" }}>
        {dev.netzname && <Row k="Netzname">{dev.netzname}</Row>}
        {(dev.felder || []).filter((f) => f.wert).map((f) => <Row key={f.id} k={f.name}>{f.wert}</Row>)}
        <Row k="Bereich">{dev.kategorie}{dev.bereich ? ` · ${dev.bereich}` : ""}</Row>
        <Row k="Status"><span style={{ color: stCol }}>{stTxt}</span></Row>
        {url && <Row k="Web-UI"><a href="#" style={{ color: "#8ec5ff" }} onClick={(e) => { e.preventDefault(); api.openExternal(url); }}>{url}</a></Row>}
        {dev.isSwitch && dev.poeBudget > 0 && <Row k="PoE-Budget">{dev.poeBudget} W</Row>}
        {!dev.isSwitch && dev.poeBedarf > 0 && <Row k="PoE-Bedarf">{dev.poeBedarf} W</Row>}

        {ipPorts(dev).some((i) => i.ip || i.dhcp || i.virtuell) && <>
          <Head>IP-Adressen</Head>
          {ipPorts(dev).filter((i) => i.ip || i.dhcp || i.virtuell).map((i) => {
            const v = X.vlanById.get(i.vlan);
            return (
              <div key={i.id} style={{ display: "grid", gridTemplateColumns: "78px 1fr auto", gap: 8, fontSize: 12, padding: "2px 0", alignItems: "baseline" }}>
                <span style={{ color: MUTED }}>{i.name}</span>
                <span style={{ fontFamily: "Consolas,monospace", cursor: i.ip ? "copy" : "default" }} title={i.ip ? "Klick kopiert die IP" : ""} onClick={() => i.ip && copy(i.ip, i.id)}>
                  {i.dhcp ? "DHCP" : i.ip ? `${i.ip}/${i.prefix}` : "–"}{kopiert === i.id && <span style={{ color: OK, fontFamily: "inherit" }}> kopiert</span>}
                  {i.mac && <div style={{ fontSize: 10, color: MUTED }}>{i.mac}</div>}
                </span>
                <span>{v ? <span style={{ ...S.chip, borderColor: v.farbe + "88", padding: "0 6px" }}><Dot color={v.farbe} size={7} /> {v.vid} {v.name}</span> : <span style={{ color: MUTED }}>–</span>}</span>
              </div>
            );
          })}
        </>}

        {belegt.length > 0 && <>
          <Head>Ports ({belegt.filter((b) => b.c).length}/{belegt.length} belegt)</Head>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <tbody>
              {belegt.filter((b) => b.c || !dev.isSwitch).map(({ port, c, self, other }) => {
                const v = self?.vlans[0];
                return (
                  <tr key={port.id} style={{ borderTop: "1px solid #262d36" }}>
                    <td style={{ padding: "3px 4px 3px 0", whiteSpace: "nowrap", fontWeight: 600 }}>{portLabel(port)}<div style={{ fontSize: 10, color: MUTED, fontWeight: 400 }}>{port.typ}{port.poe ? " · PoE" : ""}</div></td>
                    <td style={{ padding: "3px 4px" }}>
                      {c ? <>→ <b>{other?.dev.name}</b> <span style={{ color: MUTED }}>{portLabel(other?.port)}</span></> : <span style={{ color: MUTED }}>frei</span>}
                      {c?.label && <div style={{ fontSize: 10, color: MUTED }}>{c.label}</div>}
                    </td>
                    <td style={{ padding: "3px 0", textAlign: "right", whiteSpace: "nowrap" }} title={vlanLang(self)}>
                      {self && (self.kind === "trunk"
                        ? <span style={{ ...S.chip, padding: "0 6px", borderColor: "#d8dde3" }}>{vlanKurz(self)}</span>
                        : v ? <span style={{ ...S.chip, padding: "0 6px", borderColor: v.farbe + "88" }}><Dot color={v.farbe} size={7} /> {v.vid}</span> : <span style={{ color: MUTED }}>–</span>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dev.isSwitch && belegt.some((b) => !b.c) && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>Frei: {belegt.filter((b) => !b.c).map((b) => portLabel(b.port)).join(", ")}</div>}
        </>}

        {(dev.protokolle || []).length > 0 && <>
          <Head>Protokolle</Head>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{dev.protokolle.map((p, n) => <span key={n} style={{ ...S.chip, fontSize: 11 }}>{p}</span>)}</div>
        </>}

        {stroeme.length > 0 && <>
          <Head>Datenströme</Head>
          {stroeme.map((s) => {
            const k = KERN_BY_ID[s.proto];
            return k ? <Row key={s.id} k={k.name}>{s.menge} {k.einheit}{s.mc ? " · Multicast" : ""} · <b style={{ fontFamily: "monospace" }}>{fmtMbit(streamRate(s).mbit || 0)}</b></Row> : null;
          })}
        </>}

        {issues.length > 0 && <>
          <Head>Prüfung</Head>
          {issues.slice(0, 6).map((i, n) => <div key={n} style={{ fontSize: 11.5, color: i.sev === "error" ? ERR : i.sev === "warn" ? WARN : SUB, padding: "1px 0" }}>• {i.msg}</div>)}
          {issues.length > 6 && <div style={{ fontSize: 11, color: MUTED }}>… und {issues.length - 6} weitere</div>}
        </>}
        {dev.notizen && <><Head>Notizen</Head><div style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#c8d0d8" }}>{dev.notizen}</div></>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 12px", borderTop: `1px solid ${LINE}`, background: "#171b20", borderRadius: "0 0 10px 10px" }}>
        {onEdit && <button style={S.smallBtn} onClick={act(onEdit)}>✎ Bearbeiten</button>}
        {url && <button style={S.smallBtn} onClick={act(() => api.openExternal(url))}>🌐 Web-UI</button>}
        {ip && <button style={S.smallBtn} onClick={() => copy(ip, "main")}>{kopiert === "main" ? "✓ kopiert" : "IP kopieren"}</button>}
        {onCheck && ip && <button style={S.smallBtn} onClick={act(() => onCheck([dev.id]))}>⟳ Status</button>}
        {onToggleCollapse && <button style={S.smallBtn} onClick={act(onToggleCollapse)}>{collapsed ? "Ast ausklappen" : "Ast einklappen"}</button>}
        {onPin && <button style={S.smallBtn} onClick={act(onPin)} title="Angepinnte Geräte bleiben beim automatischen Anordnen stehen (Taste P)">{pinned ? "📌 Lösen" : "📌 Anpinnen"}</button>}
        {onEditStack && <button style={S.smallBtn} onClick={act(onEditStack)}>▤ Stapel bearbeiten</button>}
        {onUnstack && <button style={S.smallBtn} onClick={act(onUnstack)}>Aus Stapel lösen</button>}
        {onSetRoot && <button style={S.smallBtn} onClick={act(onSetRoot)}>Als Core</button>}
        <span style={{ flex: 1 }} />
        {onDelete && <button style={{ ...S.dangerBtn, padding: "3px 8px" }} onClick={act(onDelete)}>Löschen</button>}
      </div>
    </div>
  );
}
