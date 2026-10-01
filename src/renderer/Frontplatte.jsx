import React from "react";
import { ACCENT, OK, ERR, MUTED, TYPEN, katColor } from "../shared/constants.js";
import { mainIp } from "../shared/model.js";
import { CARD_W, CARD_H, TAB_H, plattenGeometrie } from "../shared/frontplatte.js";
import { STECKER, STECKER_KATEGORIEN, SEITEN, portSeiten, steckerTyp, geraeteAnschluesse, anschlussText } from "../shared/anschluesse.js";
import { SvgIcon } from "./icons.jsx";
import { Zap, TriangleAlert, Globe } from "lucide-react";
import { endInfo, portLabel, vlanLang, geraeteTitel } from "./portinfo.js";
import { ipPorts } from "../shared/catalog.js";
import { feldZeilen } from "../shared/felder.js";

/* Darstellung für die Anschluss-Ansicht (früher „Frontplatten“, Stil Luminex Araneo) */

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
    `Port ${z.port.name} · ${STECKER[s.stecker]?.name || z.port.typ}${z.port.poe ? " · PoE" : ""}${z.port.speed ? " · " + z.port.speed : ""}${s.seite ? " · " + SEITEN[s.seite] : ""}`,
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
        {/^opticalcon/.test(s.stecker) ? <>
          {/* opticalCON: Glasfaser-Ring und Faserpunkte statt Kupfer-Einsatz */}
          <circle cx={s.x} cy={s.y} r={s.w / 2 - 1.2} fill="none" stroke={STECKER_KATEGORIEN.glasfaser} strokeWidth="2" />
          <circle cx={s.x} cy={s.y} r={s.w / 2 - 5} fill="#141a2e" stroke="#0b0f1f" />
          {(s.stecker === "opticalcon_quad" ? [[-3, -3], [3, -3], [-3, 3], [3, 3]] : [[-3.5, 0], [3.5, 0]]).map(([dx, dy], i) => <circle key={i} cx={s.x + dx} cy={s.y + dy} r="1.6" fill="#7fe3ea" />)}
          <text x={s.x} y={s.y + s.w / 2 + 7} fontSize="6.5" fontWeight="700" fill="#fff" textAnchor="middle">{s.nr}</text>
        </> : <>
          <circle cx={s.x} cy={s.y} r={s.w / 2 - 5} fill="#141a2e" stroke="#0b0f1f" />
          <text x={s.x} y={s.y + 3.5} fontSize="9.5" fontWeight="700" fill="#fff" textAnchor="middle">{s.nr}</text>
        </>}
      </> : <>
        <clipPath id={clip}><rect x={x0} y={y0} width={s.w} height={s.h} rx="2" /></clipPath>
        <g clipPath={`url(#${clip})`}>{farben.map((f, i) => <rect key={i} x={x0 + (i * s.w) / farben.length} y={y0} width={s.w / farben.length + 0.5} height={s.h} fill={f} />)}</g>
        <rect x={x0} y={y0} width={s.w} height={s.h} rx="2" fill="none" stroke="#0b0f1f" strokeWidth=".8" />
        {s.fam === "sfp" && <rect x={x0} y={y0} width={s.w} height={s.h} rx="2" fill="none" stroke={STECKER_KATEGORIEN.glasfaser} strokeWidth="1.4" />}
        {s.fam === "sfp"
          ? <rect x={x0 + 3} y={y0 + 4} width={s.w - 6} height={s.h - 8} rx="1" fill="none" stroke={hell(farben[0]) ? "#10131a88" : "#ffffff88"} strokeWidth={s.stecker === "sfp" ? 0.8 : 1.6} />
          : <rect x={s.x - 3} y={s.row ? y0 + s.h - 3 : y0} width="6" height="3" fill="#0b0f1f" />}
        <text x={s.x} y={s.y + 3.3} fontSize="8.5" fontWeight="700" fill={txt} textAnchor="middle">{s.nr}</text>
      </>}
      {aktiv && <circle cx={x0 + s.w - 2.5} cy={s.row ? y0 + s.h - 2.5 : y0 + 2.5} r="1.8" fill={OK} stroke="#0b0f1f" strokeWidth=".5" />}
      {z.port.poe && <Zap x={x0 + 1.5} y={s.row ? y0 + s.h - 6.5 : y0 + 1.5} size={5} color={hell(farben[0]) ? "#10131a" : "#ffe066"} fill={hell(farben[0]) ? "#10131a" : "#ffe066"} strokeWidth={1} />}
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
      {plattenGeometrie(d).seiten.map((t) => <g key={t.seite} pointerEvents="none">
        <text x={x0 + (t.x0 + t.x1) / 2} y={y0 + 6.8} fontSize="5.5" fontWeight="700" letterSpacing=".6" fill="#ffffffb0" textAnchor="middle">{t.seite === "vorne" ? "VORNE" : "HINTEN"}</text>
        {t.seite === "hinten" && <line x1={x0 + t.x0 - 13} x2={x0 + t.x0 - 13} y1={y0 + 3} y2={y0 + p.h - 3} stroke="#ffffff40" strokeDasharray="2 2" />}
      </g>)}
      {d.ports.map((port) => {
        const s = slots?.get(port.id);
        if (!s) return null;
        const z = { ...portZustand(d, port, X), port };
        return <Slot key={port.id} s={{ ...s, x: s.ax, y: s.ay }} z={z} d={d} onPortDown={onPortDown} />;
      })}
      <circle cx={x0 + p.w - 14} cy={y0 + 11} r="4.5" fill={!status || status.ok == null ? "#4a535e" : status.ok ? OK : ERR} stroke="#0b0f1f" strokeWidth="1.2">
        <title>{!status ? "Status unbekannt" : status.ok ? `erreichbar (${status.method}, ${status.ms} ms)` : status.ok === false ? `nicht erreichbar (${status.method})` : status.method}</title>
      </circle>
      {worst && <g><TriangleAlert x={x0 + p.w - 20} y={y0 + 19} size={12} color={worst} strokeWidth={2.2} /><rect x={x0 + p.w - 20} y={y0 + 19} width="12" height="12" fill="transparent"><title>{iss.map((i) => i.msg).join("\n")}</title></rect></g>}
      {url && (
        <g className="np-ui" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onWeb(); }} style={{ cursor: "pointer" }}>
          <Globe x={x0 + p.w - 19} y={y0 + p.h - 14} size={10} color="#7fb2ff" strokeWidth={2} /><rect x={x0 + p.w - 20} y={y0 + p.h - 15} width="12" height="12" fill="transparent" />
          <title>Web-UI öffnen: {url}</title>
        </g>
      )}
      <text x={x0} y={y0 + p.h + 13} fontSize="10.5" fontWeight="600" fill="#dfe4ff" stroke={FP_BG} strokeWidth="3" paintOrder="stroke">{label}<title>{[d.name, d.netzname && `Netzwerkname: ${d.netzname}`, ...feldZeilen(d), d.hersteller && `${d.hersteller} ${d.modell || ""}`].filter(Boolean).join("\n")}</title></text>
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
export function FrontCard({ d, p, P, X, farbe, tab, sel, hover, hit, dim, status, worst, iss, titel, onDown, onContextMenu, tool }) {
  const x0 = p.x - CARD_W / 2, y0 = p.y - CARD_H / 2;
  const col = katColor(d.kategorie);
  const ip = mainIp(d);
  const name = geraeteTitel(d, titel);
  const zeile2 = [ip || (ipPorts(d).some((i) => i.dhcp) ? "DHCP" : ""), d.modell || TYPEN[d.typ]?.label].filter(Boolean).join(" · ");
  const tabW = tab ? Math.max(46, tab.length * 6 + 14) : 0;
  const max2 = Math.min(21, Math.floor((CARD_W - 46 - 8 - leistenBreite(d)) / 6)); // Platz bis zur Buchsenleiste
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
        <title>{[d.name, d.netzname && `Netzwerkname: ${d.netzname}`, ...feldZeilen(d), d.hersteller && `${d.hersteller} ${d.modell || ""}`].filter(Boolean).join("\n")}</title>
      </text>
      <text x={x0 + 46} y={y0 + 36} fontSize="10" fill={ip ? "#c8d0ff" : MUTED} fontFamily="Consolas,monospace">{zeile2.length > max2 ? zeile2.slice(0, max2 - 1) + "…" : zeile2 || "keine IP"}<title>{zeile2}</title></text>
      <circle cx={x0 + CARD_W - 10} cy={y0 + 10} r="4" fill={!status || status.ok == null ? "#4a535e" : status.ok ? OK : ERR} stroke="#0b0f1f" strokeWidth="1.2">
        <title>{!status ? "Status unbekannt" : status.ok ? `erreichbar (${status.method}, ${status.ms} ms)` : status.ok === false ? `nicht erreichbar (${status.method})` : status.method}</title>
      </circle>
      {worst && <g><TriangleAlert x={x0 + CARD_W - 30} y={y0 + 4} size={11} color={worst} strokeWidth={2.2} /><rect x={x0 + CARD_W - 30} y={y0 + 4} width="11" height="11" fill="transparent"><title>{iss.map((i) => i.msg).join("\n")}</title></rect></g>}
      <Buchsenleiste d={d} X={X} x1={x0 + CARD_W - 6} y={y0 + CARD_H - 10} />
    </g>
  );
}

/* Buchsen eines Endgeräts als kleine Symbole unten rechts auf der Karte,
   je Seite gruppiert (V = vorne, H = hinten), belegte Buchsen hell. */
const MINI = 9;
export function Buchse({ x, y, stecker, aktiv, farbe }) {
  const f = aktiv ? farbe || "#c8d0ff" : "#3a4466";
  const glas = STECKER_KATEGORIEN.glasfaser;
  if (stecker === "ethercon") return <g><circle cx={x + MINI / 2} cy={y + MINI / 2} r={MINI / 2} fill={f} stroke="#0b0f1f" strokeWidth=".6" /><rect x={x + 2.6} y={y + 3} width={MINI - 5.2} height="3" fill="#0b0f1f" /></g>;
  if (/^opticalcon/.test(stecker)) return <g><circle cx={x + MINI / 2} cy={y + MINI / 2} r={MINI / 2} fill={f} stroke={glas} strokeWidth="1.2" /><circle cx={x + 3} cy={y + MINI / 2} r=".9" fill="#0b0f1f" /><circle cx={x + 6} cy={y + MINI / 2} r=".9" fill="#0b0f1f" /></g>;
  if (/^sfp|^qsfp/.test(stecker)) return <g><rect x={x} y={y + 1} width={MINI} height={MINI - 2} rx="1" fill={f} stroke={glas} strokeWidth="1" /><rect x={x + 2} y={y + 3} width={MINI - 4} height={MINI - 6} fill="none" stroke="#0b0f1f" strokeWidth=".6" /></g>;
  if (stecker === "lc_duplex") return <g><rect x={x} y={y + 1} width={MINI} height={MINI - 2} rx="1" fill={f} stroke={glas} strokeWidth="1" /><circle cx={x + 3} cy={y + MINI / 2} r="1" fill="#0b0f1f" /><circle cx={x + 6} cy={y + MINI / 2} r="1" fill="#0b0f1f" /></g>;
  return <g><rect x={x} y={y} width={MINI} height={MINI - 1} rx="1" fill={f} stroke="#0b0f1f" strokeWidth=".6" /><rect x={x + 3} y={y + MINI - 3} width="3" height="2" fill="#0b0f1f" /></g>; // RJ45
}

const leiste = (d) => {
  const ports = (d.ports || []).filter((p) => !p.virtuell && steckerTyp(p));
  if (!ports.length || ports.length > 12) return null;
  const seite = portSeiten(d);
  const gruppen = ["vorne", "hinten", null].map((s) => [s, ports.filter((p) => (seite.get(p.id) || null) === s)]).filter(([, l]) => l.length);
  const breite = ports.length * (MINI + 2) + gruppen.reduce((a, [s]) => a + 3 + (s ? 7 : 0), 0);
  return { seite, gruppen, breite };
};
export const leistenBreite = (d) => leiste(d)?.breite || 0;

function Buchsenleiste({ d, X, x1, y }) {
  const l0 = leiste(d);
  if (!l0) return null;
  const { seite, gruppen } = l0;
  const recherche = geraeteAnschluesse(d);
  const elemente = [];
  let x = x1;
  for (const [s, l] of [...gruppen].reverse()) {
    for (const p of [...l].reverse()) {
      x -= MINI + 2;
      const c = (X.connsByPort.get(`${d.id}:${p.id}`) || [])[0];
      const st = steckerTyp(p);
      elemente.push(<g key={p.id}><Buchse x={x} y={y} stecker={st} aktiv={!!c} />
        <title>{`${p.name} · ${STECKER[st]?.name || p.typ}${s ? " · " + SEITEN[s] : ""}${c ? " · belegt" : " · frei"}`}</title></g>);
    }
    if (s) { x -= 7; elemente.push(<text key={"s" + s} x={x + 3} y={y + 7.5} fontSize="7" fontWeight="700" fill="#8f9bd0" textAnchor="middle">{s === "vorne" ? "V" : "H"}</text>); }
    x -= 3;
  }
  const tip = recherche ? ["Anschlüsse laut Hersteller:", recherche.vorne.length && "Vorne: " + anschlussText(recherche.vorne), recherche.hinten.length && "Hinten: " + anschlussText(recherche.hinten)].filter(Boolean).join("\n") : null;
  return <g>{tip && <title>{tip}</title>}{elemente}</g>;
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

