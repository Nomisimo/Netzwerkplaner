import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { removeDevices } from "../../shared/invarianten.js";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, PANEL, DARK, KABEL, KATEGORIEN, TYPEN, katColor } from "../../shared/constants.js";
import { buildTree, subtreeIds, connVlan, isP2PConn, mainIp, webUrl, addConnection, freiePorts } from "../../shared/model.js";
import { layoutMindmap, NODE_W, NODE_H } from "../../shared/layout.js";
import { SvgIcon, IconView } from "../icons.jsx";
import { Toggle, VlanSelect, Dot, Modal } from "../ui.jsx";
import DeviceEditor from "../DeviceEditor.jsx";
import ConnEditor from "../ConnEditor.jsx";
import { api } from "../api.js";
import DeviceContextMenu from "../DeviceContextMenu.jsx";
import { endInfo, portLabel, vlanLang, geraeteTitel } from "../portinfo.js";
import { feldZeilen } from "../../shared/felder.js";
import { layoutFrontplatten, anker, CARD_W, CARD_H, TAB_H } from "../../shared/frontplatte.js";
import { FrontPlate, FrontCard, FP_BG, laschenText, laschenZustand, kartenFarbe } from "../Frontplatte.jsx";
import { anordnen, positionenSichern, knickPfad, stapelAnker, stapelVon, obenAufStapel, entstapeln, kabelSpuren, bahnenVergeben, endenVerteilen } from "../../shared/anordnung.js";
import { uid, ipPorts } from "../../shared/catalog.js";
import HintergrundPanel from "../HintergrundPanel.jsx";
import StapelEditor from "../StapelEditor.jsx";
import PortTauschen from "../PortTauschen.jsx";
import { stapelEinfuegen } from "../../shared/konfig.js";
import { useZwischenablage } from "../zwischenablage.js";
import { einrasten, mitlaeufer, gruppeBewegen } from "../../shared/einrasten.js";
import { KonfigEinfuegen } from "../KonfigDialog.jsx";
import { Network, Cable, Move, Link2, Layers, Maximize, RotateCcw, Image as ImageIcon, ListTree, ClipboardPaste, RefreshCw, Search, Plus, PanelLeftClose, PanelLeftOpen, X as XIcon, Pin, TriangleAlert, Globe, Trash2, Zap } from "lucide-react";

const KABEL_FARBEN = { cat5e: "#8fa3b8", cat6: "#4ea1ff", ethercon: "#39d0c8", fiber_sm: "#f5d023", fiber_mm: "#ff8c42", opticalcon: "#ffb347", dac: "#b37dff", wlan: "#9aa4af", p2p: "#e74c3c" };
const HW = NODE_W / 2, HH = NODE_H / 2;

export default function TopologieTab(props) {
  const { P, X, mutate, issues, status, checkReach, selection, setSelection, onAddDevice, onDeleteDevice, onDeleteConn, onShowProto, onSaveVorlage, onSaveBestand, onUmbauen, onTypWaehlen, bestand, svgRef, autoStatus, setAutoStatus } = props;
  const [tool, setTool] = useState("move");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null);   // { kind:'node'|'pan', id, sx, sy, dx, dy, moved }
  const [draw, setDraw] = useState(null);   // { from, x, y }
  const [hover, setHover] = useState(null);
  const [colorBy, setColorBy] = useState("vlan");
  const [katFilter, setKatFilter] = useState("");
  const [vlanFilter, setVlanFilter] = useState(null);
  const [q, setQ] = useState("");
  const [showPorts, setShowPorts] = useState(true);
  const [ctx, setCtx] = useState(null);
  const [bgOpen, setBgOpen] = useState(false);
  const stapelClip = useZwischenablage("stapel");
  const [tausch, setTausch] = useState(null); // { from, to, voll: [devId] } wenn Anschlüsse fehlen
  const titel = P.layout.titel || "name"; // Beschriftung der Knoten
  const setTitel = (t) => mutate((d) => { d.layout.titel = t; });
  const linien = P.layout.linien || "rund"; // Verbindungslinien: rund, eckig oder direkt (kürzester Weg)
  const buendeln = linien === "eckig" && !!P.layout.kabelBuendel; // Kabel bündeln (nur eckig), sonst einzeln nebeneinander
  const [paletteOpen, setPaletteOpen] = useState(true);
  const wrapRef = useRef(null);
  const fitted = useRef(false);

  const T = useMemo(() => buildTree(P, X), [P, X]);
  const front = P.layout.ansicht === "front";
  const setAnsicht = (a) => { mutate((d) => { d.layout.ansicht = a; }); fitted.current = false; };
  const LM = useMemo(() => (front ? null : layoutMindmap(P, T)), [P, T, front]);
  const F = useMemo(() => (front ? layoutFrontplatten(P, T, X) : null), [P, T, X, front]);
  const offKey = front ? "fpOffsets" : "offsets";
  const pinKey = front ? "fpPins" : "pins";         // angepinnte Geräte (feste Position)
  const fixKey = front ? "fpFix" : "fix";           // alle Positionen bei „Auto-Anordnen aus“
  const knickKey = front ? "fpKnicke" : "knicke";   // verschobene Verbindungen (Versatz zur Mitte)
  const bgKey = front ? "fpHintergrund" : "hintergrund";
  const auto = P.layout.autoAnordnen !== false;
  const rasten = P.layout.einrasten !== false; // Einrasten beim Ziehen (Raster und Nachbarn), Alt hält es kurz aus
  const pins = P.layout[pinKey] || {};
  const stapel = P.layout.stapel || [];
  // Mehrfachauswahl: { type: "multi", ids } (Shift/⌘/Strg-Klick, Shift-Rahmen, ⌘/Strg+A)
  const selIds = selection?.type === "multi" ? selection.ids.filter((id) => X.devById.has(id)) : selection?.type === "dev" ? [selection.id] : [];
  const waehle = (ids) => { const u = [...new Set(ids)]; setSelection(u.length > 1 ? { type: "multi", ids: u } : u.length ? { type: "dev", id: u[0] } : null); };
  const eltern = useMemo(() => { const m = new Map(); for (const [id, ch] of T.children) for (const c of ch) m.set(c, id); return m; }, [T]);
  const Lroh = front ? F : LM;
  const ziele = useMemo(() => ({ ...(auto ? {} : P.layout[fixKey] || {}), ...pins }), [auto, P.layout, fixKey, pinKey]);
  const ordnung = { eltern, stapel, tab: front ? TAB_H : 0, kopf: front ? 18 : 0 };
  const Lbase = useMemo(() => anordnen(Lroh, { ziele, ...ordnung }), [Lroh, ziele, eltern, stapel, front]);

  // Probleme je Gerät / Verbindung
  const devIssues = useMemo(() => {
    const m = new Map();
    for (const i of issues) for (const id of i.devs || (i.dev ? [i.dev] : [])) { if (!m.has(id)) m.set(id, []); m.get(id).push(i); }
    return m;
  }, [issues]);
  const connIssues = useMemo(() => {
    const m = new Map();
    for (const i of issues) if (i.conn) { if (!m.has(i.conn)) m.set(i.conn, []); m.get(i.conn).push(i); }
    return m;
  }, [issues]);

  // Live-Position während des Ziehens: das gezogene Gerät bekommt vorläufig ein festes Ziel,
  // nicht fixierte Äste folgen ihm, angepinnte Geräte bleiben stehen.
  const L = useMemo(() => {
    if (!drag || drag.kind !== "node" || !drag.moved) return Lbase;
    const p = Lbase.pos.get(drag.id);
    if (!p) return Lbase;
    const extra = {};
    for (const id of [drag.id, ...(drag.gruppe || [])]) {
      const q = Lbase.pos.get(id);
      if (q) extra[id] = { x: q.x + drag.dx, y: q.y + drag.dy };
      if (front) for (const m of F.members.get(id) || []) if (m !== id && ziele[m]) extra[m] = { x: ziele[m].x + drag.dx, y: ziele[m].y + drag.dy };
    }
    return anordnen(Lroh, { ziele: { ...ziele, ...extra }, ...ordnung });
  }, [Lbase, drag, Lroh, ziele]);
  const posOf = (id) => L.pos.get(id) || null;
  const slotsOf = (id) => L.slots?.get(id);

  // Auto-Anordnen aus: fehlt für diese Ansicht noch ein Stand, jetzt sichern
  useEffect(() => {
    if (!auto && !P.layout[fixKey] && Lbase.pos.size) mutate((d) => { d.layout[fixKey] = positionenSichern(Lbase); });
  }, [auto, fixKey]);
  const setAuto = (an) => mutate((d) => {
    d.layout.autoAnordnen = an;
    if (an) { delete d.layout.fix; delete d.layout.fpFix; }
    else d.layout[fixKey] = positionenSichern(Lbase);
  });
  /* Von Hand angepasstes Layout dieser Ansicht: verschobene Geräte oder Kabel, oder
     (bei Auto-Anordnen aus) Positionen, die vom automatischen Stand abweichen. */
  const manuellAngepasst = () => {
    const lay = P.layout;
    if (Object.keys(lay[offKey] || {}).length || Object.keys(lay[knickKey] || {}).length) return true;
    if (!auto) for (const [id, z] of Object.entries(lay[fixKey] || {})) { const p = Lroh.pos.get(id); if (p && !pins[id] && Math.hypot(p.x - z.x, p.y - z.y) > 4) return true; }
    return false;
  };
  const [warnung, setWarnung] = useState(null); // { text, ok }
  const mitWarnung = (text, ok) => (manuellAngepasst() ? setWarnung({ text, ok }) : ok());
  // Geräte im Stapel pinnen den ganzen Stapel (über das oberste Gerät, den Anker)
  const togglePin = (id0) => mutate((d) => {
    const id = stapelAnker(d.layout.stapel || [], id0);
    const m = { ...(d.layout[pinKey] || {}) };
    if (m[id]) delete m[id];
    else { const p = Lbase.pos.get(id); if (p) m[id] = { x: Math.round(p.x), y: Math.round(p.y) }; }
    d.layout[pinKey] = m;
  });
  // Mehrfachauswahl: alle anpinnen (sind schon alle angepinnt: alle lösen)
  const allePinnen = (ids) => mutate((d) => {
    const anker = [...new Set(ids.map((id) => stapelAnker(d.layout.stapel || [], id)))];
    const m = { ...(d.layout[pinKey] || {}) };
    const loesen = anker.every((id) => m[id]);
    for (const id of anker) {
      if (loesen) delete m[id];
      else if (!m[id]) { const p = Lbase.pos.get(id); if (p) m[id] = { x: Math.round(p.x), y: Math.round(p.y) }; }
    }
    d.layout[pinKey] = m;
  });
  const mehrereLoeschen = (ids) => {
    if (!ids.length || !confirm(`${ids.length} Geräte und ihre Verbindungen löschen?`)) return;
    const weg = new Set(ids);
    mutate((d) => removeDevices(d, weg)); // gemeinsame Kaskade: Verbindungen, Layout, Knicke, Stapel, Stromziele
    setSelection(null);
  };
  const knickOf = (c) => (drag?.kind === "knick" && drag.id === c.id ? { dx: drag.bx + drag.dx, dy: drag.by + drag.dy } : P.layout[knickKey]?.[c.id]);
  const bg = P.layout[bgKey];
  const bgPos = bg && (drag?.kind === "bg" ? { ...bg, x: bg.x + drag.dx, y: bg.y + drag.dy } : bg);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight, b = L.bounds, pad = 60;
    const k = Math.min(1.4, Math.max(0.15, Math.min((w - pad * 2) / (b.maxX - b.minX || 1), (h - pad * 2) / (b.maxY - b.minY || 1))));
    setView({ k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: h / 2 - ((b.minY + b.maxY) / 2) * k });
  }, [L]);
  useEffect(() => { if (!fitted.current && wrapRef.current?.clientWidth) { fit(); fitted.current = true; } });
  useEffect(() => { fitted.current = false; }, [P.meta.veranstaltung]);

  const toWorld = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  };
  const hitNode = (w) => {
    for (const [id, p] of L.pos) {
      if (!front) { if (Math.abs(w.x - p.x) <= HW && Math.abs(w.y - p.y) <= HH) return id; continue; }
      const top = p.y - p.h / 2 - (p.kind === "card" ? TAB_H : 0);
      if (Math.abs(w.x - p.x) <= p.w / 2 && w.y >= top && w.y <= p.y + p.h / 2) return id;
    }
    return null;
  };

  const onWheel = (e) => {
    // Shift + Mausrad: hoch/runter, Cmd/Strg + Mausrad: links/rechts, sonst Zoom.
    // Bei Shift liefern manche Systeme (macOS) den Wert als deltaX statt deltaY.
    const d = e.deltaY || e.deltaX;
    if (e.shiftKey) { setView((v) => ({ ...v, y: v.y - d })); return; }
    if (e.ctrlKey || e.metaKey) { setView((v) => ({ ...v, x: v.x - d })); return; }
    const r = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(3, Math.max(0.1, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    setView({ k, x: mx - ((mx - view.x) * k) / view.k, y: my - ((my - view.y) * k) / view.k });
  };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const h = (e) => e.preventDefault();
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  const onDown = (e, nodeId, conn = null, stapelId = null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (nodeId && (tool === "connect" || tool === "stack")) { const w = toWorld(e); setDraw({ from: nodeId, x: w.x, y: w.y, tool }); return; }
    const toggle = e.shiftKey || e.metaKey || e.ctrlKey;
    if (nodeId) {
      const id = stapelAnker(stapel, nodeId);
      // Gehört das Gerät zur Mehrfachauswahl, wandern alle gewählten Geräte mit
      const gruppe = !conn && !stapelId && !toggle && selIds.length > 1 && selIds.some((x) => stapelAnker(stapel, x) === id)
        ? [...new Set(selIds.map((x) => stapelAnker(stapel, x)))].filter((x) => x !== id) : null;
      setDrag({ kind: "node", id, klick: nodeId, gruppe, toggle, andere: rasten ? rastBoxen([id, ...(gruppe || [])]) : null, stapel: stapelId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false, conn });
    } else if (e.shiftKey && tool === "move") { const w = toWorld(e); setDrag({ kind: "rahmen", x0: w.x, y0: w.y, x1: w.x, y1: w.y, sx: e.clientX, sy: e.clientY, moved: false }); }
    else setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false });
  };
  // Einrasten: Boxen aller Geräte, die beim Ziehen von id stehen bleiben
  const boxOf = (p) => ({ x: p.x, y: p.y, w: p.w || NODE_W, h: p.h || NODE_H });
  const bewegOpts = () => ({ kinder: front ? new Map() : T.children, ziele, stapel, dazu: (id) => (front ? F.members.get(id) || [] : []) });
  const rastBoxen = (ids) => {
    const mit = gruppeBewegen(ids, bewegOpts()).alle;
    return [...Lbase.pos].filter(([k]) => !mit.has(k)).map(([, p]) => boxOf(p));
  };
  const onMove = (e) => {
    if (draw) { const w = toWorld(e); setDraw({ ...draw, x: w.x, y: w.y }); setHover(hitNode(w)); return; }
    if (!drag) return;
    const ddx = e.clientX - drag.sx, ddy = e.clientY - drag.sy;
    const moved = drag.moved || Math.abs(ddx) + Math.abs(ddy) > 4;
    if (drag.kind === "rahmen") { const w = toWorld(e); setDrag({ ...drag, x1: w.x, y1: w.y, moved }); return; }
    if (drag.kind === "pan") setView((v) => ({ ...v, x: drag.vx + ddx, y: drag.vy + ddy })), moved !== drag.moved && setDrag({ ...drag, moved });
    else {
      let dx = ddx / view.k, dy = ddy / view.k, linien = null;
      const p = drag.kind === "node" && drag.andere && !e.altKey && Lbase.pos.get(drag.id);
      if (p && moved) {
        const r = einrasten({ ...boxOf(p), x: p.x + dx, y: p.y + dy }, drag.andere, { fang: 8 / view.k });
        dx += r.dx; dy += r.dy; linien = r.linien;
      }
      setDrag({ ...drag, dx, dy, moved, linien });
    }
  };
  // Gerät oben auf einen Stapel legen. Der Stapel bleibt an seinem Platz: Das neue
  // oberste Gerät übernimmt Pin, feste Position bzw. Lage des bisherigen Ankers.
  const stapelOben = (neu, ziel) => mutate((d) => {
    const vorher = d.layout.stapel || [];
    const alt = stapelAnker(vorher, ziel);
    d.layout.stapel = obenAufStapel(vorher, neu, ziel, uid());
    if (alt === neu) return;
    for (const k of ["pins", "fpPins", "fix", "fpFix"]) {
      const m = d.layout[k];
      if (!m?.[alt]) continue;
      d.layout[k] = { ...m, [neu]: { ...m[alt] } };
      if (k === "pins" || k === "fpPins") delete d.layout[k][alt];
    }
    if (!auto || pins[alt]) return;
    const pa = Lbase.pos.get(alt);
    const pn = stapelAnker(vorher, neu) !== neu ? Lroh?.pos.get(neu) : Lbase.pos.get(neu);
    if (!pa || !pn) return;
    const o = d.layout[offKey]?.[neu] || { dx: 0, dy: 0 };
    d.layout[offKey] = { ...(d.layout[offKey] || {}), [neu]: { dx: Math.round(o.dx + pa.x - pn.x), dy: Math.round(o.dy + pa.y - pn.y) } };
  });
  const onUp = (e) => {
    if (draw) {
      const w = toWorld(e);
      let target = hitNode(w);
      // Im Stapel-Werkzeug zählt auch Rahmen oder Name eines Stapels als Ziel
      if (!target && draw.tool === "stack") {
        const sid = e.target?.closest?.("[data-stapel]")?.getAttribute("data-stapel");
        target = (L.stapel || []).find((b) => b.id === sid || (w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h))?.ids[0] || null;
      }
      if (target && target !== draw.from) {
        if (draw.tool === "stack") stapelOben(draw.from, target);
        else connect(draw.from, target);
      }
      setDraw(null); setHover(null);
      return;
    }
    if (!drag) return;
    if (drag.kind === "node") {
      if (drag.moved) {
        const dx = drag.dx, dy = drag.dy;
        // Bei Mehrfachauswahl nur Geräte speichern, die nicht schon im Ast eines anderen gewählten Geräts mitlaufen
        const ids = drag.gruppe ? gruppeBewegen([drag.id, ...drag.gruppe], bewegOpts()).schreiben : [drag.id];
        const r = (z) => ({ x: Math.round(z.x + dx), y: Math.round(z.y + dy) });
        mutate((d) => {
          const pn = { ...(d.layout[pinKey] || {}) }, fx = { ...(d.layout[fixKey] || {}) };
          d.layout[offKey] = d.layout[offKey] || {};
          for (const id of ids) {
            const p = Lbase.pos.get(id);
            if (!p) continue;
            if (pn[id]) pn[id] = r(p);
            else if (!auto) fx[id] = r(p);
            else {
              const o = d.layout[offKey][id] || { dx: 0, dy: 0 };
              d.layout[offKey][id] = { dx: Math.round(o.dx + dx), dy: Math.round(o.dy + dy) };
            }
            const mit = front ? (F.members.get(id) || []).filter((m) => m !== id) : [];
            for (const m of mit) { if (pn[m]) pn[m] = r(pn[m]); if (!auto && fx[m]) fx[m] = r(fx[m]); }
          }
          d.layout[pinKey] = pn;
          if (!auto) d.layout[fixKey] = fx;
        });
      } else if (drag.toggle && !drag.conn) {
        const id = drag.klick || drag.id;
        waehle(selIds.includes(id) ? selIds.filter((x) => x !== id) : [...selIds, id]);
      } else setSelection(drag.conn ? { type: "conn", id: drag.conn.id } : drag.stapel ? { type: "stapel", id: drag.stapel } : { type: "dev", id: drag.klick || drag.id });
    } else if (drag.kind === "knick") {
      const { id, bx, by, dx, dy } = drag;
      if (drag.moved) mutate((d) => { d.layout[knickKey] = { ...(d.layout[knickKey] || {}), [id]: { dx: Math.round(bx + dx), dy: Math.round(by + dy) } }; });
    } else if (drag.kind === "bg") {
      const { dx, dy } = drag;
      if (drag.moved) mutate((d) => { const b = d.layout[bgKey]; if (b) { b.x = Math.round(b.x + dx); b.y = Math.round(b.y + dy); } });
    } else if (drag.kind === "rahmen") {
      if (drag.moved) {
        const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1), y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1);
        const drin = [...L.pos].filter(([id, p]) => X.devById.has(id) && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).map(([id]) => id);
        waehle([...selIds, ...drin]);
      }
    } else if (!drag.moved) setSelection(null);
    setDrag(null);
  };

  const connect = (fromId, toId, ports = {}) => {
    // Nur so viele Kabel, wie das Gerät Anschlüsse hat: sonst fragen, welcher ersetzt wird
    const voll = [fromId, toId].filter((id) => !ports[id] && X.devById.get(id) && !freiePorts(P, X.devById.get(id)).length);
    if (voll.length) { setTausch({ from: fromId, to: toId, voll }); return; }
    let newId = null;
    mutate((d) => {
      for (const [dev, port] of Object.entries(ports)) d.verbindungen = d.verbindungen.filter((c) => !((c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port)));
      newId = addConnection(d, fromId, toId, { portIdA: ports[fromId], portIdB: ports[toId] });
    });
    if (newId) setSelection({ type: "conn", id: newId });
  };

  // Drag & Drop aus der Palette
  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-netplan");
    if (!raw) return;
    const item = JSON.parse(raw);
    const w = toWorld(e);
    const target = hitNode(w);
    const id = onAddDevice(item, { connectTo: target, at: target ? null : { x: Math.round(w.x), y: Math.round(w.y) } });
    if (id) setSelection({ type: "dev", id });
  };

  // Tastatur: Entf löscht Auswahl
  useEffect(() => {
    const k = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") { e.preventDefault(); waehle([...L.pos.keys()].filter((id) => X.devById.has(id))); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        if (selection.type === "multi") mehrereLoeschen(selIds);
        else if (selection.type === "dev") onDeleteDevice(selection.id);
        else if (selection.type === "stapel") { mutate((d) => { d.layout.stapel = (d.layout.stapel || []).filter((x) => x.id !== selection.id); }); setSelection(null); }
        else onDeleteConn(selection.id);
      }
      if (e.key === "Escape") { setSelection(null); setDraw(null); }
      if (e.metaKey || e.ctrlKey || e.altKey) return; // ⌘C / Strg+C usw. nicht abfangen
      const key = e.key.toLowerCase();
      if (key === "m" || key === "v") setTool("move");
      if (key === "c") setTool("connect");
      if (key === "s") setTool("stack");
      if (key === "p" && selection?.type === "dev") togglePin(selection.id);
      if (key === "p" && selection?.type === "multi") allePinnen(selIds);
      if (key === "p" && selection?.type === "stapel") { const s0 = stapel.find((x) => x.id === selection.id); if (s0) togglePin(s0.ids[0]); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selection, onDeleteDevice, onDeleteConn, setSelection, togglePin, mutate, L, X]);

  /* ── Filter & Suche ─────────────────────────────────────────────────── */
  const ql = q.trim().toLowerCase();
  const matches = (d) => {
    if (katFilter && d.kategorie !== katFilter) return false;
    if (vlanFilter) {
      const inV = d.ports.some((p) => p.vlan === vlanFilter || (p.modus === "trunk" && (p.vlans || []).includes(vlanFilter)));
      if (!inV) return false;
    }
    if (ql) return `${d.name} ${d.netzname || ""} ${(d.felder || []).map((f) => f.wert).join(" ")} ${d.modell} ${d.hersteller} ${d.bereich} ${ipPorts(d).map((i) => i.ip).join(" ")}`.toLowerCase().includes(ql);
    return true;
  };
  const filtering = !!(katFilter || vlanFilter || ql);

  const edgeStyle = (c) => {
    const cv = connVlan(c, X);
    const p2p = isP2PConn(c, X);
    const errs = (connIssues.get(c.id) || []).some((i) => i.sev === "error");
    let color = "#5b6570", width = 2.2;
    if (colorBy === "vlan") {
      if (cv.kind === "trunk") { color = "#d8dde3"; width = 4; }
      else if (cv.vlans[0]) color = X.vlanById.get(cv.vlans[0])?.farbe || color;
    } else if (colorBy === "kabel") color = KABEL_FARBEN[c.kabel] || color;
    else {
      const a = X.devById.get(c.a.dev), b = X.devById.get(c.b.dev);
      const ep = !a?.isSwitch ? a : b;
      color = katColor(ep?.kategorie);
    }
    if (p2p) color = colorBy === "kabel" ? color : "#ff8c42";
    return { color: errs ? ERR : color, width, dash: p2p ? KABEL.p2p.dash : KABEL[c.kabel]?.dash || "", errs, trunk: cv.kind === "trunk" };
  };

  const edgePath = (pa, pb, k, sp) => {
    const dir = pb.x >= pa.x ? 1 : -1;
    const mitKnick = (x1, y1, x2, y2, r) => {
      const m = { x: (x1 + x2) / 2 + (k?.dx || 0), y: (y1 + y2) / 2 + (k?.dy || 0) };
      return { d: knickPfad(x1, y1, x2, y2, m, r, linien), x1, y1, x2, y2, mx: m.x, my: m.y };
    };
    if (Math.abs(pb.x - pa.x) < NODE_W) {
      const dy = pb.y >= pa.y ? 1 : -1;
      const x1 = pa.x + (sp?.start || 0), y1 = pa.y + dy * HH, x2 = pb.x + (sp?.ende || 0), y2 = pb.y - dy * HH;
      if (k) return mitKnick(x1, y1, x2, y2, "v");
      const my = (y1 + y2) / 2 + dy * (sp?.spur || 0);
      return { d: linien === "direkt" ? `M${x1},${y1} L${x2},${y2}` : linien === "eckig" ? eckPfad(x1, y1, x2, y2, "v", my) : `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, x1, y1, x2, y2, mx: (x1 + x2) / 2, my: linien === "direkt" ? (y1 + y2) / 2 : my };
    }
    const x1 = pa.x + dir * HW, y1 = pa.y + (sp?.start || 0), x2 = pb.x - dir * HW, y2 = pb.y + (sp?.ende || 0);
    if (k) return mitKnick(x1, y1, x2, y2, "h");
    const mx = (x1 + x2) / 2 + dir * (sp?.spur || 0);
    return { d: linien === "direkt" ? `M${x1},${y1} L${x2},${y2}` : linien === "eckig" ? eckPfad(x1, y1, x2, y2, "h", mx) : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, x1, y1, x2, y2, mx: linien === "direkt" ? (x1 + x2) / 2 : mx, my: (y1 + y2) / 2 };
  };
  /* Kabel zwischen zwei Geräten desselben Stapels: als Klammer an der Außenseite
     des Stapels statt als unsichtbar kurze Linie zwischen den Geräten. */
  const imStapel = (a, b) => { const s0 = stapelVon(stapel, a); return s0 && s0.ids.includes(b) ? s0 : null; };
  const klammerPfad = (pa, pb, i, seite, halb) => {
    const x1 = pa.x + seite * halb(pa), x2 = pb.x + seite * halb(pb);
    const xo = (seite > 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + seite * (5 + i * 4);
    const y1 = pa.y + 4 + i * 3, y2 = pb.y - 4 - i * 3;
    return { d: eckPfad(x1, y1, x2, y2, "h", xo), x1, y1, x2, y2, mx: xo, my: (y1 + y2) / 2 };
  };
  // Linie direkt greifen: im Bewegen-Werkzeug verschiebt Ziehen an einer Verbindung ihre Knickstelle
  const linieGreifen = (e, c) => {
    e.stopPropagation();
    if (e.button || tool !== "move" || e.shiftKey || stapelKlammer.has(c.id)) return;
    const k = P.layout[knickKey]?.[c.id] || { dx: 0, dy: 0 };
    setSelection({ type: "conn", id: c.id });
    setDrag({ kind: "knick", id: c.id, bx: k.dx, by: k.dy, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false });
  };
  // Griff zum Verschieben der ausgewählten Verbindung
  const knickGriff = (c, mx, my) => tool === "move" && selConn?.id === c.id && (
    <g className="np-ui" style={{ cursor: "move" }} onMouseDown={(e) => { if (e.button) return; e.stopPropagation(); const k = P.layout[knickKey]?.[c.id] || { dx: 0, dy: 0 }; setDrag({ kind: "knick", id: c.id, bx: k.dx, by: k.dy, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false }); }}
      onDoubleClick={(e) => { e.stopPropagation(); mutate((d) => { const m = { ...(d.layout[knickKey] || {}) }; delete m[c.id]; d.layout[knickKey] = m; }); }}>
      <circle cx={mx} cy={my} r="11" fill="transparent" />
      <circle cx={mx} cy={my} r="6" fill={ACCENT} stroke="#fff" strokeWidth="1.5" />
      <title>Ziehen = Verbindung verschieben · Doppelklick = zurücksetzen</title>
    </g>
  );

  const selDev = selection?.type === "dev" ? X.devById.get(selection.id) : null;
  const selConn = selection?.type === "conn" ? P.verbindungen.find((c) => c.id === selection.id) : null;
  const selStapel = selection?.type === "stapel" ? stapel.find((x) => x.id === selection.id) : null;

  const allConns = P.verbindungen.filter((c) => posOf(c.a.dev) && posOf(c.b.dev));
  const treeChildByConn = new Map([...T.treeConn].map(([child, c]) => [c.id, child]));
  const treeConnIds = new Set(treeChildByConn.keys());
  // Mindmap: Richtung je Kabel (vom Elternknoten aus) und Spuren, damit Kabel nicht übereinander liegen
  const stapelKlammer = new Map(); // conn id → Nummer der Klammer im Stapel (für den Abstand)
  for (const c of allConns) {
    const s0 = imStapel(c.a.dev, c.b.dev);
    if (!s0) continue;
    const n = [...stapelKlammer.entries()].filter(([, v]) => v.stapel === s0.id).length;
    stapelKlammer.set(c.id, { stapel: s0.id, i: n });
  }
  const kabelWeg = new Map();
  if (!front) for (const c of allConns) {
    let from = posOf(c.a.dev), to = posOf(c.b.dev), fromEnd = c.a, toEnd = c.b;
    if (treeConnIds.has(c.id) ? treeChildByConn.get(c.id) === c.a.dev : !X.devById.get(c.a.dev)?.isSwitch && X.devById.get(c.b.dev)?.isSwitch) { [from, to] = [to, from]; [fromEnd, toEnd] = [toEnd, fromEnd]; }
    kabelWeg.set(c.id, { from, to, fromEnd, toEnd });
  }
  // Mehrere Kabel am selben Gerät und auf derselben Seite: Port-Plaketten am Gerät untereinander
  const plakettenReihe = new Map();
  if (!front && showPorts) {
    const gruppen = new Map();
    for (const c of allConns) {
      const { from, to, toEnd } = kabelWeg.get(c.id);
      if (!from || !to || stapelKlammer.has(c.id)) continue;
      const seite = Math.abs(to.x - from.x) < NODE_W ? "v" + Math.sign(to.y - from.y) : "h" + Math.sign(to.x - from.x);
      const k = toEnd.dev + "|" + seite;
      if (!gruppen.has(k)) gruppen.set(k, []);
      gruppen.get(k).push(c);
    }
    for (const liste of gruppen.values()) {
      if (liste.length < 2) continue;
      const ports = X.devById.get(kabelWeg.get(liste[0].id).toEnd.dev)?.ports || [];
      const idx = (c) => ports.findIndex((p) => p.id === kabelWeg.get(c.id).toEnd.port);
      liste.sort((a, b) => idx(a) - idx(b)).forEach((c, i) => plakettenReihe.set(c.id, { i, n: liste.length }));
    }
  }
  const spuren = front ? new Map() : kabelSpuren(allConns.filter((c) => !knickOf(c) && !stapelKlammer.has(c.id)).map((c) => {
    const { from, to, fromEnd, toEnd } = kabelWeg.get(c.id);
    const senk = Math.abs(to.x - from.x) < NODE_W;
    return senk ? { id: c.id, von: fromEnd.dev, nach: toEnd.dev, seite: "v" + Math.sign(to.y - from.y), start: from.x, ziel: to.x }
      : { id: c.id, von: fromEnd.dev, nach: toEnd.dev, seite: "h" + Math.sign(to.x - from.x), start: from.y, ziel: to.y };
  }), buendeln ? "buendel" : linien === "eckig" ? "spuren" : "paare", { breite: NODE_H * 0.8 });

  // Frontplatten: Enden an Karten verteilen und jedem Kabel eine eigene Bahn geben
  const fpWeg = new Map();
  if (front) {
    const roh = [];
    for (const c of allConns) {
      const pa = posOf(c.a.dev), pb = posOf(c.b.dev);
      if (!pa || !pb) continue;
      const sa = slotsOf(c.a.dev)?.get(c.a.port), sb = slotsOf(c.b.dev)?.get(c.b.port);
      roh.push({ c, pa, pb, a1: anker(pa, sa, pb), b1: anker(pb, sb, pa), sa, sb, kl: stapelKlammer.get(c.id) });
    }
    const enden = [];
    for (const r of roh) {
      if (r.kl) continue;
      if (!r.sa) enden.push({ id: r.c.id + "|a", dev: r.c.a.dev + (r.a1.dir > 0 ? "u" : "o"), gegenX: r.b1.x });
      if (!r.sb) enden.push({ id: r.c.id + "|b", dev: r.c.b.dev + (r.b1.dir > 0 ? "u" : "o"), gegenX: r.a1.x });
    }
    const versatz = endenVerteilen(enden, { abstand: 12, breite: CARD_W * 0.8 });
    for (const r of roh) {
      r.a1 = { ...r.a1, x: r.a1.x + (versatz.get(r.c.id + "|a") || 0) };
      r.b1 = { ...r.b1, x: r.b1.x + (versatz.get(r.c.id + "|b") || 0) };
      r.straight = r.pa.kind === "switch" && r.pb.kind === "switch";
      fpWeg.set(r.c.id, r);
    }
    const bahn = bahnenVergeben(roh.filter((r) => !r.kl && !r.straight && !knickOf(r.c)).map((r) => ({
      id: r.c.id, x1: r.a1.x, y1: r.a1.y, x2: r.b1.x, y2: r.b1.y,
      gruppe: r.pa.kind === "switch" ? r.c.a.dev : r.pb.kind === "switch" ? r.c.b.dev : r.c.a.dev, devs: [r.c.a.dev, r.c.b.dev],
      gy: r.pa.kind === "switch" ? r.a1.y : r.pb.kind === "switch" ? r.b1.y : undefined,
    })), { abstand: 12, rand: 22, buendeln, hindernisse: [...L.pos].filter(([id]) => X.devById.has(id)).map(([id, p]) => {
      const w = p.w || CARD_W, h = p.h || CARD_H, top = p.y - h / 2 - (p.kind === "card" ? TAB_H : 0);
      return { dev: id, x0: p.x - w / 2, x1: p.x + w / 2, y0: top, y1: p.y + h / 2 };
    }) });
    for (const [id, y] of bahn) fpWeg.get(id).bahn = y;
  }

  const closeCtx = useCallback(() => setCtx(null), []);
  const trenner = <span style={{ width: 1, height: 22, background: LINE, flexShrink: 0 }} />;
  const zeile = { display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap", overflow: "hidden", minHeight: 32 };
  const knopf = { ...S.ghostBtn, whiteSpace: "nowrap", flexShrink: 0 };
  const ico = { size: 14, strokeWidth: 2 };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Werkzeugleiste: feste Reihen über Palette, Zeichenfläche und Seitenleiste, damit nichts umspringt */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "7px 10px", background: PANEL, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <div style={zeile}>
          <div style={{ display: "flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden", flexShrink: 0 }} title="Darstellung der Topologie">
            {[["mindmap", <Network {...ico} />, "Mindmap"], ["front", <Cable {...ico} />, "Anschlüsse"]].map(([k, i, l]) => (
              <button key={k} onClick={() => setAnsicht(k)} title={k === "front" ? "Geräte mit ihren Anschlüssen, Kabel von Buchse zu Buchse" : "Baum vom Hauptswitch aus"} style={{ ...knopf, border: "none", borderRadius: 0, ...((front ? "front" : "mindmap") === k ? { background: "#2c3b93", color: "#fff" } : {}) }}>{i}{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            {[["move", <Move {...ico} />, "Bewegen", "M"], ["connect", <Link2 {...ico} />, "Verbinden", "C"], ["stack", <Layers {...ico} />, "Stapeln", "S"]].map(([k, i, l, key]) => (
              <button key={k} title={k === "stack" ? "Taste S · von einem Gerät auf ein anderes ziehen: stapelt sie grafisch (Rack, Tower). Keine Netzwerkverbindung." : `Taste ${key}`} onClick={() => setTool(k)} style={{ ...knopf, border: "none", borderRadius: 0, ...(tool === k ? { background: ACCENT, color: "#fff" } : {}) }}>{i}{l}</button>
            ))}
          </div>
          {trenner}
          <button style={knopf} onClick={fit} title="Alles einpassen"><Maximize {...ico} />Einpassen</button>
          <button style={knopf} onClick={() => mitWarnung("Auto-Layout setzt alle von Hand verschobenen Geräte und Verbindungen dieser Ansicht zurück. Angepinnte Geräte und Stapel bleiben stehen.", () => mutate((d) => { d.layout[offKey] = {}; d.layout.pinned = {}; delete d.layout[fixKey]; d.layout[knickKey] = {}; }))}
            title="Verschiebungen von Geräten und Verbindungen zurücksetzen. Angepinnte Geräte und Stapel bleiben."><RotateCcw {...ico} />Auto-Layout</button>
          <Toggle checked={rasten} onChange={(v) => mutate((d) => { d.layout.einrasten = v; })} label="Einrasten"
            title="An: Geräte rasten beim Ziehen im Raster ein und richten sich an Kanten und Mitten benachbarter Geräte aus. Alt gedrückt halten = frei ziehen." />
          <Toggle checked={auto} onChange={(an) => an ? mitWarnung("Auto-Anordnen ordnet alle Geräte neu an. Die von Hand gesetzten Positionen gehen dabei verloren, angepinnte Geräte bleiben stehen.", () => setAuto(true)) : setAuto(false)} label="Auto-Anordnen" title="An: Geräte ordnen sich beim Bearbeiten automatisch an (angepinnte bleiben stehen). Aus: alle Geräte und Leitungen bleiben, wo sie sind." />
          {trenner}
          <button style={{ ...knopf, ...(bg?.src ? { borderColor: ACCENT } : {}) }} onClick={() => setBgOpen((o) => !o)} title="Hintergrundbild, z. B. Stage-Plot oder Hallenplan"><ImageIcon {...ico} />Hintergrund</button>
          <button style={knopf} title="Alle Äste ein- oder ausklappen" onClick={() => mutate((d) => { const any = Object.values(d.layout.collapsed || {}).some(Boolean); d.layout.collapsed = any ? {} : Object.fromEntries([...T.children].filter(([id, ch]) => ch.length && !T.roots.includes(id)).map(([id]) => [id, true])); })}><ListTree {...ico} />Äste</button>
          <button style={knopf} disabled={!stapelClip} onClick={() => { if (!stapelClip) return; let neu = null; mutate((d) => { neu = stapelEinfuegen(d, stapelClip); }); if (neu?.stapelId) setSelection({ type: "stapel", id: neu.stapelId }); else if (neu?.ids[0]) setSelection({ type: "dev", id: neu.ids[0] }); }}
            title={stapelClip ? `Kopierten Stapel „${stapelClip.name || "Stapel"}“ (${stapelClip.geraete.length} Geräte) einfügen` : "Erst im Stapel-Fenster einen Stapel kopieren"}><ClipboardPaste {...ico} />Stapel einfügen</button>
          <span style={{ flex: 1 }} />
          <button style={knopf} onClick={() => checkReach()} title="Alle Geräte mit IP anpingen bzw. Web-UI-Port prüfen"><RefreshCw {...ico} />Status</button>
          <Toggle checked={autoStatus} onChange={setAutoStatus} label="alle 15 s" title="Erreichbarkeit zyklisch prüfen" />
        </div>
        <div style={zeile}>
          <select style={{ ...S.selectSm, width: 130, flexShrink: 0 }} value={colorBy} onChange={(e) => setColorBy(e.target.value)} title="Farbe der Verbindungen">
            <option value="vlan">Farbe: VLAN</option><option value="kat">Farbe: Bereich</option><option value="kabel">Farbe: Kabel</option>
          </select>
          <select style={{ ...S.selectSm, width: 130, flexShrink: 0 }} value={linien} onChange={(e) => mutate((d) => { d.layout.linien = e.target.value; })} title="Form der Verbindungslinien">
            <option value="rund">Linien: rund</option><option value="eckig">Linien: eckig</option><option value="direkt">Linien: direkt</option>
          </select>
          <Toggle checked={buendeln} disabled={linien !== "eckig"} onChange={(v) => mutate((d) => { d.layout.kabelBuendel = v; })} label="Kabel bündeln"
            title={linien !== "eckig" ? "Nur bei „Linien: eckig“" : front ? "An: die Kabel eines Switches laufen gemeinsam in einem Kanal. Aus: jedes Kabel läuft auf eigener Bahn daneben." : "An: Kabel teilen sich den Weg, mehrere Kabel zwischen denselben Geräten werden eine Linie mit Anzahl. Aus: jedes Kabel läuft einzeln auf eigener Spur daneben."} />
          <select style={{ ...S.selectSm, width: 170, flexShrink: 0 }} value={titel} onChange={(e) => setTitel(e.target.value)} title="Beschriftung der Geräte">
            <option value="name">Titel: Gerätename</option><option value="netzname">Titel: Netzwerkname</option><option value="typ">Titel: Typ / Modell</option>{(P.feldKatalog || []).map((f) => <option key={f.id} value={"feld:" + f.id}>Titel: {f.name}</option>)}
          </select>
          {trenner}
          <select style={{ ...S.selectSm, width: 130, flexShrink: 0 }} value={katFilter} onChange={(e) => setKatFilter(e.target.value)} title="Nur einen Bereich hervorheben">
            <option value="">Alle Bereiche</option>{Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
          </select>
          <VlanSelect vlans={P.vlans} value={vlanFilter} onChange={setVlanFilter} style={{ width: 150, flexShrink: 0 }} noneLabel="Alle VLANs" />
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
            <input style={{ ...S.inputSm, width: 170, paddingLeft: 26 }} placeholder="Suchen (Name, IP)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Toggle checked={showPorts && !front} disabled={front} onChange={setShowPorts} label="Port & VLAN" title={front ? "In der Anschluss-Ansicht stehen die Ports direkt an den Buchsen" : "Switch-Port und VLAN an jeder Verbindung anzeigen"} />
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Palette: eingeklappt bleiben die Typ-Icons als Miniaturen sichtbar und ziehbar */}
      <div style={{ width: paletteOpen ? 176 : 46, background: DARK, borderRight: `1px solid ${LINE}`, overflowY: "auto", overflowX: "hidden", flexShrink: 0, transition: "width .15s" }}>
        <button style={{ ...S.ghostBtn, border: "none", width: "100%", justifyContent: paletteOpen ? "space-between" : "center", borderRadius: 0, borderBottom: `1px solid ${LINE}` }} onClick={() => setPaletteOpen((o) => !o)} title={paletteOpen ? "Geräteliste einklappen" : "Geräteliste ausklappen"}>
          {paletteOpen && <span className="sp-section-label" style={{ margin: 0 }}>Geräte</span>}{paletteOpen ? <PanelLeftClose {...ico} /> : <PanelLeftOpen {...ico} />}
        </button>
        <div style={{ padding: paletteOpen ? 8 : "6px 4px" }}>
          <button style={{ ...S.primaryBtn, width: "100%", padding: paletteOpen ? "7px 8px" : "6px 0", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }} onClick={() => onAddDevice(null, { connectTo: selDev?.id, picker: true })} title="Gerät aus dem Katalog hinzufügen">
            <Plus {...ico} />{paletteOpen && "Aus Katalog …"}
          </button>
          {paletteOpen && <div style={{ ...S.hint, marginTop: 6 }}>Typ auf ein Gerät ziehen = anschließen. Auf leere Fläche = frei platzieren.</div>}
        </div>
        {Object.entries(TYPEN).map(([k, t]) => (
          <div key={k} draggable onDragStart={(e) => e.dataTransfer.setData("application/x-netplan", JSON.stringify({ kind: "typ", key: k }))}
            onDoubleClick={() => { const id = onAddDevice({ kind: "typ", key: k }, { connectTo: selDev?.id }); if (id) setSelection({ type: "dev", id }); }}
            title={paletteOpen ? "Ziehen oder Doppelklick" : `${t.label} · ziehen oder Doppelklick`}
            style={{ display: "flex", alignItems: "center", justifyContent: paletteOpen ? "flex-start" : "center", gap: 8, padding: paletteOpen ? "5px 10px" : "6px 0", cursor: "grab", fontSize: 12, color: "#c8d0d8", borderBottom: "1px solid #232a33" }}>
            <IconView icon={t.icon} color={katColor(t.kat)} size={paletteOpen ? 18 : 22} />{paletteOpen && t.label}
          </div>
        ))}
      </div>

      {/* Zeichenfläche */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={wrapRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: front ? FP_BG : "#12161a", cursor: tool !== "move" ? "crosshair" : drag?.kind === "pan" ? "grabbing" : "default" }}
          onMouseDown={(e) => onDown(e, null)} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { setDrag(null); setDraw(null); }}
          onWheel={onWheel} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <svg ref={svgRef} width="100%" height="100%" style={{ display: "block", userSelect: "none" }} xmlns="http://www.w3.org/2000/svg" fontFamily="'Segoe UI',system-ui,sans-serif">
            <defs>
              <pattern id="np-grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {front ? <path d="M40 0 L0 0 0 40" fill="none" stroke="#1c2552" strokeWidth="1" /> : <circle cx="1" cy="1" r="1" fill="#252b33" />}
              </pattern>
              <filter id="np-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <rect className="np-ui" width="100%" height="100%" fill="url(#np-grid)" />
            <g id="np-world" transform={`translate(${view.x},${view.y}) scale(${view.k})`} data-bounds={JSON.stringify(L.bounds)} data-bg={front ? FP_BG : "#15191e"}>
              {/* Hintergrundbild (z. B. Stage-Plot) */}
              {bgPos?.src && <image href={bgPos.src} x={bgPos.x} y={bgPos.y} width={bgPos.w} height={bgPos.h} opacity={bgPos.deckkraft ?? 0.5} preserveAspectRatio="none"
                style={{ cursor: bgPos.fest === false && tool === "move" ? "move" : undefined, pointerEvents: bgPos.fest === false && tool === "move" ? "auto" : "none" }}
                onMouseDown={(e) => { if (e.button || bgPos.fest !== false) return; e.stopPropagation(); setDrag({ kind: "bg", sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false }); }} />}
              {/* Stapel (grafische Gruppen, z. B. Rack oder Tower) */}
              {(L.stapel || []).map((b) => (
                <g key={b.id} data-stapel={b.id} onMouseDown={(e) => onDown(e, b.ids[0], null, b.id)} style={{ cursor: "move" }}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="10" fill="#ffffff08" stroke={selection?.type === "stapel" && selection.id === b.id ? ACCENT : "#8a96a3"} strokeWidth={selection?.type === "stapel" && selection.id === b.id ? 2 : 1.2} strokeDasharray="5 4" />
                  {pins[b.ids[0]] && <Pin x={b.x + b.w - 15} y={b.y + 3} size={11} color={ACCENT} strokeWidth={2.2} />}
                  <text x={front ? b.x + 10 : b.x + b.w / 2 >= 0 ? b.x + b.w + 6 : b.x - 6} y={front ? b.y + 13 : b.y + b.h / 2 + 4} textAnchor={front || b.x + b.w / 2 >= 0 ? "start" : "end"} fontSize="10.5" fontWeight="700" fill="#aeb8c2" style={{ cursor: "pointer" }}>
                    {b.name || "Stapel"} · {b.ids.length}<title>Klick auf Rahmen oder Name = Stapel bearbeiten (Name, Reihenfolge, kopieren, duplizieren)</title>
                  </text>
                </g>
              ))}
              {/* Verbindungen */}
              {front && allConns.map((c) => {
                const w = fpWeg.get(c.id);
                if (!w) return null;
                const { pa, pb, straight, bahn, kl } = w;
                let { a1, b1 } = w;
                const kn = knickOf(c);
                let mx = (a1.x + b1.x) / 2 + (kn?.dx || 0), my = (bahn ?? (a1.y + b1.y) / 2) + (kn?.dy || 0);
                let dPath;
                if (kl) { // im selben Stapel: Klammer an der rechten Seite der Karten
                  const g = klammerPfad(pa, pb, kl.i, 1, (p) => (p.w || CARD_W) / 2);
                  dPath = g.d; a1 = { x: g.x1, y: g.y1 }; b1 = { x: g.x2, y: g.y2 }; mx = g.mx; my = g.my;
                } else if (kn) dPath = straight ? `M${a1.x},${a1.y} L${mx},${my} L${b1.x},${b1.y}` : knickPfad(a1.x, a1.y, b1.x, b1.y, { x: mx, y: my }, "v", linien);
                else if (straight || linien === "direkt") dPath = `M${a1.x},${a1.y} L${b1.x},${b1.y}`;
                else if (linien === "eckig") dPath = eckPfad(a1.x, a1.y, b1.x, b1.y, "v", my);
                else dPath = knickPfad(a1.x, a1.y, b1.x, b1.y, { x: mx, y: my }, "v", "rund");
                const st = edgeStyle(c);
                const sel = selConn?.id === c.id;
                const dim = filtering && !(matches(X.devById.get(c.a.dev)) && matches(X.devById.get(c.b.dev)));
                return (
                  <g key={c.id} opacity={dim ? 0.12 : 1} style={{ cursor: tool === "move" && !stapelKlammer.has(c.id) ? "grab" : "pointer" }}
                    onMouseDown={(e) => linieGreifen(e, c)} onClick={(e) => { e.stopPropagation(); setSelection({ type: "conn", id: c.id }); }}>
                    <path d={dPath} stroke="transparent" strokeWidth="12" fill="none" />
                    {(sel || st.errs) && <path d={dPath} stroke={sel ? ACCENT : ERR} strokeWidth={st.width + 6} fill="none" opacity=".35" filter="url(#np-glow)" />}
                    <path d={dPath} stroke={st.color} strokeWidth={straight ? Math.max(2, st.width - 1) : 1.8} fill="none" strokeDasharray={treeConnIds.has(c.id) ? st.dash : st.dash || "6 5"} />
                    <circle cx={a1.x} cy={a1.y} r="2.2" fill={st.color} /><circle cx={b1.x} cy={b1.y} r="2.2" fill={st.color} />
                    {c.label && <text x={(a1.x + b1.x) / 2 + 4} y={(a1.y + b1.y) / 2} fontSize="10" fill="#c8d0d8">{c.label}</text>}
                    {knickGriff(c, mx, my)}
                  </g>
                );
              })}
              {!front && allConns.map((c) => {
                const tree = treeConnIds.has(c.id);
                // Baumkanten vom Elternknoten aus zeichnen
                const { from, to, fromEnd, toEnd } = kabelWeg.get(c.id);
                const sp = spuren.get(c.id);
                const kl = stapelKlammer.get(c.id);
                const g = kl ? klammerPfad(from, to, kl.i, from.side || (from.x >= 0 ? 1 : -1), () => HW) : edgePath(from, to, knickOf(c), sp);
                // gebündelt: parallele Kabel als eine Linie, die Port-Plaketten bleiben sichtbar
                if (sp?.versteckt && selConn?.id !== c.id) return showPorts && plakettenReihe.has(c.id) ? <g key={c.id} style={{ cursor: "pointer" }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSelection({ type: "conn", id: c.id }); }}><PortBadge c={c} g={g} fromEnd={fromEnd} toEnd={toEnd} X={X} extra={!tree} reihe={plakettenReihe.get(c.id)} ziel={to} /></g> : null;
                const st = edgeStyle(c);
                const sel = selConn?.id === c.id;
                const da = X.devById.get(c.a.dev), db = X.devById.get(c.b.dev);
                const dim = filtering && !(matches(da) && matches(db));
                const pName = (end) => X.portRef.get(`${end.dev}:${end.port}`)?.port.name || "?";
                return (
                  <g key={c.id} opacity={dim ? 0.12 : 1} style={{ cursor: tool === "move" && !stapelKlammer.has(c.id) ? "grab" : "pointer" }}
                    onMouseDown={(e) => linieGreifen(e, c)} onClick={(e) => { e.stopPropagation(); setSelection({ type: "conn", id: c.id }); }}>
                    <path d={g.d} stroke="transparent" strokeWidth="14" fill="none" />
                    {(sel || st.errs) && <path d={g.d} stroke={sel ? ACCENT : ERR} strokeWidth={st.width + 6} fill="none" opacity=".35" filter="url(#np-glow)" />}
                    <path d={g.d} stroke={st.color} strokeWidth={st.width} fill="none" strokeDasharray={tree ? st.dash : st.dash || "6 5"} opacity={tree ? 1 : 0.85} />
                    {kl && <title>{`${da?.name} [${pName(c.a)}] ⇄ ${db?.name} [${pName(c.b)}] · im selben Stapel`}</title>}
                    {showPorts && !kl && <PortBadge c={c} g={g} fromEnd={fromEnd} toEnd={toEnd} X={X} extra={!tree} reihe={plakettenReihe.get(c.id)} ziel={to} />}
                    {sp?.anzahl > 1 && <g><rect x={g.mx - 11} y={g.my - 8} width="22" height="16" rx="8" fill="#1b2026" stroke={st.color} /><text x={g.mx} y={g.my + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#e8eaed">{sp.anzahl}×</text><title>{sp.anzahl} Kabel gebündelt</title></g>}
                    {showPorts && c.label && <text x={(g.x1 + g.x2) / 2} y={(g.y1 + g.y2) / 2 - 6} fontSize="10" fill="#c8d0d8" textAnchor="middle">{c.label}</text>}
                    {knickGriff(c, g.mx, g.my)}
                  </g>
                );
              })}
              {draw && posOf(draw.from) && (
                <line x1={posOf(draw.from).x} y1={posOf(draw.from).y} x2={draw.x} y2={draw.y} stroke={draw.tool === "stack" ? "#aeb8c2" : ACCENT} strokeWidth="2" strokeDasharray="6 4" />
              )}

              {/* Geräte */}
              {front && [...L.pos.keys()].map((id) => {
                const d = X.devById.get(id);
                if (!d) return null;
                const p = posOf(id);
                const iss = devIssues.get(id) || [];
                const worst = iss.some((i) => i.sev === "error") ? ERR : iss.some((i) => i.sev === "warn") ? WARN : null;
                const common = { d, p, P, sel: selIds.includes(id), hover: hover === id, hit: !!(ql && matches(d)), dim: filtering && !matches(d), status: status[id], worst, iss, titel, tool,
                  onDown: (e) => onDown(e, id), onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); setCtx({ id, x: e.clientX, y: e.clientY }); } };
                if (p.kind === "switch") {
                  const kids = T.children.get(id) || [];
                  const collapsed = !!P.layout.collapsed?.[id];
                  const url = webUrl(d);
                  return <FrontPlate key={id} {...common} X={X} slots={slotsOf(id)} url={url} onWeb={() => api.openExternal(url)}
                    onPortDown={(e, c) => { if (tool === "move" && e.button === 0) { onDown(e, id, c); } }}
                    canCollapse={kids.length > 0 && !T.roots.includes(id)} collapsed={collapsed} hidden={L.hidden.get(id)}
                    onToggle={() => mutate((dd) => { dd.layout.collapsed = { ...dd.layout.collapsed, [id]: !collapsed }; })} />;
                }
                const z = laschenZustand(id, T, X);
                const own = X.vlanById.get(ipPorts(d).find((i) => i.ip)?.vlan || ipPorts(d)[0]?.vlan);
                return <FrontCard key={id} {...common} tab={laschenText(id, T, X)} farbe={z ? kartenFarbe(z) : own?.farbe || MUTED} />;
              })}
              {!front && [...L.pos.keys()].map((id) => {
                const d = X.devById.get(id);
                if (!d) return null;
                const p = posOf(id);
                const col = katColor(d.kategorie);
                const sel = selIds.includes(id);
                const st = status[id];
                const iss = devIssues.get(id) || [];
                const worst = iss.some((i) => i.sev === "error") ? ERR : iss.some((i) => i.sev === "warn") ? WARN : null;
                const dim = filtering && !matches(d);
                const hit = ql && matches(d);
                const ip = mainIp(d);
                const v = X.vlanById.get(ipPorts(d).find((i) => i.ip)?.vlan || ipPorts(d)[0]?.vlan);
                const url = webUrl(d);
                const kids = T.children.get(id) || [];
                const collapsed = !!P.layout.collapsed?.[id];
                const isRoot = T.roots[0] === id;
                const side = p.side || (p.x >= 0 ? 1 : -1);
                return (
                  <g key={id} transform={`translate(${p.x - HW},${p.y - HH})`} opacity={dim ? 0.2 : 1}
                    onMouseDown={(e) => onDown(e, id)} style={{ cursor: tool !== "move" ? "crosshair" : "pointer" }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtx({ id, x: e.clientX, y: e.clientY }); }}>
                    {(sel || hover === id || hit) && <rect x="-4" y="-4" width={NODE_W + 8} height={NODE_H + 8} rx="11" fill="none" stroke={sel ? ACCENT : hover === id ? OK : "#fff"} strokeWidth="2" opacity=".9" />}
                    <rect width={NODE_W} height={NODE_H} rx="8" fill={isRoot ? "#262d36" : "#1f242b"} stroke={isRoot ? ACCENT : worst || LINE} strokeWidth={isRoot || worst ? 1.6 : 1} />
                    <rect width="5" height={NODE_H} rx="2" fill={col} />
                    <rect x="12" y="11" width="36" height="36" rx="7" fill={col + "1f"} />
                    <SvgIcon icon={d.icon} customIcons={P.icons} x={18} y={17} size={24} color={col} />
                    {(() => { const t = geraeteTitel(d, titel); return <text x="56" y="20" fontSize="13" fontWeight="700" fill="#fff">{t.length > 20 ? t.slice(0, 19) + "…" : t}<title>{[d.name, d.netzname && `Netzwerkname: ${d.netzname}`, ...feldZeilen(d)].filter(Boolean).join("\n")}</title></text>; })()}
                    <text x="56" y="36" fontSize="11" fill={ip ? "#c8d0d8" : MUTED} fontFamily="Consolas,monospace">{ip || (ipPorts(d).some((i) => i.dhcp) ? "DHCP" : d.isSwitch && !ipPorts(d).length ? "unmanaged" : "keine IP")}</text>
                    {v && <g transform={`translate(${56 + Math.max(ip.length, 7) * 6.6 + 6},27)`}><rect width={v.vid > 99 ? 30 : 24} height="12" rx="3" fill={v.farbe + "33"} stroke={v.farbe} strokeWidth=".8" /><text x={v.vid > 99 ? 15 : 12} y="9.5" fontSize="9" fill="#fff" textAnchor="middle">{v.vid}</text></g>}
                    <text x="56" y="50" fontSize="10" fill={MUTED}>{[d.bereich, d.modell || TYPEN[d.typ]?.label].filter(Boolean).join(" · ").slice(0, url ? 26 : 30)}</text>
                    <circle cx={NODE_W - 11} cy="11" r="4.5" fill={!st || st.ok === null || st.ok === undefined ? "#4a535e" : st.ok ? OK : ERR} stroke="#12161a" strokeWidth="1.5">
                      <title>{!st ? "Status unbekannt" : st.ok ? `erreichbar (${st.method}, ${st.ms} ms)` : st.ok === false ? `nicht erreichbar (${st.method})` : st.method}</title>
                    </circle>
                    {worst && <g><TriangleAlert x={NODE_W - 32} y={4} size={12} color={worst} strokeWidth={2.2} /><rect x={NODE_W - 32} y={4} width="12" height="12" fill="transparent"><title>{iss.map((i) => i.msg).join("\n")}</title></rect></g>}
                    {url && (
                      <g className="np-ui" transform={`translate(${NODE_W - 22},${NODE_H - 22})`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); api.openExternal(url); }} style={{ cursor: "pointer" }}>
                        <rect width="16" height="16" rx="4" fill="#2c343e" stroke={LINE} />
                        <Globe x={2} y={2} size={12} color="#7fb2ff" strokeWidth={2} />
                        <title>Web-UI öffnen: {url}</title>
                      </g>
                    )}
                    {kids.length > 0 && !isRoot && (
                      <g className="np-ui" transform={`translate(${side > 0 ? NODE_W + 2 : -18},${HH - 8})`} onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); mutate((dd) => { dd.layout.collapsed = { ...dd.layout.collapsed, [id]: !collapsed }; }); }} style={{ cursor: "pointer" }}>
                        <circle cx="8" cy="8" r="8" fill={collapsed ? ACCENT : "#2c343e"} stroke={collapsed ? ACCENT : LINE} />
                        <text x="8" y="11.5" fontSize={collapsed ? 8.5 : 11} fontWeight="700" textAnchor="middle" fill={collapsed ? DARK : "#c8d0d8"}>{collapsed ? "+" + (L.hidden.get(id) || kids.length) : "−"}</text>
                        <title>{collapsed ? "Ast ausklappen" : "Ast einklappen"}</title>
                      </g>
                    )}
                  </g>
                );
              })}
              {/* Auswahlrahmen (Shift + Fläche ziehen) */}
              {drag?.kind === "rahmen" && drag.moved && <rect className="np-ui" x={Math.min(drag.x0, drag.x1)} y={Math.min(drag.y0, drag.y1)} width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)}
                fill={ACCENT + "14"} stroke={ACCENT} strokeWidth={1 / view.k} strokeDasharray={`${4 / view.k} ${3 / view.k}`} pointerEvents="none" />}
              {/* Hilfslinien beim Einrasten */}
              {drag?.moved && drag.linien?.map((l, i) => (
                <line key={"rast" + i} className="np-ui" x1={l.achse === "x" ? l.wert : l.von - 12} x2={l.achse === "x" ? l.wert : l.bis + 12} y1={l.achse === "y" ? l.wert : l.von - 12} y2={l.achse === "y" ? l.wert : l.bis + 12}
                  stroke={ACCENT} strokeWidth={1 / view.k} strokeDasharray={`${4 / view.k} ${3 / view.k}`} pointerEvents="none" />
              ))}
              {/* Pins */}
              {Object.keys(pins).map((id) => {
                const p = posOf(id);
                if (!p) return null;
                const w = p.w || NODE_W, top = p.y - (p.h || NODE_H) / 2 - (p.kind === "card" ? TAB_H : 0);
                return (
                  <g key={"pin" + id} className="np-ui" transform={`translate(${p.x - w / 2 - 7},${top - 7})`} style={{ cursor: "pointer" }}
                    onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); togglePin(id); }}>
                    <circle cx="7" cy="7" r="8" fill="#1b2026" stroke={ACCENT} />
                    <Pin x={1.5} y={1.5} size={11} color={ACCENT} strokeWidth={2.2} />
                    <title>Angepinnt: bleibt beim automatischen Anordnen stehen. Klick = lösen</title>
                  </g>
                );
              })}
              {P.geraete.length === 0 && (
                <g className="np-ui">
                  <text x="0" y="-10" textAnchor="middle" fill={SUB} fontSize="16" fontWeight="600">Noch keine Geräte</text>
                  <text x="0" y="16" textAnchor="middle" fill={MUTED} fontSize="12">Einen Switch aus der Palette links hierher ziehen oder „+ Aus Katalog …“ wählen.</text>
                </g>
              )}
            </g>
          </svg>
          <div style={{ position: "absolute", left: 10, bottom: 8, fontSize: 11, color: MUTED, pointerEvents: "none" }}>
            {Math.round(view.k * 100)} % · Mausrad = Zoom · Shift+Rad = hoch/runter · {navigator.platform?.startsWith("Mac") ? "⌘" : "Strg"}+Rad = links/rechts · Fläche ziehen = verschieben · {tool === "connect" ? "von Gerät zu Gerät ziehen = verbinden" : tool === "stack" ? "Gerät auf Gerät ziehen = stapeln" : front ? "Switch ziehen = Gruppe verschieben · Port anklicken = Verbindung" : "Gerät ziehen = Ast verschieben"}{rasten && tool === "move" ? " · Alt = ohne Einrasten" : ""}{tool === "move" ? " · Shift+Klick oder Shift+Fläche ziehen = mehrere wählen" : ""} · P = anpinnen · Rechtsklick = Geräteinfos · Entf = löschen
          </div>
          <Legend P={P} colorBy={colorBy} front={front} />
          {warnung && <Modal title="Layout von Hand angepasst" width={460} onClose={() => setWarnung(null)}
            footer={<><button style={S.secondaryBtn} onClick={() => setWarnung(null)}>Abbrechen</button><button style={S.primaryBtn} onClick={() => { const w = warnung; setWarnung(null); w.ok(); }}>Trotzdem anordnen</button></>}>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{warnung.text}</div>
            <div style={{ ...S.hint, marginTop: 8 }}>Mit Rückgängig (Strg+Z) lässt sich das wieder zurückholen.</div>
          </Modal>}
          {tausch && <PortTauschen P={P} X={X} voll={tausch.voll} onClose={() => setTausch(null)} onOk={(w) => { const t = tausch; setTausch(null); connect(t.from, t.to, w); }} />}
          {bgOpen && <HintergrundPanel bg={bg} bounds={Lbase.bounds} onClose={() => setBgOpen(false)} onChange={(fn) => mutate((d) => { d.layout[bgKey] = fn(d.layout[bgKey] ? { ...d.layout[bgKey] } : null); })} />}
          {ctx && X.devById.get(ctx.id) && (() => {
            const d = X.devById.get(ctx.id);
            const hasKids = (T.children.get(d.id) || []).length > 0 && !T.roots.includes(d.id);
            return <DeviceContextMenu P={P} X={X} dev={d} x={ctx.x} y={ctx.y} status={status[d.id]} issues={devIssues.get(d.id) || []} onClose={closeCtx}
              onEdit={() => setSelection({ type: "dev", id: d.id })} onCheck={checkReach} onDelete={() => onDeleteDevice(d.id)}
              onSetRoot={d.isSwitch && P.layout.rootId !== d.id ? () => mutate((dd) => { dd.layout.rootId = d.id; }) : null}
              pinned={!!pins[stapelAnker(stapel, d.id)]} onPin={() => togglePin(d.id)}
              onUnstack={stapelVon(stapel, d.id) ? () => mutate((dd) => { dd.layout.stapel = entstapeln(dd.layout.stapel, d.id); }) : null}
              onEditStack={stapelVon(stapel, d.id) ? () => setSelection({ type: "stapel", id: stapelVon(stapel, d.id).id }) : null}
              collapsed={!!P.layout.collapsed?.[d.id]} onToggleCollapse={hasKids ? () => mutate((dd) => { dd.layout.collapsed = { ...dd.layout.collapsed, [d.id]: !dd.layout.collapsed?.[d.id] }; }) : null} />;
          })()}
        </div>
      </div>

      {/* Inspector */}
      {(selDev || selConn || selStapel || selIds.length > 1) && (
        <div style={{ width: 420, background: PANEL, borderLeft: `1px solid ${LINE}`, overflowY: "auto", padding: 14, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button style={{ ...S.ghostBtn, padding: "2px 8px" }} onClick={() => setSelection(null)} title="Schließen"><XIcon size={14} /></button>
          </div>
          {selDev && <DeviceEditor key={selDev.id} compact P={P} X={X} dev={selDev} mutate={mutate} status={status[selDev.id]} onCheck={checkReach}
            issues={devIssues.get(selDev.id) || []} onSelectDevice={(id) => setSelection({ type: "dev", id })} onDelete={onDeleteDevice} onShowProto={onShowProto} onSaveVorlage={onSaveVorlage} onSaveBestand={onSaveBestand} onUmbauen={onUmbauen} onTypWaehlen={onTypWaehlen} bestand={bestand} />}
          {selStapel && <StapelEditor P={P} stapelId={selStapel.id} pinned={!!pins[selStapel.ids[0]]} onPin={() => togglePin(selStapel.ids[0])} mutate={mutate} onSelectDevice={(id) => setSelection({ type: "dev", id })} onSelectStapel={(id) => setSelection({ type: "stapel", id })} onClose={() => setSelection(null)} />}
          {selIds.length > 1 && <MehrfachAuswahl P={P} X={X} ids={selIds} stapel={stapel} pins={pins} mutate={mutate} onPin={() => allePinnen(selIds)} onDelete={() => mehrereLoeschen(selIds)}
            onSelect={(ids) => waehle(ids)} />}
          {selConn && <ConnEditor P={P} X={X} conn={selConn} mutate={mutate} onDelete={onDeleteConn} issues={connIssues.get(selConn.id) || []} onSelectDevice={(id) => setSelection({ type: "dev", id })} />}
        </div>
      )}
      </div>
    </div>
  );
}

/* Seitenleiste bei Mehrfachauswahl: Liste der Geräte und Aktionen für alle */
function MehrfachAuswahl({ P, X, ids, stapel, pins, mutate, onPin, onDelete, onSelect }) {
  const konfigClip = useZwischenablage("konfig");
  const [konfig, setKonfig] = useState(false);
  const devs = ids.map((id) => X.devById.get(id)).filter(Boolean);
  const anker = [...new Set(ids.map((id) => stapelAnker(stapel, id)))];
  const allePins = anker.every((id) => pins[id]);
  const alsStapel = () => mutate((d) => {
    // von oben nach unten in der Reihenfolge der Auswahl; bisherige Stapel dieser Geräte lösen sich
    let st = d.layout.stapel || [];
    for (let i = ids.length - 2; i >= 0; i--) st = obenAufStapel(st, ids[i], ids[i + 1], uid());
    d.layout.stapel = st;
  });
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{devs.length} Geräte ausgewählt</div>
      <div style={{ ...S.hint, marginBottom: 10 }}>Ziehen an einem der Geräte verschiebt alle. Shift+Klick nimmt Geräte dazu oder heraus, Esc hebt die Auswahl auf.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={{ ...S.smallBtn, ...(allePins ? { borderColor: ACCENT, color: ACCENT } : {}) }} onClick={onPin} title="Taste P"><Pin size={12} />{allePins ? "Alle lösen" : "Alle anpinnen"}</button>
        <button style={S.smallBtn} onClick={alsStapel} title="Die gewählten Geräte in dieser Reihenfolge übereinander als Stapel (Rack, Tower)"><Layers size={12} />Als Stapel</button>
        {konfigClip && <button style={S.smallBtn} onClick={() => setKonfig(true)} title={`Kopierte Konfiguration von „${konfigClip.quelle.name}“ in alle gewählten Geräte einfügen`}><ClipboardPaste size={12} />Konfig einfügen</button>}
        <button style={{ ...S.dangerBtn, marginLeft: "auto" }} onClick={onDelete} title="Entf"><Trash2 size={12} />Alle löschen</button>
      </div>
      <div className="sp-section-label" style={{ marginTop: 16 }}>Auswahl</div>
      {devs.map((g) => (
        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", border: `1px solid ${LINE}`, borderLeft: `3px solid ${katColor(g.kategorie)}`, borderRadius: 6, marginBottom: 4, background: "#1f242b" }}>
          <IconView icon={g.icon} customIcons={P.icons} color={katColor(g.kategorie)} size={18} />
          <a style={{ flex: 1, minWidth: 0, cursor: "pointer", fontSize: 13 }} onClick={() => onSelect([g.id])} title="Nur dieses Gerät bearbeiten">
            {pins[stapelAnker(stapel, g.id)] && <Pin size={11} color={ACCENT} style={{ marginRight: 4, verticalAlign: -1 }} />}{g.name}<div style={{ fontSize: 11, color: MUTED }}>{[g.hersteller, g.modell].filter(Boolean).join(" ") || TYPEN[g.typ]?.label}</div>
          </a>
          <button style={{ ...S.smallBtn, padding: "1px 6px" }} onClick={() => onSelect(ids.filter((x) => x !== g.id))} title="Aus der Auswahl nehmen"><XIcon size={12} /></button>
        </div>
      ))}
      {konfig && konfigClip && <KonfigEinfuegen P={P} clip={konfigClip} ziele={ids} mutate={mutate} onClose={() => setKonfig(false)} />}
    </div>
  );
}

/* Eckige Verbindung (rechtwinklig mit kleinem Radius). dir "h": erst waagrecht,
   "v": erst senkrecht; mid legt die Knickstelle fest. */
const eckPfad = (x1, y1, x2, y2, dir, mid) => {
  const r = 6;
  if (dir === "h") {
    const mx = mid ?? (x1 + x2) / 2, sy = Math.sign(y2 - y1), sx1 = Math.sign(mx - x1) || 1, sx2 = Math.sign(x2 - mx) || 1;
    if (!sy) return `M${x1},${y1} L${x2},${y2}`;
    const rr = Math.min(r, Math.abs(y2 - y1) / 2, Math.abs(mx - x1), Math.abs(x2 - mx));
    return `M${x1},${y1} L${mx - sx1 * rr},${y1} Q${mx},${y1} ${mx},${y1 + sy * rr} L${mx},${y2 - sy * rr} Q${mx},${y2} ${mx + sx2 * rr},${y2} L${x2},${y2}`;
  }
  const my = mid ?? (y1 + y2) / 2, sx = Math.sign(x2 - x1), sy1 = Math.sign(my - y1) || 1, sy2 = Math.sign(y2 - my) || 1;
  if (!sx) return `M${x1},${y1} L${x2},${y2}`;
  const rr = Math.min(r, Math.abs(x2 - x1) / 2, Math.abs(my - y1), Math.abs(y2 - my));
  return `M${x1},${y1} L${x1},${my - sy1 * rr} Q${x1},${my} ${x1 + sx * rr},${my} L${x2 - sx * rr},${my} Q${x2},${my} ${x2},${my + sy2 * rr} L${x2},${y2}`;
};

/* Port-Plakette an einer Verbindung: sitzt am Geräte-Ende und zeigt, an welchem
   Switch-Port das Gerät steckt. Das VLAN steht nur im Tooltip, nicht am Kabel. */
const CW = 5.9; // geschätzte Zeichenbreite bei 10 px
function PortBadge({ c, g, fromEnd, toEnd, X, extra, reihe, ziel }) {
  const a = endInfo(c, fromEnd, X), b = endInfo(c, toEnd, X);
  if (!a || !b) return null;
  const sw = a.sw ? a : b.sw ? b : null;
  const ep = sw === a ? b : a;
  const seg = [];
  if (a.sw && b.sw) seg.push({ t: `${portLabel(a.port)} ⇄ ${portLabel(b.port)}`, fill: "#2a313a", stroke: "#56606c", col: "#fff", bold: true });
  else if (sw) seg.push({ t: portLabel(sw.port), poe: !!sw.port.poe, fill: "#2a313a", stroke: "#56606c", col: "#fff", bold: true });
  else seg.push({ t: `${portLabel(a.port)} ⇄ ${portLabel(b.port)}`, fill: "#2a313a", stroke: "#56606c", col: "#fff", bold: true });
  const info = sw && sw.managed ? sw : a.vlans.length ? a : b;
  if (sw && !ep.sw && ep.dev.ports.length > 1 && !/^\d+$/.test(ep.port.name)) seg.push({ t: ep.port.name, fill: "transparent", stroke: "transparent", col: SUB });
  const widths = seg.map((s) => Math.round(s.t.length * CW + 10 + (s.poe ? 9 : 0)));
  const total = widths.reduce((x, y) => x + y, 0);
  const vertical = Math.abs(g.x2 - g.x1) < 2 || Math.abs(g.x2 - g.x1) < Math.abs(g.y2 - g.y1) * 0.25 && Math.abs(g.x2 - g.x1) < 40;
  const dir = g.x2 >= g.x1 ? 1 : -1;
  let x0, y0;
  if (vertical) { const dy = g.y2 >= g.y1 ? 1 : -1; x0 = g.x2 + 6; y0 = g.y2 - dy * 20 - 7; }
  else { x0 = dir > 0 ? g.x2 - 8 - total : g.x2 + 8; y0 = extra ? g.y2 + 5 : g.y2 - 18; } // Querverbindungen unter die Linie, damit sie die Baumkante nicht verdecken
  if (reihe && ziel) { // mehrere Kabel an diesem Gerät: Plaketten untereinander neben dem Gerät
    if (vertical) y0 = g.y2 - (g.y2 >= g.y1 ? 1 : -1) * (20 + reihe.i * 16) - 7;
    else y0 = ziel.y - (reihe.n * 16) / 2 + reihe.i * 16 + 1;
  }
  const tip = [
    sw ? `${sw.dev.name} · Port ${sw.port.name} (${sw.port.typ}${sw.port.poe ? ", PoE" : ""})` : `${a.dev.name} · ${a.port.name}`,
    `→ ${ep.dev.name} · ${ep.port.name}${ep.ifc?.ip ? ` (${ep.ifc.ip})` : ""}`,
    vlanLang(info),
  ].join("\n");
  let cx = x0;
  return (
    <g className="np-portbadge" transform={`translate(${cx},${y0})`}>
      <title>{tip}</title>
      {seg.map((s, n) => {
        const x = widths.slice(0, n).reduce((p, q) => p + q, 0);
        const first = n === 0, last = n === seg.length - 1;
        return (
          <g key={n} transform={`translate(${x},0)`}>
            <rect width={widths[n]} height="14" rx={first || last ? 4 : 0} fill={s.fill === "transparent" ? "#12161acc" : s.fill} stroke={s.stroke} strokeWidth=".8" />
            <text x={(widths[n] - (s.poe ? 9 : 0)) / 2} y="10.3" fontSize="10" fill={s.col} fontWeight={s.bold ? 700 : 500} textAnchor="middle" fontFamily="'Segoe UI',system-ui,sans-serif">{s.t}</text>
            {s.poe && <Zap x={widths[n] - 13} y={2.5} size={9} color="#ffe066" fill="#ffe066" strokeWidth={1.5} />}
          </g>
        );
      })}
    </g>
  );
}

function Legend({ P, colorBy, front }) {
  const items = colorBy === "vlan" || front
    ? [...P.vlans].sort((a, b) => a.vid - b.vid).map((v) => [v.farbe, `${v.vid} ${v.name}`]).concat([["#d8dde3", "Trunk"], ["#ff8c42", "Punkt-zu-Punkt"]])
    : colorBy === "kabel" ? Object.entries(KABEL).map(([k, v]) => [KABEL_FARBEN[k], v.label])
    : Object.keys(KATEGORIEN).map((k) => [katColor(k), k]);
  return (
    <div className="np-legend" style={{ position: "absolute", right: 10, bottom: 10, background: "#1b2026e6", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#c8d0d8", maxHeight: "45%", overflowY: "auto", pointerEvents: "none", opacity: .92 }}>
      {items.map(([c, l]) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0" }}><span style={{ width: 16, height: 3, background: c, borderRadius: 2 }} />{l}</div>)}
    </div>
  );
}
