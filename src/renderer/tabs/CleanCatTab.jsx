import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, PANEL, KATEGORIEN } from "../../shared/constants.js";
import { STANDARD_PROFIL, EINGEBAUTE_PROFILE, eingebautesProfil, projektProfil, profilFelder, profilVergleich, profilDatei, profilLesen, STUFEN, FELDER, GEWERKE, PROFIL_ENDUNG, katGrundfarbe } from "../../shared/plottprofil.js";
import { uid } from "../../shared/catalog.js";
import { frageText } from "../ui.jsx";
import { cleanCatLayout, cleanCatOptimieren, ccBlatt, passeText, BLATT_FORMATE, plottFormat, PLOTT_GROESSEN, plottGroesse, kabelLabelAn, anteilAufPfad, PORT_LEISTE } from "../../shared/cleancat.js";
import { api } from "../api.js";
import { fileBase, svgToPngBase64 } from "../exports.js";
import { ladeLogo } from "../logo.js";
import { Maximize2, ZoomIn, ZoomOut, FileImage, FileCode, FileText, RotateCcw, SlidersHorizontal } from "lucide-react";

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

function Plankopf({ B, P, stand, logo, D }) {
  const { x, y, w, h } = B.kopf, m = P.meta;
  const r1 = 50, r2 = 34, r3 = 34, r4 = h - r1 - r2 - r3;
  const logoW = 150;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={D.rahmen} strokeWidth="1.6" />
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

function Legende({ B, L, D }) {
  const { x, y, w, h } = B.legende;
  const eintraege = [
    ...L.legende.linien.map((l) => ({ art: "linie", ...l })),
    ...L.legende.boxen.map((b) => ({ art: "box", ...b })),
    ...(L.legende.fluss ? [{ art: "einweg", t: "Signal in eine Richtung" }] : []),
    { art: "raum", t: "Raum = Standort" },
    ...(L.legende.stapel ? [{ art: "stapel", t: "Stack (Rack, Case)" }] : []),
    ...(L.legende.sammel ? [{ art: "sammel", t: "n× = gleiche Geräte zusammengefasst" }] : []),
  ];
  const spW = 220, zeileH = 17, top = y + 32;
  const spalten = Math.max(1, Math.floor((w - 16) / spW)), zeilen = Math.max(1, Math.floor((y + h - 4 - top) / zeileH) + 1);
  const platz = spalten * zeilen;
  const zeigen = eintraege.length > platz ? [...eintraege.slice(0, platz - 1), { art: "mehr", t: `+ ${eintraege.length - platz + 1} weitere` }] : eintraege;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={D.rahmen} strokeWidth="1.6" />
      <text x={x + 10} y={y + 18} fontSize="10" fontWeight="700" fill="#222" letterSpacing="1.2">LEGENDE</text>
      {zeigen.map((e, i) => {
        const ex = x + 10 + Math.floor(i / zeilen) * spW, ey = top + (i % zeilen) * zeileH;
        const fit = passeText(e.t, 10, spW - 46, 8);
        return (
          <g key={i}>
            {e.art === "linie" && <line x1={ex} y1={ey} x2={ex + 30} y2={ey} stroke={e.col} strokeWidth="2.2" strokeDasharray={e.dash || undefined} />}
            {(e.art === "einweg" || e.art === "zweiweg") && <g>
              <line x1={ex + 2} y1={ey} x2={ex + 28} y2={ey} stroke="#3a3f45" strokeWidth="1.6" />
              <path d={`M${ex + 30} ${ey} l-7 -3.5 v7 z`} fill="#3a3f45" />
              {e.art === "zweiweg" && <path d={`M${ex} ${ey} l7 -3.5 v7 z`} fill="#3a3f45" />}
            </g>}
            {e.art === "box" && <rect x={ex + 3} y={ey - 6} width={24} height={12} fill={e.fill} stroke={D.boxRand} />}
            {e.art === "raum" && <rect x={ex + 1} y={ey - 7} width={28} height={14} fill={D.raum.fuellung} stroke={D.raum.rand} strokeDasharray="4 3" />}
            {e.art === "stapel" && <rect x={ex + 1} y={ey - 7} width={28} height={14} fill={D.stack.fuellung} stroke={D.stack.rand} strokeWidth="1.2" rx="2" />}
            {e.art === "sammel" && <g><rect x={ex + 6} y={ey - 3} width={22} height={10} fill="#fff" stroke={D.boxRand} /><rect x={ex + 3} y={ey - 6} width={22} height={10} fill="#fff" stroke={D.boxRand} /></g>}
            <T x={ex + 38} y={ey + 3.5} max={spW - 46} fit={fit} fill="#222" />
          </g>
        );
      })}
    </g>
  );
}

/* Pfeil mitten auf dem längsten Stück einer Einweg-Leitung, damit die Richtung auch bei
   langen Wegen ohne Blick auf die Enden lesbar ist. */
function FlussPfeil({ pts, rueck, col }) {
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]], l = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (!best || l > best.l) best = { a, b, l };
  }
  if (!best || best.l < 40) return null;
  const [a, b] = rueck ? [best.b, best.a] : [best.a, best.b];
  const w = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return <path d="M4 0 L-4 -3.6 L-4 3.6 z" fill={col} transform={`translate(${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2}) rotate(${w})`} />;
}

export function Zeichnung({ L, B, P, stand, logo, svgRef, onBox, onRaumDown, zieh, onLabelDown, onLabelReset, onBoxDown, onStapelDown, boxZieh, onLineDown, onLineReset, onBoxDouble, sel }) {
  const D = L.design || STANDARD_PROFIL.design;
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
      style={{ display: "block", fontFamily: D.schrift, userSelect: "none" }}>
      <defs>{farben.map((c) => (
        <marker key={c} id={mid(c)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill={c} /></marker>
      ))}</defs>
      <rect x={0} y={0} width={B.w} height={B.h} fill={D.papier} />
      <rect x={B.rand} y={B.rand} width={B.w - 2 * B.rand} height={B.h - 2 * B.rand} fill="none" stroke={D.rahmen} strokeWidth="1.6" />
      <g transform={`translate(${B.x},${B.y}) scale(${B.k})`}>
        {L.raeume.map((r) => (
          <g key={r.name} onMouseDown={onRaumDown ? (e) => onRaumDown(e, r.name) : undefined} style={{ cursor: onRaumDown ? "move" : undefined }} opacity={zieh?.name === r.name && zieh.bewegt ? 0.45 : 1}>
            <title>{`Standort ${r.name} · ziehen = an eine andere Stelle im Plan setzen`}</title>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={D.raum.fuellung} stroke={D.raum.rand} strokeWidth="1.2" strokeDasharray={D.raum.strich || undefined} rx="3" />
            <rect x={r.x} y={r.y} width={r.w} height={24} fill={D.raum.kopf} stroke="none" />
            <line x1={r.x} y1={r.y + 24} x2={r.x + r.w} y2={r.y + 24} stroke={D.raum.kopfLinie} />
            <T x={r.x + r.w / 2} y={r.y + 17} max={r.w - 12} fit={passeText(r.name, 13.5, r.w - 12, 9)} anchor="middle" weight={600} fill="#222" />
            {(r.anmerkung || []).map((z, i) => (
              <T key={i} x={r.x + 8} y={r.y + 24 + 13 + i * 12.5} max={r.w - 16} fit={passeText(z, 10, r.w - 16, 10)} fill="#444" />
            ))}
          </g>
        ))}
        {(L.stapel || []).map((r) => (
          <g key={"st" + r.standort + r.name + r.x} onMouseDown={onStapelDown ? (e) => onStapelDown(e, r.id) : undefined} style={{ cursor: onStapelDown ? "move" : undefined }}
            opacity={boxZieh?.art === "stapel" && boxZieh.id === r.id && boxZieh.bewegt ? 0.45 : 1}>
            {onStapelDown && <title>{`Stack ${r.name} · ziehen = an eine andere Stelle im Standort setzen`}</title>}
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={D.stack.fuellung} stroke={D.stack.rand} strokeWidth="1.2" rx="3" />
            <rect x={r.x + 0.6} y={r.y + 0.6} width={r.w - 1.2} height={20} fill={D.stack.kopf} stroke="none" rx="2.5" />
            <line x1={r.x} y1={r.y + 21} x2={r.x + r.w} y2={r.y + 21} stroke={D.stack.kopfLinie} />
            <T x={r.x + 8} y={r.y + 14.5} max={r.w - 16} fit={passeText(r.name, 11, r.w - 16, 8)} weight={600} fill="#333" />
          </g>
        ))}
        {L.linien.map((l, i) => (
          <g key={l.id + i} opacity={l.blass ? 0.25 : undefined}>
            <polyline points={l.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={l.col} strokeWidth={D.linienBreite} strokeDasharray={l.dash || undefined}
              markerStart={l.pfeil?.start !== false ? `url(#${mid(l.col)})` : undefined} markerEnd={l.pfeil?.ende !== false ? `url(#${mid(l.col)})` : undefined} strokeLinejoin="round" />
            {l.einweg && <FlussPfeil pts={l.pts} rueck={!l.pfeil.ende} col={l.col} />}
            {sel?.art === "linie" && sel.id === l.id && <polyline points={l.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#2c3b93" strokeOpacity="0.35" strokeWidth={D.linienBreite + 5} strokeLinejoin="round" pointerEvents="none" />}
            {onLineDown && l.pts.slice(1).map((b, k) => {
              // Unsichtbare, breite Griffe je Strecke: mittlere Strecken lassen sich quer verschieben
              const a = l.pts[k], innen = k > 0 && k < l.pts.length - 2, waag = Math.abs(a[1] - b[1]) < 0.01;
              return <line key={"h" + k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth="8"
                style={{ cursor: innen ? (waag ? "ns-resize" : "ew-resize") : "pointer" }}
                onMouseDown={(e) => onLineDown(e, l.id, innen ? k : null)} onDoubleClick={(e) => { e.stopPropagation(); onLineReset?.(l.id); }}>
                <title>{innen ? "Ziehen = Strecke verschieben · Klick = auswählen · Doppelklick = Verlauf automatisch" : "Klick = auswählen · Doppelklick = Verlauf automatisch"}</title>
              </line>;
            })}
            {l.labels.map((t, k) => {
              // Kabelbeschriftung: auf der Leitung verschiebbar, Doppelklick = wieder automatisch
              const zug = t.kabel && onLabelDown ? { onMouseDown: (e) => onLabelDown(e, l.id), onDoubleClick: (e) => { e.stopPropagation(); onLabelReset?.(l.id); }, style: { cursor: "grab" } } : {};
              const titel = t.kabel && onLabelDown ? <title>{`${l.kabelVoll || t.t}\nZiehen = auf dem Kabel verschieben · Doppelklick = automatisch`}</title> : null;
              return t.rot
                ? <text key={k} transform={`translate(${t.x},${t.y}) rotate(-90)`} fontSize={t.kabel ? 8 : 7.5} fill={D.textNeben} textAnchor={t.anchor || "start"} {...(t.kabel ? { paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 2.5 } : {})} {...zug}>{titel}{t.t}</text>
                : <text key={k} x={t.x} y={t.y} fontSize="8" fill={D.textNeben} textAnchor={t.anchor || "start"} paintOrder="stroke" stroke="#ffffff" strokeWidth="2.5" {...zug}>{titel}{t.t}</text>;
            })}
          </g>
        ))}
        {L.boxen.map((b) => {
          // Kasten in eigenen Maßen zeichnen und mit b.s auf die Plott-Größe bringen
          const s = b.s || 1, bw = b.w / s, bh = b.h / s;
          const frei = bw - 20, zeilen = [b.tName, b.tSub, b.tIp].filter(Boolean).length;
          const kopfH = (b.basisH || b.h) / s;
          const dT = b.dT || 0, dB = b.dB || 0; // Zuschlag für größere Schrift
          const yName = zeilen === 3 ? 17 + dT : zeilen === 2 ? 20 + dT : kopfH / 2 + 4 * (b.gT || 1);
          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})${s !== 1 ? ` scale(${s})` : ""}`} style={{ cursor: onBoxDown ? "move" : onBox ? "pointer" : "default" }}
              opacity={boxZieh?.art === "box" && boxZieh.id === b.id && boxZieh.bewegt ? 0.45 : b.blass ? 0.25 : 1}
              onMouseDown={onBoxDown ? (e) => onBoxDown(e, b.id) : undefined} onClick={!onBoxDown && onBox ? () => onBox(b.id) : undefined}
              onDoubleClick={onBoxDouble ? (e) => { e.stopPropagation(); onBoxDouble(b.id); } : undefined}>
              {b.sammel && <rect x={4} y={-4} width={bw} height={bh} fill={b.fill} stroke={D.boxRand} strokeWidth={1} />}
              <rect width={bw} height={bh} fill={b.fill} stroke={D.boxRand} strokeWidth={1} />
              {b.sammel && <title>{b.sammelNamen.join("\n")}</title>}
              <g transform={b.leisteOben ? `translate(0,${b.leisteH || PORT_LEISTE})` : undefined}>
              <T x={bw / 2} y={yName} max={frei} fit={b.tName} anchor="middle" weight={600} fill={D.text} />
              {b.tSub && <T x={bw / 2} y={(zeilen === 3 ? 30 : 34) + dT + dB} max={frei} fit={b.tSub} anchor="middle" fill={D.textNeben} />}
              {b.tIp && <T x={bw / 2} y={(b.tSub ? 43 + dB : 34) + dT + dB} max={frei} fit={b.tIp} anchor="middle" fill={D.textNeben} mono />}
              {b.notiz && (
                <>
                  <line x1={6} y1={kopfH - 2} x2={bw - 6} y2={kopfH - 2} stroke={D.boxRand} strokeOpacity="0.3" />
                  {b.notiz.map((z, i) => <T key={i} x={bw / 2} y={kopfH + 10 + i * 10.5} max={frei} fit={passeText(z, 8.5, frei, 8.5)} anchor="middle" fill="#444" />)}
                  <title>{b.notizVoll}</title>
                </>
              )}
              </g>
              {sel?.art === "box" && sel.id === b.id && <rect x={-3} y={-3} width={bw + 6} height={bh + 6} fill="none" stroke="#2c3b93" strokeWidth="2" strokeDasharray="5 3" rx="2" pointerEvents="none" />}
            </g>
          );
        })}
        {(L.ports || []).map((p, i) => (
          // Port-Leiste im Kasten: Zellen in VLAN- bzw. eigener Farbe, Name darin; unbelegte blasser
          <g key={"p" + i} opacity={L.boxen.find((b) => b.id === p.an)?.blass ? 0.25 : undefined} pointerEvents="none">
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} fillOpacity={p.frei ? 0.45 : 1} stroke={D.boxRand} strokeWidth="0.8" />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 + p.t.fs * 0.36} fontSize={p.t.fs} textAnchor="middle" fill={p.hell ? "#111" : "#fff"} fontWeight="600">{p.t.t}</text>
          </g>
        ))}
        {boxZieh?.bewegt && (() => {
          // Kasten oder Stack ziehen: Vorschau und Einfügemarke neben dem Ziel
          const liste = boxZieh.art === "box" ? L.boxen : L.stapel || [];
          const r = liste.find((x) => x.id === boxZieh.id);
          if (!r) return null;
          const z = boxZieh.ziel && liste.find((x) => x.id === boxZieh.ziel.name);
          const xm = z && (boxZieh.ziel.vor ? z.x - 7 : z.x + z.w + 7);
          return <g pointerEvents="none">
            <rect x={r.x + boxZieh.dx} y={r.y + boxZieh.dy} width={r.w} height={r.h} fill="#2c3b9314" stroke="#2c3b93" strokeWidth="2" strokeDasharray="8 5" rx="3" />
            {z && <line x1={xm} x2={xm} y1={z.y} y2={z.y + z.h} stroke="#2c3b93" strokeWidth="4" strokeLinecap="round" />}
          </g>;
        })()}
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
      <Legende B={B} L={L} D={D} />
      <Plankopf B={B} P={P} stand={stand} logo={logo} D={D} />
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

const tief = (x) => JSON.parse(JSON.stringify(x));
// Einstellungen dieses Rechners aus der Zeit vor den Profilen: gelten für Projekte ohne eigenes Profil
const lokaleVorgaben = () => { try { return { farbe: localStorage.getItem("np_cc_farbe") || "dante", zeigeIp: localStorage.getItem("np_cc_ip") !== "0" }; } catch { return {}; } };

// <input type="color"> braucht #rrggbb
const hex6 = (c) => { const m = /^#([0-9a-f]{3})$/i.exec(c || ""); return m ? "#" + m[1].split("").map((x) => x + x).join("") : /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#000000"; };
const SCHRIFTEN = [["'Segoe UI',system-ui,sans-serif", "Segoe UI"], ["Arial,Helvetica,sans-serif", "Arial"], ["Calibri,'Segoe UI',sans-serif", "Calibri"], ["Verdana,sans-serif", "Verdana"], ["'Courier New',monospace", "Courier New"], ["Georgia,serif", "Georgia"]];
const DESIGN_FARBEN = [
  ["design.farben.primary", "Dante Primary"], ["design.farben.secondary", "Dante Secondary"], ["design.farben.glas", "Glasfaser"], ["design.farben.trunk", "Trunk"], ["design.farben.sonst", "Sonstige Kabel"],
  ["design.switchFuellung", "Switch-Füllung"], ["design.boxRand", "Kastenrand"], ["design.text", "Text"], ["design.papier", "Papier"],
  ["design.raum.fuellung", "Standort Fläche"], ["design.raum.kopf", "Standort Kopf"], ["design.raum.rand", "Standort Rand"],
];
const ABSTAENDE = [["kastenAbstand", "Kästen nebeneinander", 10, 120], ["reihenAbstand", "Reihen", 10, 120], ["gruppeAbstand", "Gruppen", 10, 200], ["raumAbstand", "Standorte", 20, 300], ["maxSpalten", "Kästen je Reihe höchstens", 1, 12]];
// Einklappbarer Abschnitt im Bearbeiten-Fenster
function Abschnitt({ titel, children }) {
  const [offen, setOffen] = useState(true);
  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>
      <button onClick={() => setOffen(!offen)} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: "9px 12px", fontWeight: 700, fontSize: 12, color: SUB, cursor: "pointer" }}>
        {titel}<span style={{ color: MUTED }}>{offen ? "▾" : "▸"}</span>
      </button>
      {offen && <div style={{ padding: "0 12px 10px" }}>{children}</div>}
    </div>
  );
}
const wertVon = (o, pfad) => pfad.split(".").reduce((a, k) => a?.[k], o);

export default function CleanCatTab({ P, X, mutate, onSelectDevice, notify, kopf, svgRef: fremdRef, planProfile = [], setPlanProfile }) {
  /* Plan-Profil: steht als Kopie im Projekt (P.planProfil). Ohne Bearbeitungsrecht
     bleiben Änderungen in dieser Ansicht (lokal). */
  const [lokal, setLokal] = useState(null);
  const profil = useMemo(() => lokal || projektProfil(P, lokaleVorgaben()), [lokal, P.planProfil]); // eslint-disable-line react-hooks/exhaustive-deps
  const felder = profilFelder(profil);
  const profilAendern = (fn) => {
    const p = tief(profil); fn(p);
    if (mutate) mutate((d) => { d.planProfil = p; }); else setLokal(p);
  };
  const quelle = eingebautesProfil(profil.id) || planProfile.find((x) => x.id === profil.id) || null;
  const angepasst = !quelle || JSON.stringify(profilVergleich(quelle)) !== JSON.stringify(profilVergleich(profil));
  const gewerke = profil.inhalt.gewerke;
  const gefiltert = felder.sammeln || (gewerke.length > 0 && gewerke.length < 3 && profil.inhalt.fremde === "aus");
  // Automatische Anordnung mit kurzen Kabelwegen: nur neu rechnen, wenn sich Geräte, Kabel, Stacks oder der Inhalt ändern
  const format = plottFormat(P), groesse = plottGroesse(P);
  const anordKey = JSON.stringify([profil.inhalt, profil.kabel.spur, profil.anordnung]);
  const { ordnung } = useMemo(() => cleanCatOptimieren(P, X, { profil, format, groesse }), [P.geraete, P.verbindungen, P.layout.stapel, P.layout.cleancatStandorte, P.layout.cleancatOrdnung, P.bereiche, P.standortInfo, anordKey, format, groesse]); // eslint-disable-line react-hooks/exhaustive-deps
  const L0 = useMemo(() => cleanCatLayout(P, X, { profil, ordnung, format, groesse }), [P, X, profil, ordnung, format, groesse]);
  const [labZieh, setLabZieh] = useState(null); // Kabelbeschriftung ziehen: { id, f, bewegt }
  const [kabZieh, setKabZieh] = useState(null); // Kabelstrecke ziehen: { id, i, waag, pts, sx, sy, bewegt }
  const [sel, setSel] = useState(null); // Auswahl: { art: "box" | "linie", id }
  const L = useMemo(() => {
    let linien = L0.linien;
    if (labZieh) linien = linien.map((l) => l.id !== labZieh.id ? l : { ...l, labels: [kabelLabelAn(l.pts, labZieh.f, l.kabelText || l.kabelVoll), ...l.labels.filter((t) => !t.kabel)] });
    if (kabZieh?.bewegt) linien = linien.map((l) => l.id !== kabZieh.id ? l : { ...l, pts: kabZieh.pts, labels: l.labels.filter((t) => !t.kabel) });
    return linien === L0.linien ? L0 : { ...L0, linien };
  }, [L0, labZieh, kabZieh]);
  const [zieh, setZieh] = useState(null); // Standort ziehen: { name, sx, sy, dx, dy, bewegt, ziel }
  const B = useMemo(() => ccBlatt(L0, format), [L0, format]);
  const [view, setView] = useState({ x: 20, y: 20, k: 0.6 });
  const wrap = useRef(null), eigenRef = useRef(null), drag = useRef(null);
  const svgRef = fremdRef || eigenRef;
  const logo = ladeLogo();
  const stand = exportStand();
  const [panel, setPanelRoh] = useState(() => { try { return localStorage.getItem("np_cc_bearbeiten") !== "0"; } catch { return true; } });
  const setPanel = (v) => { setPanelRoh(v); try { localStorage.setItem("np_cc_bearbeiten", v ? "1" : "0"); } catch { /* egal */ } };
  const dateiRef = useRef(null);

  // Profil wählen, speichern, weitergeben
  const waehlen = (id) => {
    const p = eingebautesProfil(id) || planProfile.find((x) => x.id === id);
    if (!p) return;
    const kopie = tief(p);
    if (mutate) mutate((d) => { d.planProfil = kopie; }); else setLokal(kopie);
  };
  const alsEigenes = async () => {
    const name = await frageText("Name für das eigene Profil. Es liegt dann auf diesem Rechner und steht in jedem Projekt zur Auswahl.", angepasst && !profil.eingebaut ? profil.name : `${profil.name} (eigen)`, "Profil speichern");
    if (!name) return;
    const gleich = planProfile.find((x) => x.name === name);
    const neu = { ...tief(profil), id: gleich?.id || `eigen-${uid()}`, name, eingebaut: false, basiertAuf: profil.eingebaut || eingebautesProfil(profil.id) ? profil.id : profil.basiertAuf || "standard" };
    setPlanProfile?.((l) => [...l.filter((x) => x.id !== neu.id), neu]);
    if (mutate) mutate((d) => { d.planProfil = neu; }); else setLokal(neu);
    notify?.(gleich ? `Profil „${name}“ überschrieben` : `Profil „${name}“ gespeichert`);
  };
  const exportProfil = async () => {
    try { await api.saveFile(profilDatei(profil), `${profil.name}.${PROFIL_ENDUNG}`, [{ name: "Plan-Profil", extensions: [PROFIL_ENDUNG] }]); }
    catch (e) { notify?.("Export fehlgeschlagen: " + e.message, "err"); }
  };
  const importProfil = (datei) => {
    if (!datei) return;
    const r = new FileReader();
    r.onload = () => {
      const erg = profilLesen(String(r.result || ""), planProfile);
      if (erg.fehler) { notify?.(erg.fehler, "err"); return; }
      const p = erg.profil;
      // Eingebaute bleiben unverändert: ein geändertes „Standard“ wird zum eigenen Profil
      if (eingebautesProfil(p.id) && !p.eingebaut) { p.basiertAuf = p.id; p.id = `eigen-${uid()}`; if (EINGEBAUTE_PROFILE.some((x) => x.name === p.name)) p.name += " (importiert)"; }
      if (!p.eingebaut) setPlanProfile?.((l) => [...l.filter((x) => x.id !== p.id), p]);
      if (mutate) mutate((d) => { d.planProfil = p; }); else setLokal(p);
      notify?.(`Profil „${p.name}“ übernommen` + (erg.warnungen.length ? ` (${erg.warnungen.length} Angaben ignoriert: ${erg.warnungen.slice(0, 3).join("; ")})` : ""));
    };
    r.readAsText(datei);
  };
  const eigenesLoeschen = () => {
    if (!planProfile.some((x) => x.id === profil.id)) return;
    if (!confirm(`Eigenes Profil „${profil.name}“ von diesem Rechner löschen? Projekte, die es nutzen, behalten ihre Kopie.`)) return;
    setPlanProfile?.((l) => l.filter((x) => x.id !== profil.id));
  };
  const gewerkUmschalten = (g) => profilAendern((p) => {
    const an = p.inhalt.gewerke.length ? p.inhalt.gewerke : Object.keys(GEWERKE);
    const neu = an.includes(g) ? an.filter((x) => x !== g) : [...an, g];
    if (!neu.length) return;
    p.inhalt.gewerke = neu.length === Object.keys(GEWERKE).length ? [] : Object.keys(GEWERKE).filter((x) => neu.includes(x));
  });

  const einpassen = useCallback(() => {
    const el = wrap.current; if (!el) return;
    const k = Math.min(1.5, Math.max(0.1, Math.min((el.clientWidth - 40) / B.w, (el.clientHeight - 40) / B.h)));
    setView({ k, x: (el.clientWidth - B.w * k) / 2, y: (el.clientHeight - B.h * k) / 2 });
  }, [B.w, B.h]);
  useEffect(() => { einpassen(); }, [format, panel]); // eslint-disable-line react-hooks/exhaustive-deps

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
    clone.setAttribute("font-family", (L0.design || STANDARD_PROFIL.design).schrift);
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
  // Kabelbeschriftung ziehen: Mausposition auf den nächsten Punkt der Leitung abbilden
  const imPlan = (e) => {
    const svg = svgRef.current; if (!svg) return null;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: (p.x - B.x) / B.k, y: (p.y - B.y) / B.k };
  };
  const labelDown = (e, id) => {
    if (e.button !== 0 || !mutate) return;
    e.stopPropagation(); e.preventDefault(); // kein Markieren von Text beim Ziehen
    const l = L0.linien.find((x) => x.id === id), t = l?.labels.find((x) => x.kabel);
    if (t) setLabZieh({ id, f: t.f ?? 0.5, sx: e.clientX, sy: e.clientY, bewegt: false });
  };
  const labelBewegen = (e) => {
    if (!labZieh) return false;
    const l = L0.linien.find((x) => x.id === labZieh.id), p = imPlan(e);
    if (l && p) setLabZieh({ ...labZieh, f: anteilAufPfad(l.pts, p.x, p.y), bewegt: labZieh.bewegt || Math.abs(e.clientX - labZieh.sx) + Math.abs(e.clientY - labZieh.sy) > 3 });
    return true;
  };
  const labelEnde = () => {
    if (!labZieh) return false;
    const { id, f, bewegt } = labZieh;
    setLabZieh(null);
    if (bewegt) mutate((d) => { d.layout.plottBeschriftung = { ...(d.layout.plottBeschriftung || {}), [id]: Math.round(f * 10000) / 10000 }; });
    return true;
  };
  const labelReset = (id) => mutate?.((d) => { if (!d.layout.plottBeschriftung) return; delete d.layout.plottBeschriftung[id]; if (!Object.keys(d.layout.plottBeschriftung).length) delete d.layout.plottBeschriftung; });
  const labelsVonHand = Object.keys(P.layout.plottBeschriftung || {}).length > 0;

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
  /* Kästen ziehen: Geräte über einem Switch und Switches eines Standorts lassen sich in
     ihrer Reihe umstellen, Stacks innerhalb ihres Standorts. Die Reihenfolge bleibt dann
     von Hand gesetzt (layout.cleancatOrdnung bzw. Reihenfolge der Stapel). */
  const [boxZieh, setBoxZieh] = useState(null); // { art, id, art2: "oben"|"gruppen", key, liste, sx, sy, dx, dy, bewegt, ziel }
  const listeVon = (id) => {
    const o = L0.ordnung || {};
    for (const art2 of ["oben", "gruppen"]) for (const [key, l] of Object.entries(o[art2] || {})) if (l.includes(id)) return { art2, key, liste: l };
    return null;
  };
  // Kasten ziehen = frei verschieben; mit gedrückter Umschalttaste in seiner Reihe umstellen
  const boxDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const frei = !e.shiftKey && !gefiltert;
    setBoxZieh({ art: "box", id, frei, ...(frei ? {} : listeVon(id) || {}), sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, bewegt: false, ziel: null });
  };
  const stapelDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = (L0.stapel || []).find((x) => x.id === id);
    const liste = (L0.stapel || []).filter((x) => x.standort === st?.standort).map((x) => x.id);
    setBoxZieh({ art: "stapel", id, liste, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, bewegt: false, ziel: null });
  };
  const boxBewegen = (e) => {
    if (!boxZieh) return false;
    const f = view.k * B.k, dx = (e.clientX - boxZieh.sx) / f, dy = (e.clientY - boxZieh.sy) / f;
    const bewegt = boxZieh.bewegt || Math.abs(e.clientX - boxZieh.sx) + Math.abs(e.clientY - boxZieh.sy) > 4;
    let ziel = null;
    if (bewegt && !boxZieh.frei && boxZieh.liste?.length > 1) {
      const alle = boxZieh.art === "box" ? L0.boxen : L0.stapel || [];
      const r = alle.find((x) => x.id === boxZieh.id);
      ziel = r && standortZiel({ raeume: alle.filter((x) => boxZieh.liste.includes(x.id)).map((x) => ({ ...x, name: x.id })) }, boxZieh.id, dx, dy);
    }
    setBoxZieh({ ...boxZieh, dx, dy, bewegt, ziel });
    return true;
  };
  const boxEnde = () => {
    if (!boxZieh) return false;
    const { art, id, art2, key, liste, bewegt, ziel, frei, dx, dy } = boxZieh;
    setBoxZieh(null);
    if (!bewegt) { if (art === "box") setSel({ art: "box", id }); return true; }
    if (frei) { // auf 5er-Raster einrasten
      const alt = P.layout.plottPos?.[id] || { dx: 0, dy: 0 };
      const nx = Math.round(((+alt.dx || 0) + dx) / 5) * 5, ny = Math.round(((+alt.dy || 0) + dy) / 5) * 5;
      mutate((d) => { const p = { ...(d.layout.plottPos || {}) }; if (nx || ny) p[id] = { dx: nx, dy: ny }; else delete p[id]; d.layout.plottPos = p; });
      setSel({ art: "box", id });
      return true;
    }
    if (!ziel || !liste) return true;
    const neu = standortVerschieben(liste, id, ziel);
    if (neu.join("\u0001") === liste.join("\u0001")) return true;
    if (art === "box") mutate((d) => {
      const o = d.layout.cleancatOrdnung || {};
      d.layout.cleancatOrdnung = { ...o, [art2]: { ...(o[art2] || {}), [key]: neu } };
    });
    else mutate((d) => {
      const st = d.layout.stapel || [];
      const rang = new Map(neu.map((x, i) => [x, i]));
      const plaetze = st.map((x, i) => (rang.has(x.id) ? i : -1)).filter((i) => i >= 0);
      const sortiert = [...plaetze].map((i) => st[i]).sort((a, b) => rang.get(a.id) - rang.get(b.id));
      const out = [...st];
      plaetze.forEach((i, k) => { out[i] = sortiert[k]; });
      d.layout.stapel = out;
    });
    return true;
  };
  /* Kabel: mittlere Strecke quer ziehen (waagrechte nach oben/unten, senkrechte nach links/rechts).
     Gespeichert werden die inneren Punkte in P.layout.plottKabel[id]; Doppelklick = wieder automatisch. */
  const lineDown = (e, id, i) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const l = L0.linien.find((x) => x.id === id);
    if (!l) return;
    const waag = i != null && Math.abs(l.pts[i][1] - l.pts[i + 1][1]) < 0.01;
    setKabZieh({ id, i, waag, start: l.pts, pts: l.pts, sx: e.clientX, sy: e.clientY, bewegt: false });
  };
  const lineBewegen = (e) => {
    if (!kabZieh) return false;
    if (kabZieh.i == null || !mutate) return true;
    const f = view.k * B.k, d = kabZieh.waag ? (e.clientY - kabZieh.sy) / f : (e.clientX - kabZieh.sx) / f;
    const bewegt = kabZieh.bewegt || Math.abs(e.clientX - kabZieh.sx) + Math.abs(e.clientY - kabZieh.sy) > 3;
    const pts = kabZieh.start.map((p) => [...p]), k = kabZieh.waag ? 1 : 0;
    const neu = Math.round((pts[kabZieh.i][k] + d) / 2) * 2;
    pts[kabZieh.i][k] = neu; pts[kabZieh.i + 1][k] = neu;
    setKabZieh({ ...kabZieh, pts, bewegt });
    return true;
  };
  const lineEnde = () => {
    if (!kabZieh) return false;
    const { id, pts, bewegt } = kabZieh;
    setKabZieh(null);
    if (!bewegt) { setSel({ art: "linie", id }); return true; }
    mutate((d) => { d.layout.plottKabel = { ...(d.layout.plottKabel || {}), [id]: pts.slice(1, -1).map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) }; });
    setSel({ art: "linie", id });
    return true;
  };
  const ohneSchluessel = (obj, k) => { const o = { ...(obj || {}) }; delete o[k]; return Object.keys(o).length ? o : undefined; };
  const setzeLayout = (feld, k, wert) => mutate?.((d) => { const o = wert === undefined ? ohneSchluessel(d.layout[feld], k) : { ...(d.layout[feld] || {}), [k]: wert }; if (o) d.layout[feld] = o; else delete d.layout[feld]; });
  const lineReset = (id) => setzeLayout("plottKabel", id, undefined);
  const selBox = sel?.art === "box" ? L0.boxen.find((b) => b.id === sel.id) : null;
  const selLinie = sel?.art === "linie" ? L0.linien.find((l) => l.id === sel.id) : null;
  useEffect(() => { if (sel && !selBox && !selLinie) setSel(null); }, [sel, selBox, selLinie]);
  useEffect(() => {
    const taste = (e) => { if (e.key === "Escape") setSel(null); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const designAendern = (pfad, wert) => profilAendern((p) => { const teile = pfad.split("."); let o = p; for (const t of teile.slice(0, -1)) o = o[t]; o[teile[teile.length - 1]] = wert; });
  const vonHand = (P.layout.cleancatStandorte || []).length > 0 || Object.keys(P.layout.cleancatOrdnung || {}).length > 0
    || Object.keys(P.layout.plottPos || {}).length > 0 || Object.keys(P.layout.plottKabel || {}).length > 0;
  const knopf = { ...S.ghostBtn, whiteSpace: "nowrap" };
  const zeile = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 0" };
  const farbFeld = { width: 26, height: 20, padding: 0, border: `1px solid ${LINE}`, borderRadius: 4, background: "none", cursor: "pointer" };
  const selName = selBox ? selBox.name : selLinie ? `Kabel ${P.geraete.find((d) => d.id === selLinie.von)?.name || "?"} – ${P.geraete.find((d) => d.id === selLinie.bis)?.name || "?"}` : "";
  const selFarbe = sel && (P.layout.plottFarben || {})[sel.id];
  const bereich = (r) => <input type="range" {...r} style={{ width: 140 }} />;
  const auswahl = selBox || selLinie;
  const selDev = selBox && !selBox.sammel ? P.geraete.find((d) => d.id === selBox.id) : null;
  // Eigene Farbe eines Ports (am Gerät gespeichert); undefined = wieder VLAN-Farbe
  const portFarbe = (portId, farbe) => mutate?.((d) => {
    const p = d.geraete.find((g) => g.id === selDev.id)?.ports.find((x) => x.id === portId);
    if (!p) return;
    if (farbe) p.farbe = farbe; else delete p.farbe;
  });
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 10px", background: PANEL, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap", flexShrink: 0 }}>
        {kopf}
        <select style={{ ...S.selectSm, width: "auto" }} value={angepasst ? "__aktuell" : profil.id} onChange={(e) => waehlen(e.target.value)}
          title="Plan-Profil: Aussehen und Inhalt des Plans. Das gewählte Profil wird im Projekt gespeichert.">
          {angepasst && <option value="__aktuell">Profil: {profil.name} (angepasst)</option>}
          <optgroup label="Vorlagen">{EINGEBAUTE_PROFILE.map((p) => <option key={p.id} value={p.id}>Profil: {p.name}</option>)}</optgroup>
          {planProfile.length > 0 && <optgroup label="Eigene Profile">{planProfile.map((p) => <option key={p.id} value={p.id}>Profil: {p.name}</option>)}</optgroup>}
        </select>
        <select style={{ ...S.selectSm, width: "auto" }} value={profil.inhalt.stufe} onChange={(e) => { const v = +e.target.value; profilAendern((p) => { p.inhalt.stufe = v; p.inhalt.felder = {}; }); }}
          title={STUFEN.map((x) => `${x.nr} ${x.name}: ${x.info}`).join("\n")}>
          {STUFEN.map((x) => <option key={x.nr} value={x.nr}>Stufe {x.nr}: {x.name}</option>)}
        </select>
        <div style={{ display: "flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }} title="Gewerke zeigen. Switches und Geräte ohne Gewerk bleiben immer sichtbar.">
          {Object.keys(GEWERKE).map((g) => {
            const an = !gewerke.length || gewerke.includes(g);
            return <button key={g} onClick={() => gewerkUmschalten(g)} style={{ ...knopf, border: "none", borderRadius: 0, padding: "5px 9px", ...(an ? { background: "#2c3b93", color: "#fff" } : {}) }}>{g}</button>;
          })}
        </div>
        <button style={knopf} onClick={() => zoom(1 / 1.25)} title="Verkleinern"><ZoomOut size={14} /></button>
        <button style={knopf} onClick={() => zoom(1.25)} title="Vergrößern"><ZoomIn size={14} /></button>
        <button style={knopf} onClick={einpassen} title="Ganzes Blatt zeigen"><Maximize2 size={14} /> Einpassen</button>
        <span style={{ flex: 1 }} />
        <button style={knopf} onClick={() => exportieren("pdf")} title={`Als PDF im Format ${B.label} speichern`}><FileText size={14} /> PDF {B.seite}</button>
        <button style={knopf} onClick={() => exportieren("svg")} title="Als SVG speichern (z. B. für Visio, Illustrator)"><FileCode size={14} /> SVG</button>
        <button style={knopf} onClick={() => exportieren("png")} title="Als PNG speichern"><FileImage size={14} /> PNG</button>
        <button style={{ ...knopf, ...(panel ? { background: "#2c3b93", color: "#fff" } : {}) }} onClick={() => setPanel(!panel)} title="Bearbeiten-Fenster rechts ein- oder ausblenden"><SlidersHorizontal size={14} /> Bearbeiten</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <div ref={wrap} style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative", background: "#d9dde1", cursor: drag.current ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0 && e.button !== 1) return; drag.current = { sx: e.clientX, sy: e.clientY, v: view, bewegt: false }; }}
        onMouseMove={(e) => { if (labelBewegen(e) || lineBewegen(e) || boxBewegen(e) || raumBewegen(e)) return; const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.bewegt = true; setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); }}
        onMouseUp={() => { if (labelEnde() || lineEnde() || boxEnde() || raumEnde()) return; if (drag.current && !drag.current.bewegt) setSel(null); setTimeout(() => { drag.current = null; }, 0); }} onMouseLeave={() => { labelEnde(); setKabZieh(null); setBoxZieh(null); raumEnde(); drag.current = null; }}>
        {!P.geraete.length && <div style={{ ...S.empty, padding: 30, color: MUTED }}>Noch keine Geräte im Projekt.</div>}
        {P.geraete.length > 0 && <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", boxShadow: "0 4px 24px rgba(0,0,0,.25)" }}>
          <Zeichnung L={L} B={B} P={P} stand={stand} logo={logo} svgRef={svgRef} onBox={(id) => { if (!drag.current?.bewegt) onSelectDevice?.(id); }} onRaumDown={mutate && !gefiltert ? raumDown : null} zieh={zieh} onLabelDown={mutate ? labelDown : null} onLabelReset={labelReset}
            onBoxDown={mutate ? boxDown : null} onStapelDown={mutate && !gefiltert ? stapelDown : null} boxZieh={boxZieh}
            onLineDown={mutate ? lineDown : null} onLineReset={lineReset} onBoxDouble={(id) => onSelectDevice?.(id)} sel={sel} />
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#4b525a" }}>{Math.round(view.k * 100)} % · {B.label} · Mausrad = Zoom · Gerät ziehen = frei verschieben · mit Shift = in der Reihe umsetzen · Kabelstrecke ziehen = Verlauf ändern · Klick = auswählen · Doppelklick = Gerät bearbeiten bzw. Kabel zurücksetzen</div>
      </div>
      {panel && (
        <div style={{ width: 330, flexShrink: 0, overflowY: "auto", background: PANEL, borderLeft: `1px solid ${LINE}`, fontSize: 12, color: SUB }}>
          <Abschnitt titel={auswahl ? (selBox ? "Gerät" : "Kabel") : "Auswahl"}>
            {!auswahl && <div style={{ color: MUTED }}>Klick auf ein Gerät oder Kabel im Plan, um es hier zu bearbeiten.</div>}
            {auswahl && <>
              <div style={{ fontWeight: 700, marginBottom: 6, wordBreak: "break-word" }}>{selName}</div>
              {mutate && <label style={zeile} title="Eigene Farbe nur für dieses Element">Eigene Farbe
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={hex6(selFarbe || (selBox ? selBox.fill : selLinie.col))} onChange={(e) => setzeLayout("plottFarben", sel.id, e.target.value)} style={farbFeld} />
                  {selFarbe && <button style={{ ...knopf, padding: "3px 6px" }} onClick={() => setzeLayout("plottFarben", sel.id, undefined)} title="Farbe zurücksetzen"><RotateCcw size={13} /></button>}
                </span></label>}
              {selBox && mutate && <div style={zeile}>Position {(P.layout.plottPos || {})[selBox.id] ? "von Hand" : "automatisch"}
                {(P.layout.plottPos || {})[selBox.id] && <button style={knopf} onClick={() => setzeLayout("plottPos", selBox.id, undefined)}><RotateCcw size={14} /> Zurücksetzen</button>}</div>}
              {selLinie && mutate && <div style={zeile}>Verlauf {(P.layout.plottKabel || {})[selLinie.id] ? "von Hand" : "automatisch"}
                {(P.layout.plottKabel || {})[selLinie.id] && <button style={knopf} onClick={() => lineReset(selLinie.id)}><RotateCcw size={14} /> Zurücksetzen</button>}</div>}
              {selDev && selDev.ports.some((p) => !p.virtuell) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Port-Farben</div>
                  <div style={{ color: MUTED, marginBottom: 4 }}>Ohne eigene Farbe gilt die Farbe des VLANs.{!felder.portKaesten && " Sichtbar mit „Ports als farbige Kästchen“ unter Inhalt."}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px" }}>
                    {selDev.ports.filter((p) => !p.virtuell).map((p) => {
                      const k = (L.ports || []).find((x) => x.an === selDev.id && x.port === p.id);
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }} title={p.farbe ? "Eigene Farbe" : "Farbe des VLANs"}>
                          <input type="color" disabled={!mutate} value={hex6(p.farbe || k?.fill || "#ffffff")} onChange={(e) => portFarbe(p.id, e.target.value)} style={farbFeld} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: p.farbe ? 700 : 400 }}>{p.name}</span>
                          {p.farbe && mutate && <button style={{ ...knopf, padding: "1px 4px" }} onClick={(e) => { e.preventDefault(); portFarbe(p.id, undefined); }} title="Wieder Farbe des VLANs"><RotateCcw size={11} /></button>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {selBox && !selBox.sammel && onSelectDevice && <button style={knopf} onClick={() => onSelectDevice(selBox.id)}>Gerät bearbeiten</button>}
                <button style={knopf} onClick={() => setSel(null)}>Auswahl aufheben</button>
              </div>
            </>}
          </Abschnitt>
          <Abschnitt titel="Inhalt">
            <label style={zeile}>Kabelfarbe
              <select style={{ ...S.selectSm, width: 170 }} value={profil.kabel.farbe} onChange={(e) => designAendern("kabel.farbe", e.target.value)}>
                <option value="dante">Dante Primary / Secondary</option>
                <option value="vlan">VLAN</option>
              </select></label>
            {FELDER.map((f) => (
              <label key={f.k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <input type="checkbox" checked={!!felder[f.k]} style={{ accentColor: ACCENT }} onChange={(e) => { const v = e.target.checked; profilAendern((p) => { p.inhalt.felder = { ...p.inhalt.felder, [f.k]: v }; }); }} /> {f.name}
              </label>
            ))}
            <label style={zeile}>Andere Gewerke
              <select style={{ ...S.selectSm, width: 130 }} value={profil.inhalt.fremde} onChange={(e) => designAendern("inhalt.fremde", e.target.value)}>
                <option value="blass">blass zeigen</option>
                <option value="aus">ausblenden</option>
              </select></label>
          </Abschnitt>
          <Abschnitt titel="Linien und Schrift">
            <label style={zeile}>Schrift
              <select style={{ ...S.selectSm, width: 150 }} value={profil.design.schrift} onChange={(e) => designAendern("design.schrift", e.target.value)}>
                {!SCHRIFTEN.some(([k]) => k === profil.design.schrift) && <option value={profil.design.schrift}>{profil.design.schrift}</option>}
                {SCHRIFTEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select></label>
            <label style={zeile}>Linienbreite {profil.design.linienBreite}{bereich({ min: 0.5, max: 4, step: 0.1, value: profil.design.linienBreite, onChange: (e) => designAendern("design.linienBreite", +e.target.value) })}</label>
            {[["titel", "Schrift Titel"], ["beschreibung", "Schrift Beschreibung"], ["ports", "Schrift Ports"]].map(([k, n]) => (
              <label key={k} style={zeile}>{n} {Math.round((profil.design.schriftGroesse?.[k] ?? 1) * 100)} %{bereich({ min: 0.5, max: 2, step: 0.05, value: profil.design.schriftGroesse?.[k] ?? 1, onChange: (e) => designAendern(`design.schriftGroesse.${k}`, +e.target.value) })}</label>
            ))}
            <label style={zeile}>Abstand paralleler Kabel {profil.kabel.spur}{bereich({ min: 4, max: 16, step: 1, value: profil.kabel.spur, onChange: (e) => designAendern("kabel.spur", +e.target.value) })}</label>
          </Abschnitt>
          <Abschnitt titel="Abstände">
            {ABSTAENDE.map(([k, n, min, max]) => (
              <label key={k} style={zeile}>{n} {profil.anordnung[k]}{bereich({ min, max, step: 1, value: profil.anordnung[k], onChange: (e) => designAendern(`anordnung.${k}`, +e.target.value) })}</label>
            ))}
          </Abschnitt>
          <Abschnitt titel="Farben">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px" }}>
              {DESIGN_FARBEN.map(([pfad, n]) => (
                <label key={pfad} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="color" value={hex6(wertVon(profil, pfad))} onChange={(e) => designAendern(pfad, e.target.value)} style={farbFeld} /> {n}
                </label>
              ))}
            </div>
          </Abschnitt>
          <Abschnitt titel="Gerätekästen je Kategorie">
            <label style={zeile}>Aufhellen {Math.round(profil.design.kategorieAufhellen * 100)} %{bereich({ min: 0, max: 0.95, step: 0.01, value: profil.design.kategorieAufhellen, onChange: (e) => designAendern("design.kategorieAufhellen", +e.target.value) })}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px" }}>
              {Object.keys(KATEGORIEN).map((kat) => (
                <label key={kat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="color" value={hex6(katGrundfarbe(profil.design, kat))} onChange={(e) => designAendern("design.kategorieFarben", { ...profil.design.kategorieFarben, [kat]: e.target.value })} style={farbFeld} /> {kat}
                </label>
              ))}
            </div>
            {Object.keys(profil.design.kategorieFarben || {}).length > 0 && <button style={{ ...knopf, marginTop: 6 }} onClick={() => designAendern("design.kategorieFarben", {})}><RotateCcw size={14} /> Kategoriefarben zurücksetzen</button>}
          </Abschnitt>
          <Abschnitt titel="Blatt und Anordnung">
            <label style={zeile}>Format
              <select style={{ ...S.selectSm, width: 150 }} value={format} disabled={!mutate}
                onChange={(e) => { const v = e.target.value; mutate?.((d) => { if (v === "A3-quer") delete d.layout.plottFormat; else d.layout.plottFormat = v; }); }}>
                {Object.entries(BLATT_FORMATE).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </select></label>
            <label style={zeile} title="Größe der Geräte-Kästen. Gilt auch für den Export.">Kastengröße
              <select style={{ ...S.selectSm, width: 150 }} value={groesse} disabled={!mutate}
                onChange={(e) => { const v = +e.target.value; mutate?.((d) => { if (v === 1) delete d.layout.plottGroesse; else d.layout.plottGroesse = v; }); }}>
                {PLOTT_GROESSEN.map((g) => <option key={g} value={g}>{Math.round(g * 100)} %</option>)}
              </select></label>
            {mutate && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <button style={knopf} disabled={!vonHand} onClick={() => mutate((d) => { delete d.layout.cleancatStandorte; delete d.layout.cleancatOrdnung; delete d.layout.plottPos; delete d.layout.plottKabel; })} title="Von Hand verschobene Kästen, gezogene Kabel und die Reihenfolge der Standorte verwerfen. Der Plan ordnet alles wieder selbst, mit möglichst kurzen Kabelwegen und wenig Kreuzungen."><RotateCcw size={14} /> Anordnung automatisch</button>
              <button style={knopf} disabled={!labelsVonHand} onClick={() => mutate((d) => { delete d.layout.plottBeschriftung; })} title="Von Hand verschobene Kabelbeschriftungen wieder automatisch setzen"><RotateCcw size={14} /> Beschriftungen automatisch</button>
              <button style={knopf} disabled={!Object.keys(P.layout.plottFarben || {}).length} onClick={() => mutate((d) => { delete d.layout.plottFarben; })} title="Alle eigenen Farben einzelner Geräte und Kabel entfernen"><RotateCcw size={14} /> Eigene Farben entfernen</button>
            </div>}
          </Abschnitt>
          <Abschnitt titel="Profil">
            <div style={{ marginBottom: 6 }}>{profil.name}{angepasst ? " (angepasst)" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {setPlanProfile && <button style={knopf} onClick={alsEigenes} title="Aktuelle Einstellungen als eigenes Profil auf diesem Rechner speichern">Als eigenes speichern</button>}
              <button style={knopf} onClick={exportProfil} title={`Profil als .${PROFIL_ENDUNG}-Datei speichern, z. B. zum Weitergeben`}>Exportieren</button>
              {setPlanProfile && <button style={knopf} onClick={() => dateiRef.current?.click()} title={`.${PROFIL_ENDUNG}-Datei laden und übernehmen`}>Importieren</button>}
              {quelle && angepasst && <button style={knopf} onClick={() => waehlen(quelle.id)} title={`Änderungen verwerfen und „${quelle.name}“ wieder so nehmen, wie es gespeichert ist`}><RotateCcw size={14} /> Zurücksetzen</button>}
              {setPlanProfile && planProfile.some((x) => x.id === profil.id) && <button style={knopf} onClick={eigenesLoeschen}>Löschen</button>}
            </div>
            <input ref={dateiRef} type="file" accept={`.${PROFIL_ENDUNG},.json`} style={{ display: "none" }} onChange={(e) => { importProfil(e.target.files?.[0]); e.target.value = ""; }} />
          </Abschnitt>
        </div>
      )}
      </div>
    </div>
  );
}
