import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED } from "../../shared/constants.js";
import { cleanCatLayout, CC_FARBEN } from "../../shared/cleancat.js";
import { api } from "../api.js";
import { fileBase, svgToPngBase64 } from "../exports.js";
import { Maximize2, ZoomIn, ZoomOut, FileImage, FileCode } from "lucide-react";

/* Clean Cat: Signalfluss-Plan auf weißem Papier, wie eine Visio-Zeichnung.
   Räume = Standorte, Geräte als Blöcke, Leitungen rechtwinklig. Mausrad zoomt,
   Ziehen verschiebt, Klick auf ein Gerät öffnet es im Geräte-Editor. */
const PAD = 30, KOPF = 46;

function Zeichnung({ L, titel, svgRef, onSelect }) {
  const pfeil = (id, col) => (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill={col} /></marker>
  );
  const farben = [...new Set(L.linien.map((l) => l.col))];
  const mid = (c) => "cc-" + c.replace("#", "");
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={L.w + PAD * 2} height={L.h + PAD * 2 + KOPF} viewBox={`${-PAD} ${-PAD - KOPF} ${L.w + PAD * 2} ${L.h + PAD * 2 + KOPF}`}
      style={{ display: "block", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <defs>{farben.map((c) => <React.Fragment key={c}>{pfeil(mid(c), c)}</React.Fragment>)}</defs>
      <rect x={-PAD} y={-PAD - KOPF} width={L.w + PAD * 2} height={L.h + PAD * 2 + KOPF} fill="#ffffff" />
      <text x={0} y={-KOPF + 8} fontSize="16" fontWeight="700" fill="#222">{titel}</text>
      {L.raeume.map((r) => (
        <g key={r.name}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f6f7f8" stroke="#8a8f96" strokeWidth="1.2" strokeDasharray="6 4" rx="3" />
          <rect x={r.x} y={r.y} width={r.w} height={24} fill="#dfeefb" stroke="none" />
          <line x1={r.x} y1={r.y + 24} x2={r.x + r.w} y2={r.y + 24} stroke="#b9cfe3" />
          <text x={r.x + r.w / 2} y={r.y + 17} fontSize="13.5" fontWeight="600" fill="#222" textAnchor="middle">{r.name}</text>
        </g>
      ))}
      {L.linien.map((l, i) => (
        <g key={l.id + i}>
          <polyline points={l.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={l.col} strokeWidth="1.5" strokeDasharray={l.dash || undefined}
            markerStart={`url(#${mid(l.col)})`} markerEnd={`url(#${mid(l.col)})`} strokeLinejoin="round" />
          {l.labels.map((t, k) => t.rot
            ? <text key={k} transform={`translate(${t.x},${t.y}) rotate(-90)`} fontSize="7.5" fill="#333">{t.t}</text>
            : <text key={k} x={t.x} y={t.y} fontSize="8" fill="#333" textAnchor={t.anchor || "start"} paintOrder="stroke" stroke="#ffffff" strokeWidth="2.5">{t.t}</text>)}
        </g>
      ))}
      {L.boxen.map((b) => (
        <g key={b.id} transform={`translate(${b.x},${b.y})`} style={{ cursor: onSelect ? "pointer" : "default" }} onClick={onSelect ? () => onSelect(b.id) : undefined}>
          <rect width={b.w} height={b.h} fill={b.fill} stroke="#3b3f45" strokeWidth="1" />
          <text x={b.w / 2} y={b.ip ? 17 : b.sub ? 18 : b.h / 2 + 4} fontSize="12.5" fontWeight="600" fill="#111" textAnchor="middle">{b.name}</text>
          {b.sub && <text x={b.w / 2} y={b.ip ? 30 : 31} fontSize="9.5" fill="#333" textAnchor="middle">{b.sub.length > 40 ? b.sub.slice(0, 39) + "…" : b.sub}</text>}
          {b.ip && <text x={b.w / 2} y={b.sub ? 43 : 32} fontSize="9.5" fill="#333" textAnchor="middle" fontFamily="ui-monospace, Menlo, Consolas, monospace">{b.ip}</text>}
        </g>
      ))}
    </svg>
  );
}

export default function CleanCatTab({ P, X, onSelectDevice, notify }) {
  const [farbe, setFarbe] = useState(() => localStorage.getItem("np_cc_farbe") || "dante");
  const [zeigeIp, setZeigeIp] = useState(() => localStorage.getItem("np_cc_ip") !== "0");
  const L = useMemo(() => cleanCatLayout(P, X, { farbe, zeigeIp }), [P, X, farbe, zeigeIp]);
  const [view, setView] = useState({ x: 20, y: 20, k: 1 });
  const wrap = useRef(null), svgRef = useRef(null), drag = useRef(null);
  useEffect(() => { try { localStorage.setItem("np_cc_farbe", farbe); localStorage.setItem("np_cc_ip", zeigeIp ? "1" : "0"); } catch { /* */ } }, [farbe, zeigeIp]);

  const einpassen = useCallback(() => {
    const el = wrap.current; if (!el) return;
    const W = L.w + PAD * 2, H = L.h + PAD * 2 + KOPF;
    const k = Math.min(1.6, Math.max(0.15, Math.min((el.clientWidth - 40) / W, (el.clientHeight - 40) / H)));
    setView({ k, x: (el.clientWidth - W * k) / 2, y: 20 });
  }, [L.w, L.h]);
  useEffect(() => { einpassen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const rad = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => { const k = Math.min(4, Math.max(0.1, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }; });
    };
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, []);
  const zoom = (f) => setView((v) => { const el = wrap.current; const mx = el.clientWidth / 2, my = el.clientHeight / 2; const k = Math.min(4, Math.max(0.1, v.k * f)); return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }; });

  const titel = `${P.meta.veranstaltung || "Netzwerkplan"}${P.meta.ort ? " · " + P.meta.ort : ""} · Clean Cat · v${P.meta.version} · ${P.meta.datum}`;
  const exportieren = async (art) => {
    try {
      const svg = new XMLSerializer().serializeToString(svgRef.current);
      const w = L.w + PAD * 2, h = L.h + PAD * 2 + KOPF;
      if (art === "svg") await api.saveFile(svg, `${fileBase(P)} – Clean Cat.svg`, [{ name: "SVG", extensions: ["svg"] }]);
      else await api.saveFile(await svgToPngBase64(svg, w, h), `${fileBase(P)} – Clean Cat.png`, [{ name: "PNG", extensions: ["png"] }], "base64");
    } catch (e) { console.error(e); notify?.("Export fehlgeschlagen: " + e.message, "err"); }
  };

  const knopf = { ...S.ghostBtn, whiteSpace: "nowrap" };
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 14px", borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
        <span className="sp-section-label" style={{ margin: 0 }}>Clean Cat</span>
        <select style={{ ...S.selectSm, width: "auto" }} value={farbe} onChange={(e) => setFarbe(e.target.value)} title="Farbe der Leitungen">
          <option value="dante">Farbe: Dante Primary / Secondary</option>
          <option value="vlan">Farbe: VLAN</option>
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: SUB }}><input type="checkbox" checked={zeigeIp} onChange={(e) => setZeigeIp(e.target.checked)} style={{ accentColor: ACCENT }} /> IP-Adressen</label>
        <button style={knopf} onClick={() => zoom(1 / 1.25)} title="Verkleinern"><ZoomOut size={14} /></button>
        <button style={knopf} onClick={() => zoom(1.25)} title="Vergrößern"><ZoomIn size={14} /></button>
        <button style={knopf} onClick={einpassen} title="Ganzen Plan zeigen"><Maximize2 size={14} /> Einpassen</button>
        <span style={{ flex: 1 }} />
        {farbe === "dante" && <span style={{ display: "inline-flex", gap: 10, fontSize: 11, color: SUB, alignItems: "center" }}>
          {[[CC_FARBEN.primary, "Dante Primary"], [CC_FARBEN.secondary, "Dante Secondary"], [CC_FARBEN.glas, "Glasfaser"], [CC_FARBEN.trunk, "Switch zu Switch"]].map(([c, t]) =>
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 3, background: c, display: "inline-block" }} />{t}</span>)}
        </span>}
        <button style={knopf} onClick={() => exportieren("svg")} title="Als SVG speichern (z. B. für Visio, Illustrator)"><FileCode size={14} /> SVG</button>
        <button style={knopf} onClick={() => exportieren("png")} title="Als PNG speichern"><FileImage size={14} /> PNG</button>
      </div>
      <div ref={wrap} style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", background: "#d9dde1", cursor: drag.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0 && e.button !== 1) return; drag.current = { sx: e.clientX, sy: e.clientY, v: view, bewegt: false }; }}
        onMouseMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.bewegt = true; setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); }}
        onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }} onMouseLeave={() => { drag.current = null; }}>
        {!P.geraete.length && <div style={{ ...S.empty, padding: 30, color: MUTED }}>Noch keine Geräte im Projekt.</div>}
        {P.geraete.length > 0 && <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", boxShadow: "0 4px 24px rgba(0,0,0,.25)" }}>
          <Zeichnung L={L} titel={titel} svgRef={svgRef} onSelect={(id) => { if (!drag.current?.bewegt) onSelectDevice(id); }} />
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#4b525a" }}>{Math.round(view.k * 100)} % · Mausrad = Zoom · Ziehen = verschieben · Klick auf ein Gerät = bearbeiten · Räume = Standort / Ast der Geräte</div>
      </div>
    </div>
  );
}
