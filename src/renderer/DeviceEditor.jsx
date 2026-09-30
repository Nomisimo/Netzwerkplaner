import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, OK, katColor, TYPEN, KATEGORIEN, PORT_TYPEN } from "../shared/constants.js";
import { KATALOG_GERAETE, PROTOKOLLE, findProtokoll, newIface, newPort, uid } from "../shared/catalog.js";
import { otherEnd, suggestIp, webUrl, clone } from "../shared/model.js";
import { parsePrefix, prefixToMaskStr } from "../shared/net.js";
import { Field, Toggle, VlanSelect, VlanChip, IconPicker, StatusDot, SevBadge, Dot } from "./ui.jsx";
import { api } from "./api.js";
import StroemeEditor from "./StroemeEditor.jsx";

const Sub = ({ children, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
    <div className="sp-section-label" style={{ flex: 1, margin: 0 }}>{children}</div>
    {right}
  </div>
);

function TrunkVlans({ vlans, value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = new Set(value || []);
  const label = [...vlans].filter((v) => sel.has(v.id)).sort((a, b) => a.vid - b.vid).map((v) => v.vid).join(", ") || "keine";
  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...S.smallBtn, width: "100%", textAlign: "left" }} onClick={() => setOpen((o) => !o)} title="Erlaubte VLANs (tagged)">{label} ▾</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 40, top: "100%", right: 0, background: "#1b2026", border: `1px solid ${LINE}`, borderRadius: 8, padding: 8, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }} onMouseLeave={() => setOpen(false)}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={S.smallBtn} onClick={() => onChange(vlans.map((v) => v.id))}>alle</button>
            <button style={S.smallBtn} onClick={() => onChange([])}>keine</button>
          </div>
          {[...vlans].sort((a, b) => a.vid - b.vid).map((v) => (
            <div key={v.id} style={{ padding: "2px 0" }}>
              <Toggle checked={sel.has(v.id)} label={<><Dot color={v.farbe} size={7} /> {v.vid} {v.name}</>}
                onChange={(c) => onChange(c ? [...sel, v.id] : [...sel].filter((x) => x !== v.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DeviceEditor({ P, X, dev, mutate, status, onCheck, compact, issues = [], onSelectDevice, onDelete, onShowProto, onSaveVorlage, onSaveBestand, onUmbauen, bestand = [] }) {
  const [protoInput, setProtoInput] = useState("");
  const [showKatalog, setShowKatalog] = useState(false);
  const upd = (fn) => mutate((d) => fn(d.geraete.find((g) => g.id === dev.id), d));
  const k = dev.katalogId ? KATALOG_GERAETE.find((x) => x.id === dev.katalogId) : null;
  const url = webUrl(dev);
  const unmanaged = dev.typ === "switch_unmanaged";
  const col = katColor(dev.kategorie);
  const isRoot = X && P.layout.rootId === dev.id;

  const connOf = (p) => (X.connsByPort.get(`${dev.id}:${p.id}`) || []).map((c) => {
    const o = otherEnd(c, dev.id);
    const r = X.portRef.get(`${o.dev}:${o.port}`);
    return r ? { c, r } : null;
  }).filter(Boolean);

  const grid = compact ? "1fr 1fr" : "repeat(auto-fit,minmax(170px,1fr))";

  return (
    <div>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconPicker value={dev.icon} onChange={(v) => upd((g) => (g.icon = v))} customIcons={P.icons} color={col} />
        <input style={{ ...S.input, flex: 1, fontWeight: 700, fontSize: 15, minWidth: 0 }} value={dev.name} onChange={(e) => upd((g) => (g.name = e.target.value))} />
        <StatusDot st={status} size={11} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {dev.webUi?.vorhanden && (
          <button style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12, opacity: url ? 1 : 0.5 }} disabled={!url} title={url || "Keine IP-Adresse für die Web-UI eingetragen"}
            onClick={() => url && api.openExternal(url)}>🌐 Web-UI öffnen</button>
        )}
        <button style={S.smallBtn} onClick={() => onCheck && onCheck([dev.id])} title="Ping bzw. TCP-Prüfung auf den Web-UI-Port">⟳ Erreichbarkeit</button>
        {X && <button style={{ ...S.smallBtn, ...(isRoot ? { borderColor: ACCENT, color: ACCENT } : {}) }} onClick={() => mutate((d) => { d.layout.rootId = isRoot ? null : dev.id; })}
          title="Dieses Gerät als Mitte der Mindmap verwenden">{isRoot ? "★ Core (Mitte)" : "☆ Als Core setzen"}</button>}
        {onUmbauen && <button style={S.smallBtn} onClick={() => onUmbauen(dev.id)} title="Dieses Gerät auf ein Katalogmodell, eine eigene Vorlage oder einen Bestandseintrag umstellen. Name, Netzwerkname, IPs und Verbindungen bleiben.">⇄ Modell zuweisen</button>}
        <button style={S.smallBtn} onClick={() => onSaveVorlage && onSaveVorlage(dev)} title="Als eigene Gerätevorlage (ohne IPs) im Katalog speichern">＋ Vorlage</button>
        {onSaveBestand && (() => {
          const inB = dev.bestandId && bestand.some((b) => b.id === dev.bestandId);
          return <button style={{ ...S.smallBtn, ...(inB ? { borderColor: "#2ecc7188" } : {}) }} onClick={() => onSaveBestand(dev)}
            title={inB ? "Den Eintrag im Gerätebestand mit dem aktuellen Stand (Name, IPs, Ports …) überschreiben" : "Dieses konkrete Gerät mit Name, IPs, MACs und Ports im Gerätebestand speichern"}>{inB ? "⟳ Bestand aktualisieren" : "⇩ In Bestand"}</button>;
        })()}
        <button style={S.smallBtn} onClick={() => mutate((d) => {
          const c = clone(dev); const idMap = {};
          c.id = uid(); c.name = dev.name + " (Kopie)";
          c.interfaces.forEach((i) => { const n = uid(); idMap[i.id] = n; i.id = n; i.ip = ""; });
          c.ports.forEach((p) => { p.id = uid(); p.iface = p.iface ? idMap[p.iface] : null; });
          if (c.webUi) c.webUi.iface = idMap[c.webUi.iface] || null;
          d.geraete.push(c);
        })}>⧉ Duplizieren</button>
        <button style={{ ...S.dangerBtn, marginLeft: "auto" }} onClick={() => onDelete && onDelete(dev.id)}>🗑 Löschen</button>
      </div>

      {issues.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {issues.slice(0, 6).map((i, n) => <div key={n} style={{ fontSize: 11, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "flex-start" }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
        </div>
      )}

      {/* Allgemein */}
      <Sub>Allgemein</Sub>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10 }}>
        <Field label="Gerätetyp">
          <select style={S.selectSm} value={dev.typ} onChange={(e) => upd((g) => {
            const t = TYPEN[e.target.value];
            g.typ = e.target.value; g.isSwitch = !!t.isSwitch; g.icon = t.icon;
          })}>
            {Object.entries(TYPEN).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Bereich (Anwendung)">
          <select style={S.selectSm} value={dev.kategorie} onChange={(e) => upd((g) => (g.kategorie = e.target.value))}>
            {Object.keys(KATEGORIEN).map((key) => <option key={key}>{key}</option>)}
          </select>
        </Field>
        <Field label="Netzwerkname" hint="Name im Gerät selbst (Dante-Name, Hostname, MA-Station)"><input style={S.inputSm} value={dev.netzname || ""} placeholder={dev.name.replace(/[^A-Za-z0-9-]+/g, "-")} onChange={(e) => upd((g) => (g.netzname = e.target.value))} /></Field>
        <Field label="Hersteller"><input style={S.inputSm} value={dev.hersteller} onChange={(e) => upd((g) => (g.hersteller = e.target.value))} /></Field>
        <Field label="Modell"><input style={S.inputSm} value={dev.modell} onChange={(e) => upd((g) => (g.modell = e.target.value))} /></Field>
        <Field label="Standort / Ast">
          <input style={S.inputSm} list="np-bereiche" value={dev.bereich} onChange={(e) => upd((g) => (g.bereich = e.target.value))} placeholder="z. B. FOH" />
          <datalist id="np-bereiche">{P.bereiche.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        {dev.isSwitch
          ? <Field label="PoE-Budget (W)" hint="0 = keine Prüfung"><input type="number" min="0" style={S.inputSm} value={dev.poeBudget || 0} onChange={(e) => upd((g) => (g.poeBudget = +e.target.value))} /></Field>
          : <Field label="PoE-Bedarf (W)" hint="0 = eigenes Netzteil"><input type="number" min="0" style={S.inputSm} value={dev.poeBedarf || 0} onChange={(e) => upd((g) => (g.poeBedarf = +e.target.value))} /></Field>}
      </div>

      {/* Interfaces */}
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10, marginTop: 10 }}>
        <Field label="Inventar-Nr."><input style={S.inputSm} value={dev.inventar?.nr || ""} onChange={(e) => upd((g) => (g.inventar = { ...(g.inventar || {}), nr: e.target.value }))} /></Field>
        <Field label="Seriennummer"><input style={S.inputSm} value={dev.inventar?.sn || ""} onChange={(e) => upd((g) => (g.inventar = { ...(g.inventar || {}), sn: e.target.value }))} /></Field>
        <Field label="Case / Lagerort"><input style={S.inputSm} value={dev.inventar?.case || ""} onChange={(e) => upd((g) => (g.inventar = { ...(g.inventar || {}), case: e.target.value }))} /></Field>
      </div>

      <Sub right={<button style={S.smallBtn} onClick={() => upd((g) => g.interfaces.push(newIface({ name: `LAN ${g.interfaces.length + 1}` })))}>+ Interface</button>}>
        Netzwerk-Interfaces (IP)
      </Sub>
      {dev.interfaces.length === 0 && <div style={{ ...S.empty, padding: "4px 0" }}>Keine IP-Interfaces{unmanaged ? " (unmanaged Switch)" : ""}.</div>}
      {dev.interfaces.map((i) => {
        const v = X?.vlanById.get(i.vlan);
        const setI = (fn) => upd((g) => fn(g.interfaces.find((x) => x.id === i.id)));
        return (
          <div key={i.id} style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid ${v?.farbe || LINE}`, borderRadius: 7, padding: 10, marginBottom: 8, background: "#1f242b" }}>
            <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1.3fr 1.7fr .7fr 1.4fr 1.5fr", gap: 8, alignItems: "end" }}>
              <Field label="Name"><input style={S.inputSm} value={i.name} onChange={(e) => setI((x) => (x.name = e.target.value))} /></Field>
              <Field label="VLAN"><VlanSelect vlans={P.vlans} value={i.vlan} onChange={(val) => setI((x) => {
                x.vlan = val;
                const nv = P.vlans.find((y) => y.id === val);
                const p = nv && parsePrefix((nv.subnetz || "").split("/")[1]);
                if (p !== null && p !== undefined) x.prefix = p;
              })} /></Field>
              <Field label="IP-Adresse">
                <div style={{ display: "flex", gap: 4 }}>
                  <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={i.ip} placeholder={i.dhcp ? "DHCP" : "10.10.10.21"} onChange={(e) => setI((x) => (x.ip = e.target.value.trim()))} />
                  <button style={{ ...S.smallBtn, padding: "4px 6px" }} title="Nächste freie Adresse im VLAN vorschlagen" disabled={!v}
                    onClick={() => { const ip = suggestIp(P, v, i.id); if (ip) setI((x) => (x.ip = ip)); }}>⟳</button>
                </div>
              </Field>
              <Field label="Maske">
                <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={"/" + i.prefix} title={prefixToMaskStr(+i.prefix)}
                  onChange={(e) => { const p = parsePrefix(e.target.value); if (p !== null) setI((x) => (x.prefix = p)); }} />
              </Field>
              <Field label="Gateway"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={i.gateway} placeholder={v?.gateway || ""} onChange={(e) => setI((x) => (x.gateway = e.target.value.trim()))} /></Field>
              <Field label="MAC (optional)"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={i.mac} placeholder="00:1d:c1:…" onChange={(e) => setI((x) => (x.mac = e.target.value.trim()))} /></Field>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
              <Toggle checked={i.dhcp} onChange={(c) => setI((x) => (x.dhcp = c))} label="DHCP" />
              <span style={{ fontSize: 11, color: MUTED }}>{prefixToMaskStr(+i.prefix)}</span>
              <span style={{ fontSize: 11, color: MUTED, flex: 1 }}>{dev.ports.filter((p) => p.iface === i.id).map((p) => p.name).join(", ") && "Ports: " + dev.ports.filter((p) => p.iface === i.id).map((p) => p.name).join(", ")}</span>
              <button style={{ ...S.dangerBtn, padding: "2px 7px" }} title="Interface löschen" onClick={() => upd((g) => {
                g.interfaces = g.interfaces.filter((x) => x.id !== i.id);
                g.ports.forEach((p) => { if (p.iface === i.id) p.iface = null; });
              })}>✕</button>
            </div>
          </div>
        );
      })}

      {/* Ports */}
      <Sub right={<>
        <button style={S.smallBtn} onClick={() => upd((g) => g.ports.push(newPort({ name: g.isSwitch ? String(g.ports.length + 1) : `LAN ${g.ports.length + 1}`, iface: g.isSwitch ? null : g.interfaces[0]?.id || null })))}>+ Port</button>
        {dev.isSwitch && <button style={S.smallBtn} onClick={() => upd((g) => { for (let n = 0; n < 8; n++) g.ports.push(newPort({ name: String(g.ports.length + 1) })); })}>+ 8 Ports</button>}
      </>}>
        Physische Ports ({dev.ports.length})
      </Sub>
      {dev.isSwitch && !unmanaged && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 11, color: SUB }}>
          Alle Ports ohne Verbindung auf Access-VLAN:
          <VlanSelect vlans={P.vlans} value={null} style={{ width: 170 }} noneLabel="wählen …" onChange={(val) => val && upd((g) => g.ports.forEach((p) => {
            if (!(X.connsByPort.get(`${g.id}:${p.id}`) || []).length && p.modus !== "trunk") p.vlan = val;
          }))} />
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ ...S.table, marginTop: 0, fontSize: 12 }}>
          <thead><tr>
            <th style={S.th}>Port</th><th style={S.th}>Typ</th>
            {dev.isSwitch && !unmanaged ? <><th style={S.th}>Modus</th><th style={S.th}>VLAN</th><th style={S.th}>PoE</th></> : <th style={S.th}>Interface</th>}
            <th style={S.th} title="Punkt-zu-Punkt (AES50, SLink, HDBaseT …) – kein Ethernet">P2P</th>
            <th style={S.th}>Verbunden mit</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {dev.ports.map((p) => {
              const setP = (fn) => upd((g) => fn(g.ports.find((x) => x.id === p.id)));
              const cons = connOf(p);
              return (
                <tr key={p.id} style={{ background: cons.length > 1 ? ERR + "18" : undefined }}>
                  <td style={{ ...S.td, width: 80 }}><input style={{ ...S.inputSm, padding: "3px 6px" }} value={p.name} onChange={(e) => setP((x) => (x.name = e.target.value))} /></td>
                  <td style={{ ...S.td, width: 92 }}><select style={{ ...S.selectSm, padding: "3px 4px" }} value={p.typ} onChange={(e) => setP((x) => (x.typ = e.target.value))}>{PORT_TYPEN.map((t) => <option key={t}>{t}</option>)}</select></td>
                  {dev.isSwitch && !unmanaged ? <>
                    <td style={{ ...S.td, width: 84 }}><select style={{ ...S.selectSm, padding: "3px 4px" }} value={p.modus} onChange={(e) => setP((x) => (x.modus = e.target.value))}><option value="access">Access</option><option value="trunk">Trunk</option></select></td>
                    <td style={{ ...S.td, minWidth: 120 }}>{p.modus === "trunk"
                      ? <TrunkVlans vlans={P.vlans} value={p.vlans} onChange={(val) => setP((x) => (x.vlans = val))} />
                      : <VlanSelect vlans={P.vlans} value={p.vlan} onChange={(val) => setP((x) => (x.vlan = val))} style={{ padding: "3px 4px" }} noneLabel="– default –" />}</td>
                    <td style={S.td}><input type="checkbox" checked={!!p.poe} style={{ accentColor: ACCENT }} onChange={(e) => setP((x) => (x.poe = e.target.checked))} /></td>
                  </> : (
                    <td style={{ ...S.td, minWidth: 100 }}>
                      <select style={{ ...S.selectSm, padding: "3px 4px" }} value={p.iface || ""} onChange={(e) => setP((x) => (x.iface = e.target.value || null))}>
                        <option value="">–</option>
                        {dev.interfaces.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </td>
                  )}
                  <td style={S.td}><input type="checkbox" checked={!!p.p2p} style={{ accentColor: ACCENT }} onChange={(e) => setP((x) => (x.p2p = e.target.checked))} /></td>
                  <td style={{ ...S.td, fontSize: 11 }}>
                    {cons.length === 0 && <span style={{ color: MUTED }}>frei</span>}
                    {cons.map(({ r, c }) => (
                      <div key={c.id}><a style={{ color: "#c8d0d8", cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => onSelectDevice && onSelectDevice(r.dev.id)}>{r.dev.name}</a> <span style={{ color: MUTED }}>[{r.port.name}]</span></div>
                    ))}
                  </td>
                  <td style={{ ...S.td, width: 30 }}><button style={{ ...S.dangerBtn, padding: "1px 6px" }} title="Port löschen (inkl. Verbindung)" onClick={() => mutate((d) => {
                    const g = d.geraete.find((x) => x.id === dev.id);
                    g.ports = g.ports.filter((x) => x.id !== p.id);
                    d.verbindungen = d.verbindungen.filter((c) => !((c.a.dev === dev.id && c.a.port === p.id) || (c.b.dev === dev.id && c.b.port === p.id)));
                  })}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Web-UI */}
      <Sub>Web-UI & Erreichbarkeit</Sub>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "auto 2fr 1fr", gap: 10, alignItems: "end" }}>
        <Toggle checked={dev.webUi?.vorhanden} onChange={(c) => upd((g) => (g.webUi = { ...g.webUi, vorhanden: c }))} label="Gerät hat eine Web-UI" />
        {dev.webUi?.vorhanden && <>
          <Field label="URL" hint="{ip} wird durch die IP des gewählten Interfaces ersetzt, z. B. https://{ip}:8443">
            <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={dev.webUi.url} onChange={(e) => upd((g) => (g.webUi.url = e.target.value))} />
          </Field>
          <Field label="über Interface">
            <select style={S.selectSm} value={dev.webUi.iface || ""} onChange={(e) => upd((g) => (g.webUi.iface = e.target.value || null))}>
              <option value="">erstes mit IP</option>
              {dev.interfaces.map((i) => <option key={i.id} value={i.id}>{i.name} {i.ip && `(${i.ip})`}</option>)}
            </select>
          </Field>
        </>}
      </div>
      {dev.webUi?.vorhanden && <div style={{ ...S.hint, marginTop: 6 }}>Link: {url ? <a style={{ color: ACCENT, cursor: "pointer" }} onClick={() => api.openExternal(url)}>{url}</a> : "– (IP fehlt)"}</div>}
      {status && <div style={{ ...S.hint, marginTop: 4 }}>Letzte Prüfung: {status.ok === null ? status.method : status.ok ? `erreichbar per ${status.method} (${status.ms} ms)` : `keine Antwort (${status.method})`} {status.t && `· ${new Date(status.t).toLocaleTimeString("de-DE")}`}</div>}

      {/* Protokolle */}
      <Sub>Protokolle</Sub>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {(dev.protokolle || []).map((s, n) => {
          const r = findProtokoll(s);
          return (
            <span key={n} style={{ ...S.chip, borderColor: r ? (r.flags.p2p ? ERR + "88" : ACCENT + "66") : LINE, cursor: r ? "pointer" : "default" }}
              title={r ? `${r.name}\nPorts: ${r.raw.Ports}\nÜber Switch: ${r.raw["Über Switch / routbar?"]}` : "Nicht in der Protokollrecherche"}
              onClick={() => r && onShowProto && onShowProto(r.id)}>
              {r?.flags.p2p && "⛓ "}{s}
              <span style={{ color: MUTED, cursor: "pointer", marginLeft: 2 }} onClick={(e) => { e.stopPropagation(); upd((g) => g.protokolle.splice(n, 1)); }}>✕</span>
            </span>
          );
        })}
        <form onSubmit={(e) => { e.preventDefault(); if (protoInput.trim()) { upd((g) => (g.protokolle = [...(g.protokolle || []), protoInput.trim()])); setProtoInput(""); } }} style={{ display: "inline-flex" }}>
          <input list="np-protos" style={{ ...S.inputSm, width: 170, padding: "2px 8px", fontSize: 11 }} placeholder="+ Protokoll" value={protoInput} onChange={(e) => setProtoInput(e.target.value)} />
          <datalist id="np-protos">{PROTOKOLLE.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </form>
      </div>
      <div style={{ ...S.hint, marginTop: 6 }}>⛓ = Punkt-zu-Punkt-Protokoll, läuft nicht über Switches. Klick auf ein Protokoll zeigt Ports und Anforderungen.</div>

      {/* Datenströme */}
      {!dev.isSwitch && X && <>
        <Sub>Datenströme</Sub>
        <StroemeEditor P={P} X={X} dev={dev} upd={upd} />
      </>}

      {/* Katalog */}
      {k && <>
        <Sub right={<button style={S.smallBtn} onClick={() => setShowKatalog((s) => !s)}>{showKatalog ? "ausblenden" : "anzeigen"}</button>}>Katalogdaten</Sub>
        {showKatalog && (
          <table style={{ ...S.table, marginTop: 0, fontSize: 12 }}><tbody>
            {["Gerätetyp", "Funktion", "Netzwerkports (Details)", "Weitere Anschlüsse", "Protokolle", "Web-UI", "PoE", "Konfiguration / Software", "Hinweis"].map((f) => k.raw[f] ? (
              <tr key={f}><td style={{ ...S.td, color: SUB, width: 150, verticalAlign: "top" }}>{f}</td><td style={S.td}>{k.raw[f]}</td></tr>
            ) : null)}
          </tbody></table>
        )}
      </>}

      <Sub>Notizen</Sub>
      <textarea style={{ ...S.inputSm, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={dev.notizen} onChange={(e) => upd((g) => (g.notizen = e.target.value))} />
    </div>
  );
}
