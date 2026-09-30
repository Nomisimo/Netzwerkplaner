import React from "react";
import { ACCENT, OK, ERR, MUTED, TYPEN, katColor } from "../shared/constants.js";
import { mainIp } from "../shared/model.js";
import { CARD_W, CARD_H, TAB_H } from "../shared/frontplatte.js";
import { SvgIcon } from "./icons.jsx";
import { endInfo, portLabel, vlanLang, geraeteTitel } from "./portinfo.js";
import { ipPorts } from "../shared/catalog.js";

/* Darstellung für die Frontplatten-Ansicht (Stil Luminex Araneo) */

export const FP_BG = "#0e1430";
const TRUNK = "#d8dde3";

// Plattenfarbe nach Hersteller, damit Switches auf einen Blick unterscheidbar sind
const PLATTE = [
  [/luminex/i, "#2c3b93", "#4b5bc0"],
  [/cisco/i, "#1d4f63", "#2f7c99"],
  [/netgear/i, "#3a3f4a", "#5c6473"],
  [/yamaha/i, "#3b2f4f", "#6a5590"],
  [/ma lighting/i, "#3a2323", "#7a4040"],
];
export const plattenFarbe = (d) => {
  const t = PLATTE.find(([re]) => re.test(d.hersteller || ""));
  return t ? { fill: t[1], stroke: t[2] } : { fill: "#2a3140", stroke: "#4a5568" };
};
const logoText = (d) => (d.hersteller || "Switch").replace(/ (GmbH|AG|Inc\.?|Lighting|Systems)$/i, "").slice(0, 9);

// Hell oder dunkel beschriften, je nach Füllfarbe
const hell = (hex) => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
};

// Belegung eines Switch-Ports: VLAN-Farben, Verbindung, Gegenstelle
export const portZustand = (d, port, X) => {
  const c = (X.connsByPort.get(`${d.id}:${port.id}`) || [])[0] || null;
  const managed = d.typ !== "switch_unmanaged";
  let kind = "access", vlans = [];
  if (c) {
    const self = endInfo(c, c.a.dev === d.id && c.a.port === port.id ? c.a : c.b, X);
    kind = self?.kind || "access"; vlans = self?.vlans || [];
  } else if (managed) {
    kind = port.modus === "trunk" ? "trunk" : "access";
    const ids = kind === "trunk" ? port.vlans || [] : port.vlan ? [port.vlan] : [];
    vlans = ids.map((id) => X.vlanById.get(id)).filter(Boolean).sort((a, b) => a.vid - b.vid);
  }
  const o = c ? (c.a.dev === d.id && c.a.port === port.id ? c.b : c.a) : null;
  const other = o ? X.portRef.get(`${o.dev}:${o.port}`) : null;
  return { c, kind, vlans, other };
};

// Farbe einer Karte / Kante: VLAN des Switch-Ports, sonst des Geräts
export const kartenFarbe = (z) => (!z ? MUTED : z.kind === "trunk" ? TRUNK : z.vlans[0]?.farbe || MUTED);

function Slot({ s, z, d, onPortDown }) {
  const farben = z.kind === "trunk" ? (z.vlans.length && z.vlans.length <= 4 ? z.vlans.map((v) => v.farbe) : [TRUNK]) : [z.vlans[0]?.farbe || "#5a6272"];
  const aktiv = !!z.c;
  const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2;
  const txt = hell(farben[0]) ? "#10131a" : "#fff";
  const clip = `fp-${d.id}-${s.nr}`;
  const tip = [
    `Port ${z.port.name} · ${z.port.typ}${z.port.poe ? " · PoE" : ""}${z.port.speed ? " · " + z.port.speed : ""}`,
    vlanLang({ kind: z.kind, vlans: z.vlans }),
    z.other ? `→ ${z.other.dev.name} · ${z.other.port.name}` : "nicht verbunden",
  ].join("\n");
  return (
    <g opacity={aktiv ? 1 : 0.55} onMouseDown={(e) => onPortDown(e, z.c)} style={{ cursor: "pointer" }}>
      <title>{tip}</title>
      {s.fam === "ec" ? <>
        <clipPath id={clip}><circle cx={s.x} cy={s.y} r={s.w / 2} /></clipPath>
        <g clipPath={`url(#${clip})`}>{farben.map((f, i) => <rect key={i} x={x0 + (i * s.w) / farben.length} y={y0} width={s.w / farben.length + 0.5} height={s.h} fill={f} />)}</g>
        <circle cx={s.x} cy={s.y} r={s.w / 2} fill="none" stroke="#0b0f1f" strokeWidth="1" />
        <circle cx={s.x} cy={s.y} r={s.w / 2 - 5} fill="#141a2e" stroke="#0b0f1f" />
        <text x={s.x} y={s.y + 3.5} fontSize="9.5" fontWeight="700" fill="#fff" textAnchor="middle">{s.nr}</text>
      </> : <>
        <clipPath id={clip}><rect x={x0} y={y0} width={s.w} height={s.h} rx="2" /></clipPath>
        <g clipPath={`url(#${clip})`}>{farben.map((f, i) => <rect key={i} x={x0 + (i * s.w) / farben.length} y={y0} width={s.w / farben.length + 0.5} height={s.h} fill={f} />)}</g>
        <rect x={x0} y={y0} width={s.w} height={s.h} rx="2" fill="none" stroke="#0b0f1f" strokeWidth=".8" />
        {s.fam === "sfp"
          ? <rect x={x0 + 3} y={y0 + 4} width={s.w - 6} height={s.h - 8} rx="1" fill="none" stroke={hell(farben[0]) ? "#10131a88" : "#ffffff88"} strokeWidth=".8" />
          : <rect x={s.x - 3} y={s.row ? y0 + s.h - 3 : y0} width="6" height="3" fill="#0b0f1f" />}
        <text x={s.x} y={s.y + 3.3} fontSize="8.5" fontWeight="700" fill={txt} textAnchor="middle">{s.nr}</text>
      </>}
      {aktiv && <circle cx={x0 + s.w - 2.5} cy={s.row ? y0 + s.h - 2.5 : y0 + 2.5} r="1.8" fill={OK} stroke="#0b0f1f" strokeWidth=".5" />}
      {z.port.poe && <text x={x0 + 2.5} y={s.row ? y0 + s.h - 1.5 : y0 + 5.5} fontSize="5.5" fill={hell(farben[0]) ? "#10131a" : "#ffe066"}>⚡</text>}
    </g>
  );
}

// Switch als Frontplatte
export function FrontPlate({ d, p, P, slots, X, sel, hover, hit, dim, status, worst, iss, titel, hidden, collapsed, canCollapse, onToggle, onDown, onPortDown, onContextMenu, onWeb, url, tool }) {
  const pf = plattenFarbe(d);
  const ip = mainIp(d);
  const x0 = p.x - p.w / 2, y0 = p.y - p.h / 2;
  const name = geraeteTitel(d, titel);
  const label = [name, ip || (d.typ === "switch_unmanaged" ? "unmanaged" : "keine IP"), d.modell].filter(Boolean).join(" · ");
  return (
    <g opacity={dim ? 0.2 : 1} onMouseDown={onDown} onContextMenu={onContextMenu} style={{ cursor: tool === "connect" ? "crosshair" : "pointer" }}>
      {(sel || hover || hit) && <rect x={x0 - 5} y={y0 - 5} width={p.w + 10} height={p.h + 10} rx="7" fill="none" stroke={sel ? ACCENT : hover ? OK : "#fff"} strokeWidth="2" />}
      <rect x={x0} y={y0} width={p.w} height={p.h} rx="4" fill={pf.fill} stroke={worst || pf.stroke} strokeWidth={worst ? 1.6 : 1} />
      <rect x={x0 + 4} y={y0 + 4} width="36" height={p.h - 8} rx="2" fill="#00000030" />
      <SvgIcon icon={d.icon} customIcons={P.icons} x={x0 + 13} y={y0 + p.h / 2 - 13} size={18} color="#ffffffcc" />
      <text x={x0 + 22} y={y0 + p.h - 7} fontSize="6.5" fontWeight="700" fill="#ffffffcc" textAnchor="middle">{logoText(d)}</text>
      {d.ports.map((port) => {
        const s = slots?.get(port.id);
        if (!s) return null;
        const z = { ...portZustand(d, port, X), port };
        return <Slot key={port.id} s={{ ...s, x: s.ax, y: s.ay }} z={z} d={d} onPortDown={onPortDown} />;
      })}
      <circle cx={x0 + p.w - 14} cy={y0 + 11} r="4.5" fill={!status || status.ok == null ? "#4a535e" : status.ok ? OK : ERR} stroke="#0b0f1f" strokeWidth="1.2">
        <title>{!status ? "Status unbekannt" : status.ok ? `erreichbar (${status.method}, ${status.ms} ms)` : status.ok === false ? `nicht erreichbar (${status.method})` : status.method}</title>
      </circle>
      {worst && <text x={x0 + p.w - 14} y={y0 + 29} fontSize="11" fill={worst} textAnchor="middle">⚠<title>{iss.map((i) => i.msg).join("\n")}</title></text>}
      {url && (
        <g className="np-ui" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onWeb(); }} style={{ cursor: "pointer" }}>
          <text x={x0 + p.w - 14} y={y0 + p.h - 5} fontSize="10" textAnchor="middle">🌐</text>
          <title>Web-UI öffnen: {url}</title>
        </g>
      )}
      <text x={x0} y={y0 + p.h + 13} fontSize="10.5" fontWeight="600" fill="#dfe4ff" stroke={FP_BG} strokeWidth="3" paintOrder="stroke">{label}<title>{[d.name, d.netzname && `Netzwerkname: ${d.netzname}`, d.inventar?.nr && `Inventar: ${d.inventar.nr}`, d.hersteller && `${d.hersteller} ${d.modell || ""}`].filter(Boolean).join("\n")}</title></text>
      {canCollapse && (
        <g className="np-ui" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{ cursor: "pointer" }}>
          <circle cx={x0 + p.w + 12} cy={p.y} r="8" fill={collapsed ? ACCENT : "#2c343e"} stroke={collapsed ? ACCENT : "#56606c"} />
          <text x={x0 + p.w + 12} y={p.y + 3.5} fontSize={collapsed ? 8.5 : 11} fontWeight="700" textAnchor="middle" fill="#fff">{collapsed ? "+" + (hidden || "") : "−"}</text>
          <title>{collapsed ? "Gruppe ausklappen" : "Gruppe einklappen"}</title>
        </g>
      )}
    </g>
  );
}

// Endgerät als Karte mit Port-Lasche
export function FrontCard({ d, p, P, farbe, tab, sel, hover, hit, dim, status, worst, iss, titel, onDown, onContextMenu, tool }) {
  const x0 = p.x - CARD_W / 2, y0 = p.y - CARD_H / 2;
  const col = katColor(d.kategorie);
  const ip = mainIp(d);
  const name = geraeteTitel(d, titel);
  const zeile2 = [ip || (ipPorts(d).some((i) => i.dhcp) ? "DHCP" : ""), d.modell || TYPEN[d.typ]?.label].filter(Boolean).join(" · ");
  const tabW = tab ? Math.max(46, tab.length * 6 + 14) : 0;
  return (
    <g opacity={dim ? 0.2 : 1} onMouseDown={onDown} onContextMenu={onContextMenu} style={{ cursor: tool === "connect" ? "crosshair" : "pointer" }}>
      {(sel || hover || hit) && <rect x={x0 - 5} y={y0 - TAB_H - 5} width={CARD_W + 10} height={CARD_H + TAB_H + 10} rx="7" fill="none" stroke={sel ? ACCENT : hover ? OK : "#fff"} strokeWidth="2" />}
      {tab && <>
        <rect x={p.x - tabW / 2} y={y0 - TAB_H} width={tabW} height={TAB_H + 2} rx="3" fill="#161c38" stroke={farbe} strokeWidth="1.4" />
        <text x={p.x} y={y0 - 4} fontSize="9.5" fontWeight="700" fill="#fff" textAnchor="middle">{tab}</text>
      </>}
      <rect x={x0} y={y0} width={CARD_W} height={CARD_H} rx="3" fill="#161c38" stroke={worst || farbe} strokeWidth="1.6" />
      <rect x={x0 + 6} y={y0 + 8} width="32" height="32" rx="5" fill={col + "22"} />
      <SvgIcon icon={d.icon} customIcons={P.icons} x={x0 + 10} y={y0 + 12} size={24} color={col} />
      <text x={x0 + 46} y={y0 + 20} fontSize="12" fontWeight="700" fill="#fff">{name.length > 20 ? name.slice(0, 19) + "…" : name}
        <title>{[d.name, d.netzname && `Netzwerkname: ${d.netzname}`, d.inventar?.nr && `Inventar: ${d.inventar.nr}`, d.hersteller && `${d.hersteller} ${d.modell || ""}`].filter(Boolean).join("\n")}</title>
      </text>
      <text x={x0 + 46} y={y0 + 36} fontSize="10" fill={ip ? "#c8d0ff" : MUTED} fontFamily="Consolas,monospace">{zeile2.length > 21 ? zeile2.slice(0, 20) + "…" : zeile2 || "keine IP"}<title>{zeile2}</title></text>
      <circle cx={x0 + CARD_W - 10} cy={y0 + 10} r="4" fill={!status || status.ok == null ? "#4a535e" : status.ok ? OK : ERR} stroke="#0b0f1f" strokeWidth="1.2">
        <title>{!status ? "Status unbekannt" : status.ok ? `erreichbar (${status.method}, ${status.ms} ms)` : status.ok === false ? `nicht erreichbar (${status.method})` : status.method}</title>
      </circle>
      {worst && <text x={x0 + CARD_W - 10} y={y0 + CARD_H - 8} fontSize="11" fill={worst} textAnchor="middle">⚠<title>{iss.map((i) => i.msg).join("\n")}</title></text>}
    </g>
  );
}

// Beschriftung der Lasche: Port am übergeordneten Gerät
export const laschenText = (id, T, X) => {
  const c = T.treeConn.get(id);
  if (!c) return null;
  const up = c.a.dev === id ? c.b : c.a;
  const r = X.portRef.get(`${up.dev}:${up.port}`);
  if (!r) return null;
  if (r.dev.isSwitch) return /^\d+$/.test(r.port.name) ? `Port ${r.port.name}` : r.port.name;
  return `via ${r.dev.name.slice(0, 14)}`;
};
export const laschenZustand = (id, T, X) => {
  const c = T.treeConn.get(id);
  if (!c) return null;
  const up = c.a.dev === id ? c.b : c.a;
  const r = X.portRef.get(`${up.dev}:${up.port}`);
  if (!r) return null;
  if (r.dev.isSwitch) return portZustand(r.dev, r.port, X);
  const self = endInfo(c, c.a.dev === id ? c.a : c.b, X);
  return self ? { kind: self.kind, vlans: self.vlans } : null;
};

