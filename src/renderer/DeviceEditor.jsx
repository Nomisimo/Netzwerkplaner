import React, { useState } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, OK, PANEL, katColor, TYPEN, KATEGORIEN, PORT_TYPEN, CARD, INPUT, LINK, TEXT2, STRONG } from "../shared/constants.js";
import { KATALOG_GERAETE, PROTOKOLLE, findProtokoll, newPort, ipPorts, physPorts, uid, hardwareFest } from "../shared/catalog.js";
import { portSeiten } from "../shared/anschluesse.js";
import { otherEnd, suggestIp, webUrl, clone, vlanQuelle } from "../shared/model.js";
import { parsePrefix, prefixToMaskStr } from "../shared/net.js";
import { normMac, macHersteller, herstellerPasst } from "../shared/mac.js";
import { Field, Toggle, VlanSelect, VlanChip, IconPicker, StatusDot, SevBadge, Dot, frageText, AuswahlFeld } from "./ui.jsx";
import { api } from "./api.js";
import StroemeEditor from "./StroemeEditor.jsx";
import { KonfigKopieren, KonfigEinfuegen } from "./KonfigDialog.jsx";
import { useZwischenablage } from "./zwischenablage.js";
import { useVlanZuweisen, setVlanZuweisen } from "./vlanZuweisen.js";
import { geraetKopie } from "../shared/konfig.js";
import { newFeld } from "../shared/felder.js";
import { X as XIcon, ChevronDown, RefreshCw, ArrowLeftRight, Plus, Trash2, Globe, Star, Download, Copy, CopyPlus, ClipboardPaste, Lock, Link } from "lucide-react";

/* Eigene Felder aus dem Katalog (Katalog → Eigene Felder) einfügen und ausfüllen */
function EigeneFelder({ dev, katalog, upd, grid }) {
  const felder = dev.felder || [];
  const frei = katalog.filter((f) => !felder.some((x) => x.id === f.id));
  const einfuegen = (id) => {
    if (id === "__neu") {
      frageText("Name des neuen Felds (steht danach im Katalog unter „Eigene Felder“):", "", "Neues Feld").then((name) => {
      if (!name?.trim()) return;
      const vorhanden = katalog.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
      if (vorhanden && felder.some((x) => x.id === vorhanden.id)) return;
      const f = vorhanden || newFeld(name);
      upd((g) => { g.felder = [...(g.felder || []), { id: f.id, name: f.name, wert: "" }]; });
      });
      return;
    }
    const f = katalog.find((x) => x.id === id);
    if (f) upd((g) => { g.felder = [...(g.felder || []), { id: f.id, name: f.name, wert: "" }]; });
  };
  return (
    <>
      <Sub right={
        <select style={{ ...S.selectSm, width: "auto" }} value="" onChange={(e) => einfuegen(e.target.value)} title="Feld aus dem Katalog einfügen">
          <option value="">+ Feld …</option>
          {frei.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          <option value="__neu">Neues Feld anlegen …</option>
        </select>
      }>Eigene Felder</Sub>
      {!felder.length && <div style={{ ...S.empty, padding: "4px 0" }}>Keine eigenen Felder. Mit „+ Feld …“ ein Feld aus dem Katalog einfügen, z. B. Inventar-Nr. oder Seriennummer.</div>}
      {felder.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10 }}>
          {felder.map((f) => (
            <Field key={f.id} label={f.name}>
              <div style={{ display: "flex", gap: 4 }}>
                <input style={S.inputSm} value={f.wert || ""} onChange={(e) => upd((g) => { const x = g.felder.find((y) => y.id === f.id); if (x) x.wert = e.target.value; })} />
                <button style={{ ...S.smallBtn, padding: "4px 7px" }} title="Feld aus diesem Gerät entfernen" onClick={() => upd((g) => { g.felder = g.felder.filter((y) => y.id !== f.id); })}><XIcon size={12} /></button>
              </div>
            </Field>
          ))}
        </div>
      )}
    </>
  );
}

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
      <button style={{ ...S.smallBtn, width: "100%", textAlign: "left" }} onClick={() => setOpen((o) => !o)} title="Erlaubte VLANs (tagged)">{label} <ChevronDown size={12} /></button>
      {open && (
        <div style={{ position: "absolute", zIndex: 40, top: "100%", right: 0, background: INPUT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 8, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }} onMouseLeave={() => setOpen(false)}>
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

const Gegenstellen = ({ cons, onSelectDevice }) => <>
  {cons.length === 0 && <span style={{ color: MUTED }}>frei</span>}
  {cons.map(({ r, c }) => (
    <div key={c.id}><a style={{ color: TEXT2, cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => onSelectDevice && onSelectDevice(r.dev.id)}>{r.dev.name}</a> <span style={{ color: MUTED }}>[{r.port.name}]</span></div>
  ))}
</>;

const festStil = (an) => (an ? { opacity: 0.6, cursor: "not-allowed" } : {});
const FEST_TIP = "Fest durch das Modell aus Katalog bzw. Gerätebestand. Ändern über „Modell zuweisen“ oder im Katalog.";

const PortLoeschen = ({ dev, p, mutate }) => (
  <button style={{ ...S.dangerBtn, padding: "1px 6px" }} title={p.virtuell ? "Management-Interface löschen" : "Port löschen (inkl. Verbindung)"} onClick={() => mutate((d) => {
    const g = d.geraete.find((x) => x.id === dev.id);
    g.ports = g.ports.filter((x) => x.id !== p.id);
    if (g.webUi?.iface === p.id) g.webUi.iface = null;
    for (const s of g.stroeme || []) if (s.iface === p.id) s.iface = null;
    d.verbindungen = d.verbindungen.filter((c) => !((c.a.dev === dev.id && c.a.port === p.id) || (c.b.dev === dev.id && c.b.port === p.id)));
  })}><XIcon size={12} /></button>
);

/* VLAN eines Endgeräte-Ports: nur Anzeige, es kommt vom Switch-Port (oder aus dem Subnetz der IP) */
function VlanVomSwitch({ P, X, dev, p, v, onSelectDevice }) {
  const q = X ? vlanQuelle(P, X, dev, p) : null;
  const sw = q?.sw ? <a href="#" style={{ color: LINK }} onClick={(e) => { e.preventDefault(); onSelectDevice?.(q.sw.id); }}>{q.sw.name} · {q.swPort.name}</a> : null;
  const text = q?.art === "switch" ? <>von {sw}</>
    : q?.art === "switch-ohne" ? <>{sw} hat kein VLAN</>
    : q?.art === "ip" ? <>aus der IP{sw ? <> (Trunk {sw})</> : ""}</>
    : q?.art === "trunk" ? <>Trunk {sw}</>
    : "nicht gesteckt";
  return (
    <Field label="VLAN">
      <div style={{ ...S.inputSm, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 30, padding: "3px 8px", background: "#ffffff06", cursor: "default" }} title="VLANs werden nur an Switch-Ports eingestellt. Das Endgerät übernimmt das VLAN des Ports, an dem es steckt. Steckt es nirgends, gilt das VLAN, in dessen Subnetz die IP liegt.">
        {v ? <span style={{ fontSize: 12 }}><Dot color={v.farbe} size={7} /> {v.vid} {v.name}</span> : <span style={{ fontSize: 12, color: MUTED }}>kein VLAN</span>}
        <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
      </div>
    </Field>
  );
}

/* Port eines Endgeräts oder Management-Interface eines Switches: Anschluss und IP-Daten in einem */
// Hersteller zur MAC unter dem Eingabefeld; warnt, wenn die MAC nicht zum Hersteller im Plan passt
function MacInfo({ mac, hersteller }) {
  if (!mac) return null;
  const h = macHersteller(mac);
  if (h.art === "ungueltig") return <div style={{ fontSize: 10, color: ERR, marginTop: 2 }}>Kein gültiges MAC-Format</div>;
  const passt = herstellerPasst(hersteller, mac);
  const text = h.art === "hersteller" ? h.name : h.art === "lokal" ? "privat/zufällig vergeben, kein Hersteller" : h.art === "multicast" ? "Multicast-Adresse, kein Gerät" : "Hersteller unbekannt";
  return (
    <div style={{ fontSize: 10, color: passt === false ? ERR : MUTED, marginTop: 2 }} title={passt === false ? `Im Plan steht „${hersteller}“` : undefined}>
      {text}{passt === false ? ` (Plan: ${hersteller})` : ""}
    </div>
  );
}

function IpPort({ P, X, dev, p, upd, mutate, compact, cons, onSelectDevice, fest, pst }) {
  const hw = fest && !p.virtuell; // Buchse aus dem Modell: Name, Typ und P2P fest
  const v = X?.vlanById.get(p.vlan);
  const setP = (fn) => upd((g) => fn(g.ports.find((x) => x.id === p.id)));
  const ip = !p.p2p; // Punkt-zu-Punkt-Ports (AES50, SLink …) haben keine IP
  return (
    <div style={{ border: `1px solid ${cons.length > 1 ? ERR : LINE}`, borderLeft: `3px solid ${ip && v?.farbe || LINE}`, borderRadius: 7, padding: 10, marginBottom: 8, background: CARD }}>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : ip ? "1.3fr 1.3fr 1.7fr .6fr 1.3fr 1.4fr" : "1.3fr 1.3fr 3fr", gap: 8, alignItems: "end" }}>
        <Field label={p.virtuell ? "Name" : "Port"} hint={p.virtuell ? "ohne Buchse" : undefined}><input style={{ ...S.inputSm, ...festStil(hw) }} value={p.name} maxLength={10} readOnly={hw} title={hw ? FEST_TIP : "Höchstens 10 Zeichen"} onChange={(e) => setP((x) => (x.name = e.target.value.slice(0, 10)))} /></Field>
        {ip ? <>
          {dev.isSwitch ? <Field label="VLAN"><VlanSelect vlans={P.vlans} value={p.vlan} onChange={(val) => setP((x) => {
            x.vlan = val;
            const nv = P.vlans.find((y) => y.id === val);
            const pr = nv && parsePrefix((nv.subnetz || "").split("/")[1]);
            if (pr !== null && pr !== undefined) x.prefix = pr;
          })} /></Field> : <VlanVomSwitch P={P} X={X} dev={dev} p={p} v={v} onSelectDevice={onSelectDevice} />}
          <Field label="IP-Adresse">
            <div style={{ display: "flex", gap: 4 }}>
              <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={p.ip} placeholder={p.dhcp ? "DHCP" : "10.10.10.21"} onChange={(e) => setP((x) => (x.ip = e.target.value.trim()))} />
              <button style={{ ...S.smallBtn, padding: "4px 6px" }} title="Nächste freie Adresse im VLAN vorschlagen" disabled={!v}
                onClick={() => { const a = suggestIp(P, v, p.id); if (a) setP((x) => (x.ip = a)); }}><RefreshCw size={12} /></button>
            </div>
          </Field>
          <Field label="Maske">
            <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={"/" + p.prefix} title={prefixToMaskStr(+p.prefix)}
              onChange={(e) => { const pr = parsePrefix(e.target.value); if (pr !== null) setP((x) => (x.prefix = pr)); }} />
          </Field>
          <Field label="Gateway"><input style={{ ...S.inputSm, fontFamily: "monospace" }} value={p.gateway} placeholder={v?.gateway || ""} onChange={(e) => setP((x) => (x.gateway = e.target.value.trim()))} /></Field>
          <Field label="MAC (optional)">
            <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={p.mac} placeholder="00:1d:c1:…" onChange={(e) => setP((x) => (x.mac = e.target.value.trim()))}
              onBlur={() => { const m = normMac(p.mac); if (m && m !== p.mac) setP((x) => (x.mac = m)); }} />
            <MacInfo mac={p.mac} hersteller={dev.hersteller} />
          </Field>
        </> : <>
          <Field label="Typ"><select style={S.selectSm} value={p.typ} disabled={hw} title={hw ? FEST_TIP : undefined} onChange={(e) => setP((x) => (x.typ = e.target.value))}>{PORT_TYPEN.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Verbunden mit"><div style={{ fontSize: 11, padding: "4px 0" }}><Gegenstellen cons={cons} onSelectDevice={onSelectDevice} /></div></Field>
        </>}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        {ip && <Toggle checked={p.dhcp} onChange={(c) => setP((x) => (x.dhcp = c))} label="DHCP" />}
        {ip && <span style={{ fontSize: 11, color: MUTED }}>{prefixToMaskStr(+p.prefix)}</span>}
        {ip && p.ip && pst && pst.ip === p.ip && pst.ok != null && <span style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, color: pst.ok ? OK : MUTED }}
          title={`Letzte Prüfung ${new Date(pst.t).toLocaleTimeString("de-DE")}`}><Dot color={pst.ok ? OK : MUTED} size={7} />{pst.ok ? `antwortet (${pst.method}, ${pst.ms} ms)` : "keine Antwort"}</span>}
        {!p.virtuell && ip && <select style={{ ...S.selectSm, width: 100, padding: "2px 4px" }} value={p.typ} disabled={hw} title={hw ? FEST_TIP : "Porttyp"} onChange={(e) => setP((x) => (x.typ = e.target.value))}>{PORT_TYPEN.map((t) => <option key={t}>{t}</option>)}</select>}
        {!p.virtuell && <SeiteSelect dev={dev} p={p} setP={setP} style={{ width: 110, padding: "2px 4px" }} />}
        {!p.virtuell && <Toggle checked={!!p.p2p} disabled={hw} title={hw ? FEST_TIP : undefined} onChange={(c) => setP((x) => (x.p2p = c))} label="P2P" />}
        <span style={{ fontSize: 11, flex: 1 }}>{!p.virtuell && ip && <Gegenstellen cons={cons} onSelectDevice={onSelectDevice} />}</span>
        {!hw && <PortLoeschen dev={dev} p={p} mutate={mutate} />}
      </div>
    </div>
  );
}

/* Generisches Gerät (per Discovery oder Scan gefunden): leere Maske mit den
   Fundangaben und nur zwei Wegen weiter, Modell zuweisen oder leeres Gerät eines Typs. */
/* Geräteseite eines Ports: Auto (aus der Recherche) oder fest vorne/hinten */
function SeiteSelect({ dev, p, setP, style }) {
  const auto = portSeiten({ ...dev, ports: dev.ports.map((x) => (x.id === p.id ? { ...x, seite: undefined } : x)) }).get(p.id);
  return (
    <select style={{ ...S.selectSm, padding: "3px 4px", ...style }} value={p.seite || ""} title="Auf welcher Geräteseite liegt die Buchse? Auto = laut Herstellerangaben"
      onChange={(e) => setP((x) => { if (e.target.value) x.seite = e.target.value; else delete x.seite; })}>
      <option value="">{auto ? `auto (${auto === "vorne" ? "V" : "H"})` : "auto"}</option><option value="vorne">vorne</option><option value="hinten">hinten</option>
    </select>
  );
}

function GenerischeMaske({ dev, status, upd, onUmbauen, onTypWaehlen, onDelete, onCheck }) {
  const [typ, setTyp] = useState(null);
  const ifc = ipPorts(dev).find((i) => i.ip) || ipPorts(dev)[0];
  const zeile = (l, v) => v ? <div style={{ display: "flex", gap: 10, fontSize: 12, padding: "3px 0" }}><span style={{ color: MUTED, width: 80 }}>{l}</span><span style={{ fontFamily: "ui-monospace,monospace", wordBreak: "break-all" }}>{v}</span></div> : null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input style={{ ...S.input, flex: 1, fontWeight: 700, fontSize: 15, minWidth: 0 }} value={dev.name} onChange={(e) => upd((g) => (g.name = e.target.value))} />
        <StatusDot st={status} size={11} />
      </div>
      <div style={{ marginTop: 10, padding: "8px 10px", border: `1px dashed ${LINE}`, borderRadius: 8 }}>
        <div className="sp-section-label" style={{ margin: "0 0 6px" }}>Generisches Gerät</div>
        {zeile("IP", ifc?.ip)}
        {zeile("MAC", ifc?.mac)}
        {zeile("Protokolle", (dev.protokolle || []).join(", "))}
        {zeile("Hinweis", dev.notizen)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {onUmbauen && <button style={{ ...S.primaryBtn, padding: "8px 10px" }} onClick={() => onUmbauen(dev.id)}
          title="Katalogmodell, eigene Vorlage oder Bestandseintrag wählen. Name, IP und Verbindungen bleiben."><ArrowLeftRight size={14} /> Modell zuweisen</button>}
        {typ === null
          ? <button style={{ ...S.smallBtn, padding: "8px 10px" }} onClick={() => setTyp(dev.typVorschlag || "sonstiges")}><Plus size={14} /> Leeres Gerät anlegen</button>
          : <div style={{ display: "flex", gap: 6 }}>
              <select style={{ ...S.selectSm, flex: 1 }} value={typ} onChange={(e) => setTyp(e.target.value)} autoFocus>
                {Object.entries(TYPEN).map(([key, t]) => <option key={key} value={key}>{t.label}{key === dev.typVorschlag ? " (Vorschlag)" : ""}</option>)}
              </select>
              <button style={S.primaryBtn} onClick={() => onTypWaehlen && onTypWaehlen(dev.id, typ)}>Anlegen</button>
              <button style={S.smallBtn} onClick={() => setTyp(null)}><XIcon size={14} /></button>
            </div>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        <button style={S.smallBtn} onClick={() => onCheck && onCheck([dev.id])}><RefreshCw size={14} /> Erreichbarkeit</button>
        <button style={{ ...S.dangerBtn, marginLeft: "auto" }} onClick={() => onDelete && onDelete(dev.id)}><Trash2 size={14} /> Löschen</button>
      </div>
    </div>
  );
}

export default function DeviceEditor({ P, X, dev, mutate, status, onCheck, compact, issues = [], onClose, kopfAbstand = 0, onSelectDevice, onDelete, onShowProto, onSaveVorlage, onSaveBestand, onUmbauen, onTypWaehlen, bestand = [] }) {
  const [protoInput, setProtoInput] = useState("");
  const [showKatalog, setShowKatalog] = useState(false);
  const [konfigDlg, setKonfigDlg] = useState(null);
  const konfigClip = useZwischenablage("konfig");
  const upd = (fn) => mutate((d) => fn(d.geraete.find((g) => g.id === dev.id), d));
  const k = dev.katalogId ? KATALOG_GERAETE.find((x) => x.id === dev.katalogId) : null;
  const url = webUrl(dev);
  const unmanaged = dev.typ === "switch_unmanaged";
  const col = katColor(dev.kategorie);
  const isRoot = X && P.layout.rootId === dev.id;
  const fest = hardwareFest(dev);

  const connOf = (p) => (X.connsByPort.get(`${dev.id}:${p.id}`) || []).map((c) => {
    const o = otherEnd(c, dev.id);
    const r = X.portRef.get(`${o.dev}:${o.port}`);
    return r ? { c, r } : null;
  }).filter(Boolean);

  const grid = compact ? "1fr 1fr" : "repeat(auto-fit,minmax(170px,1fr))";

  if (dev.generisch) return <GenerischeMaske dev={dev} status={status} upd={upd} onUmbauen={onUmbauen} onTypWaehlen={onTypWaehlen} onDelete={onDelete} onCheck={onCheck} />;

  return (
    <div>
      {/* Kopf: bleibt beim Scrollen oben stehen (Icon, Name, Status, Schließen) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "sticky", top: -kopfAbstand, zIndex: 4, background: PANEL, padding: `${kopfAbstand}px 0 8px`, marginTop: -kopfAbstand, borderBottom: `1px solid ${LINE}`, boxShadow: "0 6px 8px -6px #0008" }}>
        <IconPicker value={dev.icon} onChange={(v) => upd((g) => (g.icon = v))} customIcons={P.icons} color={col} />
        <input style={{ ...S.input, flex: 1, fontWeight: 700, fontSize: 15, minWidth: 0 }} value={dev.name} onChange={(e) => upd((g) => (g.name = e.target.value))} />
        <StatusDot st={status} size={11} />
        {onClose && <button style={{ ...S.ghostBtn, padding: "4px 7px", flexShrink: 0 }} onClick={onClose} title="Schließen"><XIcon size={15} /></button>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {dev.webUi?.vorhanden && (
          <button style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12, opacity: url ? 1 : 0.5 }} disabled={!url} title={url || "Keine IP-Adresse für die Web-UI eingetragen"}
            onClick={() => url && api.openExternal(url)}><Globe size={14} /> Web-UI öffnen</button>
        )}
        <button style={S.smallBtn} onClick={() => onCheck && onCheck([dev.id])} title="Ping bzw. TCP-Prüfung auf den Web-UI-Port"><RefreshCw size={14} /> Erreichbarkeit</button>
        {X && <button style={{ ...S.smallBtn, ...(isRoot ? { borderColor: ACCENT, color: ACCENT } : {}) }} onClick={() => mutate((d) => { d.layout.rootId = isRoot ? null : dev.id; })}
          title="Dieses Gerät als Mitte der Mindmap verwenden">{isRoot ? <><Star size={14} fill="currentColor" /> Core (Mitte)</> : <><Star size={14} /> Als Core setzen</>}</button>}
        {onUmbauen && <button style={S.smallBtn} onClick={() => onUmbauen(dev.id)} title="Dieses Gerät auf ein Katalogmodell, eine eigene Vorlage oder einen Bestandseintrag umstellen. Name, Netzwerkname, IPs und Verbindungen bleiben."><ArrowLeftRight size={14} /> Modell zuweisen</button>}
        <button style={S.smallBtn} onClick={() => onSaveVorlage && onSaveVorlage(dev)} title="Als eigene Gerätevorlage (ohne IPs) im Katalog speichern"><Plus size={14} /> Vorlage</button>
        {onSaveBestand && (() => {
          const inB = dev.bestandId && bestand.some((b) => b.id === dev.bestandId);
          return <button style={{ ...S.smallBtn, ...(inB ? { borderColor: "#2ecc7188" } : {}) }} onClick={() => onSaveBestand(dev)}
            title={inB ? "Den Eintrag im Gerätebestand mit dem aktuellen Stand (Name, IPs, Ports …) überschreiben" : "Dieses konkrete Gerät mit Name, IPs, MACs und Ports im Gerätebestand speichern"}>{inB ? <><RefreshCw size={14} /> Bestand aktualisieren</> : <><Download size={14} /> In Bestand</>}</button>;
        })()}
        <button style={S.smallBtn} title="Gerät mit allen Einstellungen kopieren (ohne IP- und MAC-Adressen)" onClick={() => mutate((d) => { d.geraete.push(geraetKopie(dev)); })}><CopyPlus size={14} /> Duplizieren</button>
        <button style={S.smallBtn} title="Einstellungen dieses Geräts kopieren, um sie in andere Geräte einzufügen. Im Dialog wählst du, welche Daten." onClick={() => setKonfigDlg("kopieren")}><Copy size={14} /> Konfig kopieren</button>
        {konfigClip && <button style={S.smallBtn} title={`Kopierte Konfiguration von „${konfigClip.quelle.name}“ in dieses und weitere Geräte einfügen`} onClick={() => setKonfigDlg("einfuegen")}><ClipboardPaste size={14} /> Konfig einfügen</button>}
        <button style={{ ...S.dangerBtn, marginLeft: "auto" }} onClick={() => onDelete && onDelete(dev.id)}><Trash2 size={14} /> Löschen</button>
      </div>
      {konfigDlg === "kopieren" && <KonfigKopieren P={P} dev={dev} onClose={() => setKonfigDlg(null)} />}
      {konfigDlg === "einfuegen" && konfigClip && <KonfigEinfuegen P={P} clip={konfigClip} ziele={[dev.id]} mutate={mutate} onClose={() => setKonfigDlg(null)} />}

      {issues.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {issues.slice(0, 6).map((i, n) => <div key={n} style={{ fontSize: 11, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "flex-start" }}><SevBadge sev={i.sev} /><span>{i.msg}</span></div>)}
        </div>
      )}

      {fest && (
        <div style={{ marginTop: 12, padding: "7px 10px", border: `1px solid ${LINE}`, borderRadius: 7, background: CARD, fontSize: 11.5, color: SUB, lineHeight: 1.45 }}>
          <Lock size={12} style={{ verticalAlign: "-2px" }} /> {dev.bestandId ? "Aus dem Gerätebestand" : "Herstellermodell aus dem Katalog"}: Gerätetyp, Hersteller, Modell, Ports, Buchsen und PoE-Werte sind fest.
          Einstellbar bleiben Name, {dev.isSwitch ? "VLAN, " : ""}IP, Modus, Trunk, PoE je Port, Web-UI, Protokolle und Verbindungen.{onUmbauen ? " Anderes Modell: „Modell zuweisen“." : ""}
        </div>
      )}

      {/* Allgemein */}
      <Sub>Allgemein</Sub>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 10 }}>
        <Field label="Gerätetyp">
          <select style={S.selectSm} value={dev.typ} disabled={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => upd((g) => {
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
        <Field label="Hersteller"><input style={{ ...S.inputSm, ...festStil(fest) }} value={dev.hersteller} readOnly={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => upd((g) => (g.hersteller = e.target.value))} /></Field>
        <Field label="Modell"><input style={{ ...S.inputSm, ...festStil(fest) }} value={dev.modell} readOnly={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => upd((g) => (g.modell = e.target.value))} /></Field>
        <Field label="Standort / Ast">
          <AuswahlFeld style={S.inputSm} optionen={P.bereiche} value={dev.bereich || ""} onChange={(v) => upd((g) => (g.bereich = v))} placeholder="z. B. FOH" />
        </Field>
        {dev.isSwitch
          ? <Field label="PoE-Budget (W)" hint="0 = keine Prüfung"><input type="number" min="0" style={{ ...S.inputSm, ...festStil(fest) }} value={dev.poeBudget || 0} readOnly={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => upd((g) => (g.poeBudget = +e.target.value))} /></Field>
          : <Field label="PoE-Bedarf (W)" hint="0 = eigenes Netzteil"><input type="number" min="0" style={{ ...S.inputSm, ...festStil(fest) }} value={dev.poeBedarf || 0} readOnly={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => upd((g) => (g.poeBedarf = +e.target.value))} /></Field>}
      </div>

      <EigeneFelder dev={dev} katalog={P.feldKatalog || []} upd={upd} grid={grid} />


      {/* Ports: jeder Port ist zugleich ein Interface mit VLAN und IP-Daten */}
      <Sub right={<>
        {!fest && <button style={S.smallBtn} onClick={() => upd((g) => { const n = physPorts(g).length + 1; g.ports.push(newPort({ name: g.isSwitch ? String(n) : `LAN ${n}` })); })}>+ Port</button>}
        {dev.isSwitch && !fest && <button style={S.smallBtn} onClick={() => upd((g) => { for (let n = 0; n < 8; n++) g.ports.push(newPort({ name: String(physPorts(g).length + 1) })); })}>+ 8 Ports</button>}
        {dev.isSwitch && !unmanaged && <button style={S.smallBtn} title="Management-Interface ohne eigene Buchse (IP des Switches)" onClick={() => upd((g) => g.ports.push(newPort({ name: "Management", virtuell: true })))}>+ Management</button>}
      </>}>
        Ports ({physPorts(dev).length})
      </Sub>
      {dev.isSwitch && !unmanaged && <VlanZuweisenLeiste P={P} dev={dev} mutate={mutate} />}
      {dev.isSwitch && !unmanaged && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 11, color: SUB }}>
          Alle Ports ohne Verbindung auf Access-VLAN:
          <VlanSelect vlans={P.vlans} value={null} style={{ width: 170 }} noneLabel="wählen …" onChange={(val) => val && upd((g) => physPorts(g).forEach((p) => {
            if (!(X.connsByPort.get(`${g.id}:${p.id}`) || []).length && p.modus !== "trunk") p.vlan = val;
          }))} />
        </div>
      )}
      {dev.ports.length === 0 && <div style={{ ...S.empty, padding: "4px 0" }}>Keine Ports.</div>}
      {dev.ports.filter((p) => !dev.isSwitch || p.virtuell).map((p) => <IpPort key={p.id} P={P} X={X} dev={dev} p={p} upd={upd} mutate={mutate} compact={compact} cons={connOf(p)} onSelectDevice={onSelectDevice} fest={fest} pst={status?.ifs?.[p.id]} />)}
      {dev.isSwitch && physPorts(dev).length > 0 && <div style={{ overflowX: "auto" }}>
        <table style={{ ...S.table, marginTop: 0, fontSize: 12, minWidth: 660 }}>
          <thead><tr>
            <th style={S.th}>Port</th><th style={S.th}>Typ</th><th style={S.th}>Seite</th>
            {!unmanaged && <><th style={S.th}>Modus</th><th style={S.th}>VLAN</th><th style={S.th}>PoE</th></>}
            <th style={S.th} title="Punkt-zu-Punkt (AES50, SLink, HDBaseT …) – kein Ethernet">P2P</th>
            <th style={S.th}>Verbunden mit</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {physPorts(dev).map((p) => {
              const setP = (fn) => upd((g) => fn(g.ports.find((x) => x.id === p.id)));
              const cons = connOf(p);
              return (
                <tr key={p.id} style={{ background: cons.length > 1 ? ERR + "18" : undefined }}>
                  <td style={{ ...S.td, width: 80 }}><input style={{ ...S.inputSm, padding: "3px 6px", ...festStil(fest) }} value={p.name} maxLength={10} readOnly={fest} title={fest ? FEST_TIP : "Höchstens 10 Zeichen"} onChange={(e) => setP((x) => (x.name = e.target.value.slice(0, 10)))} /></td>
                  <td style={{ ...S.td, minWidth: 92 }}><select style={{ ...S.selectSm, padding: "3px 4px" }} value={p.typ} disabled={fest} title={fest ? FEST_TIP : undefined} onChange={(e) => setP((x) => (x.typ = e.target.value))}>{PORT_TYPEN.map((t) => <option key={t}>{t}</option>)}</select></td>
                  <td style={{ ...S.td, minWidth: 104 }}><SeiteSelect dev={dev} p={p} setP={setP} /></td>
                  {!unmanaged && <>
                    <td style={{ ...S.td, width: 84 }}><select style={{ ...S.selectSm, padding: "3px 4px" }} value={p.modus} onChange={(e) => setP((x) => (x.modus = e.target.value))}><option value="access">Access</option><option value="trunk">Trunk</option></select></td>
                    <td style={{ ...S.td, minWidth: 120 }}>{p.modus === "trunk"
                      ? <TrunkVlans vlans={P.vlans} value={p.vlans} onChange={(val) => setP((x) => (x.vlans = val))} />
                      : <VlanSelect vlans={P.vlans} value={p.vlan} onChange={(val) => setP((x) => (x.vlan = val))} style={{ padding: "3px 4px" }} noneLabel="– default –" />}</td>
                    <td style={S.td}><input type="checkbox" checked={!!p.poe} style={{ accentColor: ACCENT }} onChange={(e) => setP((x) => (x.poe = e.target.checked))} /></td>
                  </>}
                  <td style={S.td}><input type="checkbox" checked={!!p.p2p} disabled={fest} title={fest ? FEST_TIP : undefined} style={{ accentColor: ACCENT }} onChange={(e) => setP((x) => (x.p2p = e.target.checked))} /></td>
                  <td style={{ ...S.td, fontSize: 11 }}><Gegenstellen cons={cons} onSelectDevice={onSelectDevice} /></td>
                  <td style={{ ...S.td, width: 30 }}>{!fest && <PortLoeschen dev={dev} p={p} mutate={mutate} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}

      {/* Web-UI */}
      <Sub>Web-UI & Erreichbarkeit</Sub>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "auto 2fr 1fr", gap: 10, alignItems: "end" }}>
        <Toggle checked={dev.webUi?.vorhanden} onChange={(c) => upd((g) => (g.webUi = { ...g.webUi, vorhanden: c }))} label="Gerät hat eine Web-UI" />
        {dev.webUi?.vorhanden && <>
          <Field label="URL" hint="{ip} wird durch die IP des gewählten Ports ersetzt, z. B. https://{ip}:8443">
            <input style={{ ...S.inputSm, fontFamily: "monospace" }} value={dev.webUi.url} onChange={(e) => upd((g) => (g.webUi.url = e.target.value))} />
          </Field>
          <Field label="über Port">
            <select style={S.selectSm} value={dev.webUi.iface || ""} onChange={(e) => upd((g) => (g.webUi.iface = e.target.value || null))}>
              <option value="">erster mit IP</option>
              {ipPorts(dev).map((i) => <option key={i.id} value={i.id}>{i.name} {i.ip && `(${i.ip})`}</option>)}
            </select>
          </Field>
        </>}
      </div>
      {dev.webUi?.vorhanden && <div style={{ ...S.hint, marginTop: 6 }}>Link: {url ? <a style={{ color: ACCENT, cursor: "pointer" }} onClick={() => api.openExternal(url)}>{url}</a> : "– (IP fehlt)"}</div>}
      {status && <div style={{ ...S.hint, marginTop: 4 }}>Letzte Prüfung: {status.ok === null ? status.method : status.ok ? `erreichbar über ${status.ip || "?"} per ${status.method} (${status.ms} ms)${Object.values(status.ifs || {}).filter((x) => x.ok).length > 1 ? `, ${Object.values(status.ifs).filter((x) => x.ok).length} IPs antworten` : ""}` : `keine IP antwortet (${status.method})`} {status.t && `· ${new Date(status.t).toLocaleTimeString("de-DE")}`}</div>}

      {/* Protokolle */}
      <Sub>Protokolle</Sub>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {(dev.protokolle || []).map((s, n) => {
          const r = findProtokoll(s);
          return (
            <span key={n} style={{ ...S.chip, borderColor: r ? (r.flags.p2p ? ERR + "88" : ACCENT + "66") : LINE, cursor: r ? "pointer" : "default" }}
              title={r ? `${r.name}\nPorts: ${r.raw.Ports}\nÜber Switch: ${r.raw["Über Switch / routbar?"]}` : "Nicht in der Protokollrecherche"}
              onClick={() => r && onShowProto && onShowProto(r.id)}>
              {r?.flags.p2p && <Link size={11} />}{s}
              <span style={{ color: MUTED, cursor: "pointer", marginLeft: 2 }} onClick={(e) => { e.stopPropagation(); upd((g) => g.protokolle.splice(n, 1)); }}><XIcon size={11} style={{ display: "block" }} /></span>
            </span>
          );
        })}
        <form onSubmit={(e) => { e.preventDefault(); if (protoInput.trim()) { upd((g) => (g.protokolle = [...(g.protokolle || []), protoInput.trim()])); setProtoInput(""); } }} style={{ display: "inline-flex" }}>
          <input list="np-protos" style={{ ...S.inputSm, width: 170, padding: "2px 8px", fontSize: 11 }} placeholder="+ Protokoll" value={protoInput} onChange={(e) => setProtoInput(e.target.value)} />
          <datalist id="np-protos">{PROTOKOLLE.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </form>
      </div>
      <div style={{ ...S.hint, marginTop: 6 }}><Link size={11} style={{ verticalAlign: "-1px" }} /> = Punkt-zu-Punkt-Protokoll, läuft nicht über Switches. Klick auf ein Protokoll zeigt Ports und Anforderungen.</div>

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

/* Zuweisungsmodus: VLAN-Kachel anklicken, dann in der Topologie (Ansicht „Anschlüsse“) auf Switch-Ports klicken */
function VlanZuweisenLeiste({ P, dev, mutate }) {
  const z = useVlanZuweisen();
  const an = !!z;
  const [vlan, setVlan] = useState(() => z?.vlan || P.vlans[0]?.id || null);
  const einschalten = (on) => {
    if (!on) { setVlanZuweisen(null); return; }
    if (!vlan) return;
    setVlanZuweisen({ vlan, dev: dev.id });
    if (P.layout.ansicht !== "front") mutate((d) => { d.layout.ansicht = "front"; });
  };
  // Kachel anklicken = dieses VLAN zuweisen (Modus an); die aktive Kachel noch mal = Modus aus
  const kachel = (v) => {
    if (an && z?.vlan === v) { setVlanZuweisen(null); return; }
    setVlan(v);
    setVlanZuweisen({ vlan: v, dev: dev.id });
    if (P.layout.ansicht !== "front") mutate((d) => { d.layout.ansicht = "front"; });
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: "6px 8px", borderRadius: 6, border: `1px solid ${an ? ACCENT : LINE}`, background: an ? ACCENT + "14" : undefined, fontSize: 11, color: SUB }}>
      <Toggle checked={an} onChange={einschalten} label="VLAN zuweisen" title="An: in der Topologie (Ansicht „Anschlüsse“) setzt ein Klick auf einen Switch-Port dieses VLAN als Access-VLAN. Esc oder Aus beendet den Modus." />
      {an && <span>Jetzt in der Topologie auf die Ports klicken · Esc beendet</span>}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", width: "100%" }}>
        {[...P.vlans].sort((a, b) => a.vid - b.vid).map((v) => {
          const aktiv = an && z?.vlan === v.id;
          return (
            <button key={v.id} onClick={() => kachel(v.id)} title={aktiv ? "Aktiv: Ports anklicken. Noch mal klicken beendet." : `VLAN ${v.vid} ${v.name} zuweisen`}
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 74, maxWidth: 120, padding: "4px 8px", borderRadius: 6, cursor: "pointer", textAlign: "left",
                background: v.farbe + (aktiv ? "" : "33"), color: aktiv ? "#fff" : STRONG, border: `2px solid ${aktiv ? STRONG : v.farbe}`, boxShadow: aktiv ? `0 0 0 2px ${v.farbe}` : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1, textShadow: aktiv ? "0 1px 2px #0006" : "none" }}>{v.vid}</span>
              <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", textShadow: aktiv ? "0 1px 2px #0006" : "none" }}>{v.name || `VLAN ${v.vid}`}</span>
            </button>
          );
        })}
        {!P.vlans.length && <span>Noch keine VLANs. Im Tab „Setup“ anlegen.</span>}
      </div>
    </div>
  );
}
