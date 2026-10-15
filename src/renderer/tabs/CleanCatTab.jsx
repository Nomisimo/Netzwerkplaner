import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, PANEL } from "../../shared/constants.js";
import { STANDARD_PROFIL, EINGEBAUTE_PROFILE, eingebautesProfil, projektProfil, profilFelder, profilVergleich, profilDatei, profilLesen, STUFEN, FELDER, GEWERKE, PROFIL_ENDUNG } from "../../shared/plottprofil.js";
import { uid } from "../../shared/catalog.js";
import { frageText } from "../ui.jsx";
import { cleanCatLayout, cleanCatOptimieren, ccBlatt, passeText, BLATT_FORMATE, plottFormat, PLOTT_GROESSEN, plottGroesse, kabelLabelAn, anteilAufPfad } from "../../shared/cleancat.js";
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
    ...(L.legende.fluss ? [{ art: "einweg", t: "Signal in eine Richtung" }, { art: "zweiweg", t: "Signal in beide Richtungen" }] : []),
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

export function Zeichnung({ L, B, P, stand, logo, svgRef, onBox, onRaumDown, zieh, onLabelDown, onLabelReset, onBoxDown, onStapelDown, boxZieh }) {
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
          const yName = zeilen === 3 ? 17 : zeilen === 2 ? 20 : kopfH / 2 + 4;
          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})${s !== 1 ? ` scale(${s})` : ""}`} style={{ cursor: onBoxDown ? "move" : onBox ? "pointer" : "default" }}
              opacity={boxZieh?.art === "box" && boxZieh.id === b.id && boxZieh.bewegt ? 0.45 : b.blass ? 0.25 : 1}
              onMouseDown={onBoxDown ? (e) => onBoxDown(e, b.id) : undefined} onClick={!onBoxDown && onBox ? () => onBox(b.id) : undefined}>
              {b.sammel && <rect x={4} y={-4} width={bw} height={bh} fill={b.fill} stroke={D.boxRand} strokeWidth={1} />}
              <rect width={bw} height={bh} fill={b.fill} stroke={D.boxRand} strokeWidth={1} />
              {b.sammel && <title>{b.sammelNamen.join("\n")}</title>}
              <T x={bw / 2} y={yName} max={frei} fit={b.tName} anchor="middle" weight={600} fill={D.text} />
              {b.tSub && <T x={bw / 2} y={zeilen === 3 ? 30 : 34} max={frei} fit={b.tSub} anchor="middle" fill={D.textNeben} />}
              {b.tIp && <T x={bw / 2} y={b.tSub ? 43 : 34} max={frei} fit={b.tIp} anchor="middle" fill={D.textNeben} mono />}
              {b.notiz && (
                <>
                  <line x1={6} y1={kopfH - 2} x2={bw - 6} y2={kopfH - 2} stroke={D.boxRand} strokeOpacity="0.3" />
                  {b.notiz.map((z, i) => <T key={i} x={bw / 2} y={kopfH + 10 + i * 10.5} max={frei} fit={passeText(z, 8.5, frei, 8.5)} anchor="middle" fill="#444" />)}
                  <title>{b.notizVoll}</title>
                </>
              )}
            </g>
          );
        })}
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
  const L = useMemo(() => (!labZieh ? L0 : { ...L0, linien: L0.linien.map((l) => l.id !== labZieh.id ? l
    : { ...l, labels: [kabelLabelAn(l.pts, labZieh.f, l.kabelText || l.kabelVoll), ...l.labels.filter((t) => !t.kabel)] }) }), [L0, labZieh]);
  const [zieh, setZieh] = useState(null); // Standort ziehen: { name, sx, sy, dx, dy, bewegt, ziel }
  const B = useMemo(() => ccBlatt(L0, format), [L0, format]);
  const [view, setView] = useState({ x: 20, y: 20, k: 0.6 });
  const wrap = useRef(null), eigenRef = useRef(null), drag = useRef(null);
  const svgRef = fremdRef || eigenRef;
  const logo = ladeLogo();
  const stand = exportStand();
  const [panel, setPanel] = useState(false);
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
  const boxDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setBoxZieh({ art: "box", id, ...(listeVon(id) || {}), sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, bewegt: false, ziel: null });
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
    if (bewegt && boxZieh.liste?.length > 1) {
      const alle = boxZieh.art === "box" ? L0.boxen : L0.stapel || [];
      const r = alle.find((x) => x.id === boxZieh.id);
      ziel = r && standortZiel({ raeume: alle.filter((x) => boxZieh.liste.includes(x.id)).map((x) => ({ ...x, name: x.id })) }, boxZieh.id, dx, dy);
    }
    setBoxZieh({ ...boxZieh, dx, dy, bewegt, ziel });
    return true;
  };
  const boxEnde = () => {
    if (!boxZieh) return false;
    const { art, id, art2, key, liste, bewegt, ziel } = boxZieh;
    setBoxZieh(null);
    if (!bewegt) { if (art === "box") onSelectDevice?.(id); return true; }
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
  const vonHand = (P.layout.cleancatStandorte || []).length > 0 || Object.keys(P.layout.cleancatOrdnung || {}).length > 0;
  const knopf = { ...S.ghostBtn, whiteSpace: "nowrap" };
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
        <select style={{ ...S.selectSm, width: "auto" }} value={profil.kabel.farbe} onChange={(e) => { const v = e.target.value; profilAendern((p) => { p.kabel.farbe = v; }); }} title="Farbe der Leitungen">
          <option value="dante">Farbe: Dante Primary / Secondary</option>
          <option value="vlan">Farbe: VLAN</option>
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: SUB }}><input type="checkbox" checked={felder.ip} onChange={(e) => { const v = e.target.checked; profilAendern((p) => { p.inhalt.felder = { ...p.inhalt.felder, ip: v }; }); }} style={{ accentColor: ACCENT }} /> IP-Adressen</label>
        <div style={{ position: "relative" }}>
          <button style={{ ...knopf, ...(panel ? { background: "#2c3b93", color: "#fff" } : {}) }} onClick={() => setPanel(!panel)} title="Felder einzeln schalten, Profil speichern, exportieren oder importieren"><SlidersHorizontal size={14} /> Profil</button>
          {panel && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: 12, width: 290, boxShadow: "0 8px 24px rgba(0,0,0,.25)", fontSize: 12, color: SUB }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Im Plan zeigen</div>
              {FELDER.map((f) => (
                <label key={f.k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                  <input type="checkbox" checked={!!felder[f.k]} style={{ accentColor: ACCENT }} onChange={(e) => { const v = e.target.checked; profilAendern((p) => { p.inhalt.felder = { ...p.inhalt.felder, [f.k]: v }; }); }} /> {f.name}
                </label>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>Andere Gewerke
                <select style={{ ...S.selectSm, width: "auto" }} value={profil.inhalt.fremde} onChange={(e) => { const v = e.target.value; profilAendern((p) => { p.inhalt.fremde = v; }); }}>
                  <option value="blass">blass zeigen</option>
                  <option value="aus">ausblenden</option>
                </select>
              </label>
              <div style={{ borderTop: `1px solid ${LINE}`, margin: "10px 0 8px" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {setPlanProfile && <button style={knopf} onClick={alsEigenes} title="Aktuelle Einstellungen als eigenes Profil auf diesem Rechner speichern">Als eigenes speichern</button>}
                <button style={knopf} onClick={exportProfil} title={`Profil als .${PROFIL_ENDUNG}-Datei speichern, z. B. zum Weitergeben`}>Exportieren</button>
                {setPlanProfile && <button style={knopf} onClick={() => dateiRef.current?.click()} title={`.${PROFIL_ENDUNG}-Datei laden und übernehmen`}>Importieren</button>}
                {quelle && angepasst && <button style={knopf} onClick={() => waehlen(quelle.id)} title={`Änderungen verwerfen und „${quelle.name}“ wieder so nehmen, wie es gespeichert ist`}><RotateCcw size={14} /> Zurücksetzen</button>}
                {setPlanProfile && planProfile.some((x) => x.id === profil.id) && <button style={knopf} onClick={eigenesLoeschen}>Löschen</button>}
              </div>
              <input ref={dateiRef} type="file" accept={`.${PROFIL_ENDUNG},.json`} style={{ display: "none" }} onChange={(e) => { importProfil(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          )}
        </div>
        <button style={knopf} onClick={() => zoom(1 / 1.25)} title="Verkleinern"><ZoomOut size={14} /></button>
        <button style={knopf} onClick={() => zoom(1.25)} title="Vergrößern"><ZoomIn size={14} /></button>
        <button style={knopf} onClick={einpassen} title="Ganzes Blatt zeigen"><Maximize2 size={14} /> Einpassen</button>
        {mutate && <button style={knopf} disabled={!vonHand} onClick={() => mutate((d) => { delete d.layout.cleancatStandorte; delete d.layout.cleancatOrdnung; })} title="Von Hand gesetzte Reihenfolge der Standorte und Kästen verwerfen. Der Plan ordnet sie wieder selbst, mit möglichst kurzen Kabelwegen und wenig Kreuzungen."><RotateCcw size={14} /> Anordnung automatisch</button>}
        {mutate && <button style={knopf} disabled={!labelsVonHand} onClick={() => mutate((d) => { delete d.layout.plottBeschriftung; })} title="Von Hand verschobene Kabelbeschriftungen wieder automatisch setzen"><RotateCcw size={14} /> Beschriftungen automatisch</button>}
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
        onMouseMove={(e) => { if (labelBewegen(e) || boxBewegen(e) || raumBewegen(e)) return; const d = drag.current; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.bewegt = true; setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); }}
        onMouseUp={() => { if (labelEnde() || boxEnde() || raumEnde()) return; setTimeout(() => { drag.current = null; }, 0); }} onMouseLeave={() => { labelEnde(); setBoxZieh(null); raumEnde(); drag.current = null; }}>
        {!P.geraete.length && <div style={{ ...S.empty, padding: 30, color: MUTED }}>Noch keine Geräte im Projekt.</div>}
        {P.geraete.length > 0 && <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${view.x}px,${view.y}px) scale(${view.k})`, transformOrigin: "0 0", boxShadow: "0 4px 24px rgba(0,0,0,.25)" }}>
          <Zeichnung L={L} B={B} P={P} stand={stand} logo={logo} svgRef={svgRef} onBox={(id) => { if (!drag.current?.bewegt) onSelectDevice?.(id); }} onRaumDown={mutate && !gefiltert ? raumDown : null} zieh={zieh} onLabelDown={mutate ? labelDown : null} onLabelReset={labelReset}
            onBoxDown={mutate && !gefiltert ? boxDown : null} onStapelDown={mutate && !gefiltert ? stapelDown : null} boxZieh={boxZieh} />
        </div>}
        <div style={{ position: "absolute", left: 12, bottom: 8, fontSize: 11, color: "#4b525a" }}>{Math.round(view.k * 100)} % · {B.label} · Mausrad = Zoom · Ziehen = verschieben · Standort, Gerät oder Stack ziehen = an andere Stelle setzen · Kabeltext ziehen = auf dem Kabel verschieben · Klick auf ein Gerät = bearbeiten</div>
      </div>
    </div>
  );
}
