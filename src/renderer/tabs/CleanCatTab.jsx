import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, PANEL } from "../../shared/constants.js";
import { cleanCatLayout, cleanCatOptimieren, ccBlatt, passeText } from "../../shared/cleancat.js";
import { api } from "../api.js";
import { fileBase, svgToPngBase64 } from "../exports.js";
import { ladeLogo } from "../logo.js";
import { Maximize2, ZoomIn, ZoomOut, FileImage, FileCode, FileText } from "lucide-react";

/* Clean Cat: Signalfluss-Plan als A3-Blatt (quer) wie eine Visio-Zeichnung.
   Räume = Standorte, Geräte als gleich große Blöcke, Leitungen rechtwinklig,
   unten Legende und Plankopf aus den Projektdaten. Mausrad zoomt, Ziehen
   verschiebt, Klick auf ein Gerät öffnet es im Geräte-Editor. */
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const datumDe = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || ""; };
export const exportStand = (d = new Date()) => d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Text, der nie über seine Breite hinausläuft: data-max wird nach dem Zeichnen gemessen
function T({ x, y, max, fit, anchor = "start", weight, fill = "#111", mono, id }) {
  return (
    <text id={id} x={x} y={y} fontSize={fit.fs} fontWeight={weight} fill={fill} textAnchor={anchor} data-max={max} fontFamily={mono ? MONO : undefined}>
      {fit.t}{fit.voll && <title>{fit.voll}</title>}
    </text>
  );
}

function Zelle({ x, y, w, h, label, wert, fs = 12, weight = 500, id }) {
  const fit = passeText(wert || "–", fs, w - 12, Math.min(fs, 8));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#222" strokeWidth="1" />
      <text x={x + 6} y={y + 11} fontSize="7.5" fill="#666" letterSpacing="0.6">{label.toUpperCase()}</text>
      <T x={x + 6} y={y + h - 9} max={w - 12} fit={fit} weight={weight} id={id} />
    </g>
  );
}

function Plankopf({ B, P, stand, logo }) {
  const { x, y, w, h } = B.kopf, m = P.meta;
  const r1 = 50, r2 = 34, r3 = 34, r4 = h - r1 - r2 - r3;
  const logoW = 150;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#222" strokeWidth="1.6" />
      <Zelle x={x} y={y} w={w - logoW} h={r1} label="Veranstaltung" wert={m.veranstaltung} fs={20} weight={700} />
      <rect x={x + w - logoW} y={y} width={logoW} height={r1} fill="none" stroke="#222" />
      {logo
        ? <image href={logo} x={x + w - logoW + 8} y={y + 5} width={logoW - 16} height={r1 - 10} preserveAspectRatio="xMidYMid meet" />
        : <T x={x + w - logoW / 2} y={y + r1 / 2 + 5} max={logoW - 20} fit={passeText("Netzwerkplaner", 15, logoW - 20, 9)} anchor="middle" weight={800} fill={ACCENT} />}
      <Zelle x={x} y={y + r1} w={w / 2} h={r2} label="Ort / Venue" wert={m.ort} />
      <Zelle x={x + w / 2} y={y + r1} w={w / 2} h={r2} label="Ersteller" wert={m.ersteller} />
      <Zelle x={x} y={y + r1 + r2} w={w * 0.5} h={r3} label="Planinhalt" wert="Clean Cat · Netzwerk-Signalfluss" />
      <Zelle x={x + w * 0.5} y={y + r1 + r2} w={w * 0.25} h={r3} label="Planversion" wert={m.version ? `v${m.version}` : ""} />
      <Zelle x={x + w * 0.75} y={y + r1 + r2} w={w * 0.25} h={r3} label="Format" wert="A3 quer" />
      <Zelle x={x} y={y + r1 + r2 + r3} w={w * 0.5} h={r4} label="Projektdatum" wert={datumDe(m.datum)} />
      <Zelle x={x + w * 0.5} y={y + r1 + r2 + r3} w={w * 0.5} h={r4} label="Exportiert am" wert={stand} id="cc-exportdatum" />
    </g>
  );
}

function Legende({ B, L }) {
  const { x, y, w, h } = B.legende;
  const eintraege = [
    ...L.legende.linien.map((l) => ({ art: "linie", ...l })),
    ...L.legende.boxen.map((b) => ({ art: "box", ...b })),
    { art: "raum", t: "Raum = Standort" },
    ...(L.legende.stapel ? [{ art: "stapel", t: "Stack (Rack, Case)" }] : []),
  ];
  const spW = 220, zeileH = 17, top = y + 32;
  const spalten = Math.max(1, Math.floor((w - 16) / spW)), zeilen = Math.max(1, Math.floor((y + h - 4 - top) / zeileH) + 1);
  const platz = spalten * zeilen;
  const zeigen = eintraege.length > platz ? [...eintraege.slice(0, platz - 1), { art: "mehr", t: `+ ${eintraege.length - platz + 1} weitere` }] : eintraege;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#222" strokeWidth="1.6" />
      <text x={x + 10} y={y + 18} fontSize="10" fontWeight="700" fill="#222" letterSpacing="1.2">LEGENDE</text>
      {zeigen.map((e, i) => {
        const ex = x + 10 + Math.floor(i / zeilen) * spW, ey = top + (i % zeilen) * zeileH;
        const fit = passeText(e.t, 10, spW - 46, 8);
        return (
          <g key={i}>
            {e.art === "linie" && <line x1={ex} y1={ey} x2={ex + 30} y2={ey} stroke={e.col} strokeWidth="2.2" strokeDasharray={e.dash || undefined} />}
            {e.art === "box" && <rect x={ex + 3} y={ey - 6} width={24} height={12} fill={e.fill} stroke="#3b3f45" />}
            {e.art === "raum" && <rect x={ex + 1} y={ey - 7} width={28} height={14} fill="#f6f7f8" stroke="#8a8f96" strokeDasharray="4 3" />}
            {e.art === "stapel" && <rect x={ex + 1} y={ey - 7} width={28} height={14} fill="#ffffff" stroke="#6f7680" strokeWidth="1.2" rx="2" />}
            <T x={ex + 38} y={ey + 3.5} max={spW - 46} fit={fit} fill="#222" />
          </g>
        );
      })}
    </g>
  );
}

function Zeichnung({ L, B, P, stand, logo, svgRef, onBox }) {
  const mid = (c) => "cc-" + c.replace("#", "");
  const farben = [...new Set(L.linien.map((l) => l.col))];
  // Nach dem Zeichnen genau messen: was trotz Schätzung zu breit ist, wird gestaucht
  useLayoutEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    svg.querySelectorAll("text[data-max]").forEach((el) => {
      el.removeAttribute("textLength"); el.removeAttribute("lengthAdjust");
      const max = +el.getAttribute("data-max");
      try { if (max > 0 && el.getComputedTextLength() > max) { el.setAttribute("textLength", max); el.setAttribute("lengthAdjust", "spacingAndGlyphs"); } } catch { /* nicht gerendert */ }
    });
  });
  return (
    <svg ref={svgRef} data-cleancat="1" xmlns="http://www.w3.org/2000/svg" width={B.w} height={B.h} viewBox={`0 0 ${B.w} ${B.h}`}
      style={{ display: "block", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <defs>{farben.map((c) => (
        <marker key={c} id={mid(c)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill={c} /></marker>
      ))}</defs>
      <rect x={0} y={0} width={B.w} height={B.h} fill="#ffffff" />
      <rect x={B.rand} y={B.rand} width={B.w - 2 * B.rand} height={B.h - 2 * B.rand} fill="none" stroke="#222" strokeWidth="1.6" />
      <g transform={`translate(${B.x},${B.y}) scale(${B.k})`}>
        {L.raeume.map((r) => (
          <g key={r.name}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f6f7f8" stroke="#8a8f96" strokeWidth="1.2" strokeDasharray="6 4" rx="3" />
            <rect x={r.x} y={r.y} width={r.w} height={24} fill="#dfeefb" stroke="none" />
            <line x1={r.x} y1={r.y + 24} x2={r.x + r.w} y2={r.y + 24} stroke="#b9cfe3" />
            <T x={r.x + r.w / 2} y={r.y + 17} max={r.w - 12} fit={passeText(r.name, 13.5, r.w - 12, 9)} anchor="middle" weight={600} fill="#222" />
            {(r.anmerkung || []).map((z, i) => (
              <T key={i} x={r.x + 8} y={r.y + 24 + 13 + i * 12.5} max={r.w - 16} fit={passeText(z, 10, r.w - 16, 10)} fill="#444" />
            ))}
          </g>
        ))}
        {(L.stapel || []).map((r) => (
          <g key={"st" + r.standort + r.name + r.x}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#ffffff" stroke="#6f7680" strokeWidth="1.2" rx="3" />
            <rect x={r.x + 0.6} y={r.y + 0.6} width={r.w - 1.2} height={20} fill="#eceef1" stroke="none" rx="2.5" />
            <line x1={r.x} y1={r.y + 21} x2={r.x + r.w} y2={r.y + 21} stroke="#c3c8ce" />
            <T x={r.x + 8} y={r.y + 14.5} max={r.w - 16} fit={passeText(r.name, 11, r.w - 16, 8)} weight={600} fill="#333" />
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
        {L.boxen.map((b) => {
          const frei = b.w - 20, zeilen = [b.tName, b.tSub, b.tIp].filter(Boolean).length;
          const kopfH = b.basisH || b.h;
          const yName = zeilen === 3 ? 17 : zeilen === 2 ? 20 : kopfH / 2 + 4;
          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})`} style={{ cursor: onBox ? "pointer" : "default" }} onClick={onBox ? () => onBox(b.id) : undefined}>
              <rect width={b.w} height={b.h} fill={b.fill} stroke="#3b3f45" strokeWidth={1} />
              <T x={b.w / 2} y={yName} max={frei} fit={b.tName} anchor="middle" weight={600} />
              {b.tSub && <T x={b.w / 2} y={zeilen === 3 ? 30 : 34} max={frei} fit={b.tSub} anchor="middle" fill="#333" />}
              {b.tIp && <T x={b.w / 2} y={b.tSub ? 43 : 34} max={frei} fit={b.tIp} anchor="middle" fill="#333" mono />}
              {b.notiz && (
                <>
                  <line x1={6} y1={kopfH - 2} x2={b.w - 6} y2={kopfH - 2} stroke="#3b3f45" strokeOpacity="0.3" />
                  {b.notiz.map((z, i) => <T key={i} x={b.w / 2} y={kopfH + 10 + i * 10.5} max={frei} fit={passeText(z, 8.5, frei, 8.5)} anchor="middle" fill="#444" />)}
                  <title>{b.notizVoll}</title>
                </>
              )}
            </g>
          );
        })}
      </g>
      <Legende B={B} L={L} />
      <Plankopf B={B} P={P} stand={stand} logo={logo} />
    </svg>
  );
}

export default function CleanCatTab({ P, X, onSelectDevice, notify, kopf, svgRef: fremdRef }) {
  const [farbe, setFarbe] = useState(() => localStorage.getItem("np_cc_farbe") || "dante");
  const [zeigeIp, setZeigeIp] = useState(() => localStorage.getItem("np_cc_ip") !== "0");
  // Automatische Anordnung mit kurzen Kabelwegen: nur neu rechnen, wenn sich Geräte, Kabel oder Stacks ändern
  const { ordnung } = useMemo(() => cleanCatOptimieren(P, X, { zeigeIp }), [P.geraete, P.verbindungen, P.layout.stapel, P.bereiche, zeigeIp]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = useMemo(() => cleanCatLayout(P, X, { farbe, zeigeIp, ordnung }), [P, X, farbe, zeigeIp, ordnung]);
  const B = useMemo(() => ccBlatt(L), [L]);
  const [view, setView] = useState({ x: 20, y: 20, k: 0.6 });
  const wrap = useRef(null), eigenRef = useRef(null), drag = useRef(null);
  const svgRef = fremdRef || eigenRef;
  const logo = ladeLogo();
  const stand = exportStand();
  useEffect(() => { try { localStorage.setItem("np_cc_farbe", farbe); localStorage.setItem("np_cc_ip", zeigeIp ? "1" : "0"); } catch { /* */ } }, [farbe, zeigeIp]);

  const einpassen = useCallback(() => {
    const el = wrap.current; if (!el) return;
    const k = Math.min(1.5, Math.max(0.1, Math.min((el.clientWidth - 40) / B.w, (el.clientHeight - 40) / B.h)));
    setView({ k, x: (el.clientWidth - B.w * k) / 2, y: (el.clientHeight - B.h * k) / 2 });
  }, [B.w, B.h]);
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

  // Export mit frischem Exportdatum im Plankopf
  const svgText = () => {
    const clone = svgRef.current.cloneNode(true);
    const d = clone.querySelector("#cc-exportdatum");
    if (d) d.firstChild.textContent = exportStand();
    clone.querySelectorAll("[data-max]").forEach((n) => n.removeAttribute("data-max"));
    clone.removeAttribute("data-cleancat");
    clone.removeAttribute("style");
    clone.setAttribute("font-family", "'Segoe UI',system-ui,sans-serif");
    return new XMLSerializer().serializeToString(clone);
  };
  const exportieren = async (art) => {
    try {
      const name = `${fileBase(P)} – Clean Cat`;
      if (art === "svg") await api.saveFile(svgText(), `${name}.svg`, [{ name: "SVG", extensions: ["svg"] }]);
      else if (art === "png") await api.saveFile(await svgToPngBase64(svgText(), B.w, B.h), `${name}.png`, [{ name: "PNG", extensions: ["png"] }], "base64");
      else await api.exportPdf(`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:420mm;height:297mm}</style></head><body>${svgText()}</body></html>`, name, { pageSize: "A3" });
    } catch (e) { console.error(e); notify?.("Export fehlgeschlagen: " + e.message, "err"); }
  };

  const knopf = { ...S.ghostBtn, whiteSpace: "nowrap" };
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", background: PANEL, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap", flexShrink: 0 }}>
        {kopf}
        <select style={{ ...S.selectSm, width: "auto" }} value={farbe} onChange={(e) => setFarbe(e.target.value)} title="Farbe der Leitungen">
          <option value="dante">Farbe: Dante Primary / Secondary</option>
          <option value="vlan">Farbe: VLAN</option>
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: SUB }}><input type="checkbox" checked={zeigeIp} onChange={(e) => setZeigeIp(e.target.checked)} style={{ accentColor: ACCENT }} /> IP-Adressen</label>
        <button style={knopf} onClick={() => zoom(1 / 1.25)} title="Verkleinern"><ZoomOut size={14} /></button>
        <button style={knopf} onClick={() => zoom(1.25)} title="Vergrößern"><ZoomIn size={14} /></button>
        <button style={knopf} onClick={einpassen} title="Ganzes Blatt zeigen"><Maximize2 size={14} /> Einpassen</button>
        <span style={{ flex: 1 }} />
        <button style={knopf} onClick={() => exportieren("pdf")} title="Als PDF im Format A3 quer speichern"><FileText size={14} /> PDF A3</button>
        <button style={knopf} onClick={() => exportieren("svg")} title="Als SVG speichern (z. B. für Visio, Illustrator)"><FileCode size={14} /> SVG</button>
        <button style={knopf} onClick={() => exportieren("png")} title="Als PNG speichern"><FileImage size={14} /> PNG</button>
      </div>
      <div ref={wrap} style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", background: "#d9dde1", cursor: drag.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0 && e.button !== 1) return; drag.current = { sx: e.clientX, sy: e.clientY, v: view, bewegt: false }; }}
        onMouseMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.bewegt = true; setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); }}
        onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }} onMouseLeave={() => { drag.current = null; }}>
        {!P.geraete.length && <div style={{ ...S.empty, padding: 30, color: MUTED }}>Noch keine Geräte im Projekt.</div>}
        {P.geraete.length > 0 && <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", boxShadow: "0 4px 24px rgba(0,0,0,.25)" }}>
          <Zeichnung L={L} B={B} P={P} stand={stand} logo={logo} svgRef={svgRef} onBox={(id) => { if (!drag.current?.bewegt) onSelectDevice?.(id); }} />
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#4b525a" }}>{Math.round(view.k * 100)} % · A3 quer · Mausrad = Zoom · Ziehen = verschieben · Klick auf ein Gerät = bearbeiten</div>
      </div>
    </div>
  );
}
