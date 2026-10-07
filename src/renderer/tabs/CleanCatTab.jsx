import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, PANEL } from "../../shared/constants.js";
import { cleanCatLayout, cleanCatOptimieren, ccBlatt, passeText, BLATT_FORMATE, plottFormat, PLOTT_GROESSEN, plottGroesse } from "../../shared/cleancat.js";
import { api } from "../api.js";
import { fileBase, svgToPngBase64 } from "../exports.js";
import { ladeLogo } from "../logo.js";
import { Maximize2, ZoomIn, ZoomOut, FileImage, FileCode, FileText, RotateCcw } from "lucide-react";

/* Plott: Signalfluss-Plan als Blatt (A3/A4, quer oder hoch) wie eine Visio-Zeichnung.
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
      <Zelle x={x} y={y + r1 + r2} w={w * 0.5} h={r3} label="Planinhalt" wert="Plott · Netzwerk-Signalfluss" />
      <Zelle x={x + w * 0.5} y={y + r1 + r2} w={w * 0.25} h={r3} label="Planversion" wert={m.version ? `v${m.version}` : ""} />
      <Zelle x={x + w * 0.75} y={y + r1 + r2} w={w * 0.25} h={r3} label="Format" wert={B.label} />
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

function Zeichnung({ L, B, P, stand, logo, svgRef, onBox, onRaumDown, zieh }) {
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
          <g key={r.name} onMouseDown={onRaumDown ? (e) => onRaumDown(e, r.name) : undefined} style={{ cursor: onRaumDown ? "move" : undefined }} opacity={zieh?.name === r.name && zieh.bewegt ? 0.45 : 1}>
            <title>{`Standort ${r.name} · ziehen = an eine andere Stelle im Plan setzen`}</title>
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
          // Kasten in eigenen Maßen zeichnen und mit b.s auf die Plott-Größe bringen
          const s = b.s || 1, bw = b.w / s, bh = b.h / s;
          const frei = bw - 20, zeilen = [b.tName, b.tSub, b.tIp].filter(Boolean).length;
          const kopfH = (b.basisH || b.h) / s;
          const yName = zeilen === 3 ? 17 : zeilen === 2 ? 20 : kopfH / 2 + 4;
          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})${s !== 1 ? ` scale(${s})` : ""}`} style={{ cursor: onBox ? "pointer" : "default" }} onClick={onBox ? () => onBox(b.id) : undefined}>
              <rect width={bw} height={bh} fill={b.fill} stroke="#3b3f45" strokeWidth={1} />
              <T x={bw / 2} y={yName} max={frei} fit={b.tName} anchor="middle" weight={600} />
              {b.tSub && <T x={bw / 2} y={zeilen === 3 ? 30 : 34} max={frei} fit={b.tSub} anchor="middle" fill="#333" />}
              {b.tIp && <T x={bw / 2} y={b.tSub ? 43 : 34} max={frei} fit={b.tIp} anchor="middle" fill="#333" mono />}
              {b.notiz && (
                <>
                  <line x1={6} y1={kopfH - 2} x2={bw - 6} y2={kopfH - 2} stroke="#3b3f45" strokeOpacity="0.3" />
                  {b.notiz.map((z, i) => <T key={i} x={bw / 2} y={kopfH + 10 + i * 10.5} max={frei} fit={passeText(z, 8.5, frei, 8.5)} anchor="middle" fill="#444" />)}
                  <title>{b.notizVoll}</title>
                </>
              )}
            </g>
          );
        })}
        {zieh?.bewegt && (() => {
          const r = L.raeume.find((x) => x.name === zieh.name);
          if (!r) return null;
          const z = zieh.ziel && L.raeume.find((x) => x.name === zieh.ziel.name);
          return <g pointerEvents="none">
            <rect x={r.x + zieh.dx} y={r.y + zieh.dy} width={r.w} height={r.h} fill="#2c3b9314" stroke="#2c3b93" strokeWidth="2" strokeDasharray="8 5" rx="3" />
            {z && <line x1={zieh.ziel.vor ? z.x - 12 : z.x + z.w + 12} x2={zieh.ziel.vor ? z.x - 12 : z.x + z.w + 12} y1={z.y} y2={z.y + z.h} stroke="#2c3b93" strokeWidth="5" strokeLinecap="round" />}
          </g>;
        })()}
      </g>
      <Legende B={B} L={L} />
      <Plankopf B={B} P={P} stand={stand} logo={logo} />
    </svg>
  );
}

/* Ziel beim Ziehen eines Standorts: neben dem nächstgelegenen anderen Standort,
   davor oder dahinter je nachdem, auf welcher Seite seiner Mitte man loslässt. */
const standortZiel = (L, name, dx, dy) => {
  const r = L.raeume.find((x) => x.name === name);
  if (!r) return null;
  const cx = r.x + r.w / 2 + dx, cy = r.y + r.h / 2 + dy;
  let best = null;
  for (const o of L.raeume) {
    if (o.name === name) continue;
    const ex = Math.max(o.x - cx, 0, cx - (o.x + o.w)), ey = Math.max(o.y - cy, 0, cy - (o.y + o.h));
    const d = Math.hypot(ex, ey);
    if (!best || d < best.d) best = { d, name: o.name, vor: cx < o.x + o.w / 2 };
  }
  return best;
};
export const standortVerschieben = (namen, name, ziel) => {
  if (!ziel) return namen;
  const rest = namen.filter((n) => n !== name);
  const i = rest.indexOf(ziel.name);
  if (i < 0) return namen;
  rest.splice(ziel.vor ? i : i + 1, 0, name);
  return rest;
};

export default function CleanCatTab({ P, X, mutate, onSelectDevice, notify, kopf, svgRef: fremdRef }) {
  const [farbe, setFarbe] = useState(() => localStorage.getItem("np_cc_farbe") || "dante");
  const [zeigeIp, setZeigeIp] = useState(() => localStorage.getItem("np_cc_ip") !== "0");
  // Automatische Anordnung mit kurzen Kabelwegen: nur neu rechnen, wenn sich Geräte, Kabel oder Stacks ändern
  const format = plottFormat(P), groesse = plottGroesse(P);
  const { ordnung } = useMemo(() => cleanCatOptimieren(P, X, { zeigeIp, format, groesse }), [P.geraete, P.verbindungen, P.layout.stapel, P.layout.cleancatStandorte, P.bereiche, P.standortInfo, zeigeIp, format, groesse]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = useMemo(() => cleanCatLayout(P, X, { farbe, zeigeIp, ordnung, format, groesse }), [P, X, farbe, zeigeIp, ordnung, format, groesse]);
  const [zieh, setZieh] = useState(null); // Standort ziehen: { name, sx, sy, dx, dy, bewegt, ziel }
  const B = useMemo(() => ccBlatt(L, format), [L, format]);
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
  useEffect(() => { einpassen(); }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const name = `${fileBase(P)} – Plott`;
      if (art === "svg") await api.saveFile(svgText(), `${name}.svg`, [{ name: "SVG", extensions: ["svg"] }]);
      else if (art === "png") await api.saveFile(await svgToPngBase64(svgText(), B.w, B.h), `${name}.png`, [{ name: "PNG", extensions: ["png"] }], "base64");
      else await api.exportPdf(`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><style>@page{size:${B.seite} ${B.hoch ? "portrait" : "landscape"};margin:0}html,body{margin:0;padding:0}svg{display:block;width:${B.w / B.mm}mm;height:${B.h / B.mm}mm}</style></head><body>${svgText()}</body></html>`, name, { pageSize: B.seite, hoch: B.hoch });
    } catch (e) { console.error(e); notify?.("Export fehlgeschlagen: " + e.message, "err"); }
  };

  // Ganze Standorte ziehen: setzt den Standort an eine andere Stelle der Reihenfolge, der Plan ordnet neu
  const raumDown = (e, name) => {
    if (e.button !== 0 || !mutate) return;
    e.stopPropagation();
    setZieh({ name, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, bewegt: false, ziel: null });
  };
  const raumBewegen = (e) => {
    if (!zieh) return false;
    const f = view.k * B.k, dx = (e.clientX - zieh.sx) / f, dy = (e.clientY - zieh.sy) / f;
    const bewegt = zieh.bewegt || Math.abs(e.clientX - zieh.sx) + Math.abs(e.clientY - zieh.sy) > 4;
    setZieh({ ...zieh, dx, dy, bewegt, ziel: bewegt ? standortZiel(L, zieh.name, dx, dy) : null });
    return true;
  };
  const raumEnde = () => {
    if (!zieh) return false;
    const { name, bewegt, ziel } = zieh;
    setZieh(null);
    if (bewegt && ziel) {
      const namen = L.raeume.map((r) => r.name);
      const neu = standortVerschieben(namen, name, ziel);
      if (neu.join("\u0001") !== namen.join("\u0001")) mutate((d) => { d.layout.cleancatStandorte = neu; });
    }
    return true;
  };
  const vonHand = (P.layout.cleancatStandorte || []).length > 0;
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
        {mutate && <button style={knopf} disabled={!vonHand} onClick={() => mutate((d) => { delete d.layout.cleancatStandorte; })} title="Von Hand gesetzte Reihenfolge der Standorte verwerfen. Der Plan ordnet sie wieder selbst, mit möglichst kurzen Kabelwegen und wenig Kreuzungen."><RotateCcw size={14} /> Standorte automatisch</button>}
        <select style={{ ...S.selectSm, width: "auto" }} value={format} title="Blattformat des Plans (gilt auch für den Export)"
          onChange={(e) => { const v = e.target.value; mutate?.((d) => { if (v === "A3-quer") delete d.layout.plottFormat; else d.layout.plottFormat = v; }); }} disabled={!mutate}>
          {Object.entries(BLATT_FORMATE).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
        </select>
        <select style={{ ...S.selectSm, width: "auto" }} value={groesse} title="Größe der Geräte-Kästen. Kleiner lässt mehr Platz zwischen den Einträgen, größer füllt das Blatt. Gilt auch für den Export."
          onChange={(e) => { const v = +e.target.value; mutate?.((d) => { if (v === 1) delete d.layout.plottGroesse; else d.layout.plottGroesse = v; }); }} disabled={!mutate}>
          {PLOTT_GROESSEN.map((g) => <option key={g} value={g}>Kästen {Math.round(g * 100)} %</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button style={knopf} onClick={() => exportieren("pdf")} title={`Als PDF im Format ${B.label} speichern`}><FileText size={14} /> PDF {B.seite}</button>
        <button style={knopf} onClick={() => exportieren("svg")} title="Als SVG speichern (z. B. für Visio, Illustrator)"><FileCode size={14} /> SVG</button>
        <button style={knopf} onClick={() => exportieren("png")} title="Als PNG speichern"><FileImage size={14} /> PNG</button>
      </div>
      <div ref={wrap} style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", background: "#d9dde1", cursor: drag.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0 && e.button !== 1) return; drag.current = { sx: e.clientX, sy: e.clientY, v: view, bewegt: false }; }}
        onMouseMove={(e) => { if (raumBewegen(e)) return; const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.bewegt = true; setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); }}
        onMouseUp={() => { if (raumEnde()) return; setTimeout(() => { drag.current = null; }, 0); }} onMouseLeave={() => { raumEnde(); drag.current = null; }}>
        {!P.geraete.length && <div style={{ ...S.empty, padding: 30, color: MUTED }}>Noch keine Geräte im Projekt.</div>}
        {P.geraete.length > 0 && <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", boxShadow: "0 4px 24px rgba(0,0,0,.25)" }}>
          <Zeichnung L={L} B={B} P={P} stand={stand} logo={logo} svgRef={svgRef} onBox={(id) => { if (!drag.current?.bewegt) onSelectDevice?.(id); }} onRaumDown={mutate ? raumDown : null} zieh={zieh} />
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#4b525a" }}>{Math.round(view.k * 100)} % · {B.label} · Mausrad = Zoom · Ziehen = verschieben · Standort ziehen = an andere Stelle setzen · Klick auf ein Gerät = bearbeiten</div>
      </div>
    </div>
  );
}
