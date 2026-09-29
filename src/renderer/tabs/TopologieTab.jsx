import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, OK, PANEL, DARK, KABEL, KATEGORIEN, TYPEN, katColor } from "../../shared/constants.js";
import { buildTree, subtreeIds, connVlan, isP2PConn, mainIp, webUrl, addConnection } from "../../shared/model.js";
import { layoutMindmap, NODE_W, NODE_H } from "../../shared/layout.js";
import { SvgIcon, IconView } from "../icons.jsx";
import { Toggle, VlanSelect, Dot } from "../ui.jsx";
import DeviceEditor from "../DeviceEditor.jsx";
import ConnEditor from "../ConnEditor.jsx";
import { api } from "../api.js";

const KABEL_FARBEN = { cat5e: "#8fa3b8", cat6: "#4ea1ff", ethercon: "#39d0c8", fiber_sm: "#f5d023", fiber_mm: "#ff8c42", opticalcon: "#ffb347", dac: "#b37dff", wlan: "#9aa4af", p2p: "#e74c3c" };
const HW = NODE_W / 2, HH = NODE_H / 2;

export default function TopologieTab(props) {
  const { P, X, mutate, issues, status, checkReach, selection, setSelection, onAddDevice, onDeleteDevice, onDeleteConn, onShowProto, onSaveVorlage, svgRef, autoStatus, setAutoStatus } = props;
  const [tool, setTool] = useState("move");
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null);   // { kind:'node'|'pan', id, sx, sy, dx, dy, moved }
  const [draw, setDraw] = useState(null);   // { from, x, y }
  const [hover, setHover] = useState(null);
  const [colorBy, setColorBy] = useState("vlan");
  const [katFilter, setKatFilter] = useState("");
  const [vlanFilter, setVlanFilter] = useState(null);
  const [q, setQ] = useState("");
  const [showPorts, setShowPorts] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const wrapRef = useRef(null);
  const fitted = useRef(false);

  const T = useMemo(() => buildTree(P, X), [P, X]);
  const L = useMemo(() => layoutMindmap(P, T), [P, T]);

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

  // Live-Position während des Ziehens (Ast zieht mit)
  const moving = useMemo(() => {
    if (!drag || drag.kind !== "node" || !drag.moved) return null;
    const ids = L.pos.get(drag.id)?.lose ? [drag.id] : subtreeIds(T, drag.id);
    return new Set(ids);
  }, [drag, T, L]);
  const posOf = (id) => {
    const p = L.pos.get(id);
    if (!p) return null;
    if (moving && moving.has(id)) return { ...p, x: p.x + drag.dx, y: p.y + drag.dy };
    return p;
  };

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
    for (const [id, p] of L.pos) if (Math.abs(w.x - p.x) <= HW && Math.abs(w.y - p.y) <= HH) return id;
    return null;
  };

  const onWheel = (e) => {
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

  const onDown = (e, nodeId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (nodeId && tool === "connect") { const w = toWorld(e); setDraw({ from: nodeId, x: w.x, y: w.y }); return; }
    if (nodeId) setDrag({ kind: "node", id: nodeId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false });
    else setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false });
  };
  const onMove = (e) => {
    if (draw) { const w = toWorld(e); setDraw({ ...draw, x: w.x, y: w.y }); setHover(hitNode(w)); return; }
    if (!drag) return;
    const ddx = e.clientX - drag.sx, ddy = e.clientY - drag.sy;
    const moved = drag.moved || Math.abs(ddx) + Math.abs(ddy) > 4;
    if (drag.kind === "pan") setView((v) => ({ ...v, x: drag.vx + ddx, y: drag.vy + ddy })), moved !== drag.moved && setDrag({ ...drag, moved });
    else setDrag({ ...drag, dx: ddx / view.k, dy: ddy / view.k, moved });
  };
  const onUp = (e) => {
    if (draw) {
      const target = hitNode(toWorld(e));
      if (target && target !== draw.from) connect(draw.from, target);
      setDraw(null); setHover(null);
      return;
    }
    if (!drag) return;
    if (drag.kind === "node") {
      if (drag.moved) {
        const id = drag.id, dx = drag.dx, dy = drag.dy;
        mutate((d) => {
          const o = d.layout.offsets[id] || { dx: 0, dy: 0 };
          d.layout.offsets[id] = { dx: Math.round(o.dx + dx), dy: Math.round(o.dy + dy) };
        });
      } else setSelection({ type: "dev", id: drag.id });
    } else if (!drag.moved) setSelection(null);
    setDrag(null);
  };

  const connect = (fromId, toId) => {
    let newId = null;
    mutate((d) => { newId = addConnection(d, fromId, toId); });
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
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        if (selection.type === "dev") onDeleteDevice(selection.id); else onDeleteConn(selection.id);
      }
      if (e.key === "Escape") { setSelection(null); setDraw(null); }
      if (e.key === "v") setTool("move");
      if (e.key === "c") setTool("connect");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selection, onDeleteDevice, onDeleteConn, setSelection]);

  /* ── Filter & Suche ─────────────────────────────────────────────────── */
  const ql = q.trim().toLowerCase();
  const matches = (d) => {
    if (katFilter && d.kategorie !== katFilter) return false;
    if (vlanFilter) {
      const inV = d.interfaces.some((i) => i.vlan === vlanFilter) || d.ports.some((p) => p.vlan === vlanFilter || (p.modus === "trunk" && (p.vlans || []).includes(vlanFilter)));
      if (!inV) return false;
    }
    if (ql) return `${d.name} ${d.modell} ${d.hersteller} ${d.bereich} ${d.interfaces.map((i) => i.ip).join(" ")}`.toLowerCase().includes(ql);
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

  const edgePath = (pa, pb) => {
    const dir = pb.x >= pa.x ? 1 : -1;
    if (Math.abs(pb.x - pa.x) < NODE_W) {
      const dy = pb.y >= pa.y ? 1 : -1;
      const x1 = pa.x, y1 = pa.y + dy * HH, x2 = pb.x, y2 = pb.y - dy * HH;
      const my = (y1 + y2) / 2;
      return { d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, x1, y1, x2, y2 };
    }
    const x1 = pa.x + dir * HW, y1 = pa.y, x2 = pb.x - dir * HW, y2 = pb.y;
    const mx = (x1 + x2) / 2;
    return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, x1, y1, x2, y2 };
  };

  const selDev = selection?.type === "dev" ? X.devById.get(selection.id) : null;
  const selConn = selection?.type === "conn" ? P.verbindungen.find((c) => c.id === selection.id) : null;

  const allConns = P.verbindungen.filter((c) => posOf(c.a.dev) && posOf(c.b.dev));
  const treeChildByConn = new Map([...T.treeConn].map(([child, c]) => [c.id, child]));
  const treeConnIds = new Set(treeChildByConn.keys());

  const H = "calc(100vh - 96px)";

  return (
    <div style={{ display: "flex", height: H, minHeight: 500 }}>
      {/* Palette */}
      <div style={{ width: paletteOpen ? 176 : 34, background: DARK, borderRight: `1px solid ${LINE}`, overflowY: "auto", flexShrink: 0, transition: "width .15s" }}>
        <button style={{ ...S.ghostBtn, border: "none", width: "100%", justifyContent: paletteOpen ? "space-between" : "center", borderRadius: 0, borderBottom: `1px solid ${LINE}` }} onClick={() => setPaletteOpen((o) => !o)} title="Palette ein-/ausklappen">
          {paletteOpen && <span className="sp-section-label" style={{ margin: 0 }}>Geräte</span>}{paletteOpen ? "‹" : "›"}
        </button>
        {paletteOpen && <>
          <div style={{ padding: 8 }}>
            <button style={{ ...S.primaryBtn, width: "100%", padding: "7px 8px", fontSize: 12 }} onClick={() => onAddDevice(null, { connectTo: selDev?.id, picker: true })}>+ Aus Katalog …</button>
            <div style={{ ...S.hint, marginTop: 6 }}>Typ auf ein Gerät ziehen = anschließen. Auf leere Fläche = frei platzieren.</div>
          </div>
          {Object.entries(TYPEN).map(([k, t]) => (
            <div key={k} draggable onDragStart={(e) => e.dataTransfer.setData("application/x-netplan", JSON.stringify({ kind: "typ", key: k }))}
              onDoubleClick={() => { const id = onAddDevice({ kind: "typ", key: k }, { connectTo: selDev?.id }); if (id) setSelection({ type: "dev", id }); }}
              title="Ziehen oder Doppelklick" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", cursor: "grab", fontSize: 12, color: "#c8d0d8", borderBottom: "1px solid #232a33" }}>
              <IconView icon={t.icon} color={katColor(t.kat)} size={18} />{t.label}
            </div>
          ))}
        </>}
      </div>

      {/* Zeichenfläche */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "7px 10px", background: PANEL, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }}>
            {[["move", "✥ Bewegen", "V"], ["connect", "🔗 Verbinden", "C"]].map(([k, l, key]) => (
              <button key={k} title={`Taste ${key}`} onClick={() => setTool(k)} style={{ ...S.ghostBtn, border: "none", borderRadius: 0, ...(tool === k ? { background: ACCENT, color: DARK } : {}) }}>{l}</button>
            ))}
          </div>
          <button style={S.ghostBtn} onClick={fit} title="Alles einpassen">⤢ Einpassen</button>
          <button style={S.ghostBtn} onClick={() => mutate((d) => { d.layout.offsets = {}; d.layout.pinned = {}; })} title="Manuelle Verschiebungen zurücksetzen">↺ Auto-Layout</button>
          <button style={S.ghostBtn} onClick={() => mutate((d) => { const any = Object.values(d.layout.collapsed || {}).some(Boolean); d.layout.collapsed = any ? {} : Object.fromEntries([...T.children].filter(([id, ch]) => ch.length && !T.roots.includes(id)).map(([id]) => [id, true])); })}>⊟ Äste</button>
          <span style={{ width: 1, height: 22, background: LINE }} />
          <select style={{ ...S.selectSm, width: "auto" }} value={colorBy} onChange={(e) => setColorBy(e.target.value)} title="Farbe der Verbindungen">
            <option value="vlan">Farbe: VLAN</option><option value="kat">Farbe: Bereich</option><option value="kabel">Farbe: Kabel</option>
          </select>
          <select style={{ ...S.selectSm, width: "auto" }} value={katFilter} onChange={(e) => setKatFilter(e.target.value)}>
            <option value="">Alle Bereiche</option>{Object.keys(KATEGORIEN).map((k) => <option key={k}>{k}</option>)}
          </select>
          <VlanSelect vlans={P.vlans} value={vlanFilter} onChange={setVlanFilter} style={{ width: "auto" }} noneLabel="Alle VLANs" />
          <input style={{ ...S.inputSm, width: 150 }} placeholder="🔍 Suchen (Name, IP)" value={q} onChange={(e) => setQ(e.target.value)} />
          <Toggle checked={showPorts} onChange={setShowPorts} label="Ports" />
          <span style={{ flex: 1 }} />
          <button style={S.ghostBtn} onClick={() => checkReach()} title="Alle Geräte mit IP anpingen bzw. Web-UI-Port prüfen">⟳ Status</button>
          <Toggle checked={autoStatus} onChange={setAutoStatus} label="alle 15 s" title="Erreichbarkeit zyklisch prüfen" />
        </div>

        <div ref={wrapRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#12161a", cursor: tool === "connect" ? "crosshair" : drag?.kind === "pan" ? "grabbing" : "default" }}
          onMouseDown={(e) => onDown(e, null)} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { setDrag(null); setDraw(null); }}
          onWheel={onWheel} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <svg ref={svgRef} width="100%" height="100%" style={{ display: "block", userSelect: "none" }} xmlns="http://www.w3.org/2000/svg" fontFamily="'Segoe UI',system-ui,sans-serif">
            <defs>
              <pattern id="np-grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                <circle cx="1" cy="1" r="1" fill="#252b33" />
              </pattern>
              <filter id="np-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <rect className="np-ui" width="100%" height="100%" fill="url(#np-grid)" />
            <g id="np-world" transform={`translate(${view.x},${view.y}) scale(${view.k})`} data-bounds={JSON.stringify(L.bounds)}>
              {/* Verbindungen */}
              {allConns.map((c) => {
                const pa = posOf(c.a.dev), pb = posOf(c.b.dev);
                const tree = treeConnIds.has(c.id);
                // Baumkanten vom Elternknoten aus zeichnen
                let from = pa, to = pb, fromEnd = c.a, toEnd = c.b;
                const childOf = treeChildByConn.get(c.id);
                if (tree && childOf === c.a.dev) { from = pb; to = pa; fromEnd = c.b; toEnd = c.a; }
                const g = edgePath(from, to);
                const st = edgeStyle(c);
                const sel = selConn?.id === c.id;
                const da = X.devById.get(c.a.dev), db = X.devById.get(c.b.dev);
                const dim = filtering && !(matches(da) && matches(db));
                const pName = (end) => X.portRef.get(`${end.dev}:${end.port}`)?.port.name || "?";
                return (
                  <g key={c.id} opacity={dim ? 0.12 : 1} style={{ cursor: "pointer" }}
                    onMouseDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); setSelection({ type: "conn", id: c.id }); }}>
                    <path d={g.d} stroke="transparent" strokeWidth="14" fill="none" />
                    {(sel || st.errs) && <path d={g.d} stroke={sel ? ACCENT : ERR} strokeWidth={st.width + 6} fill="none" opacity=".35" filter="url(#np-glow)" />}
                    <path d={g.d} stroke={st.color} strokeWidth={st.width} fill="none" strokeDasharray={tree ? st.dash : st.dash || "6 5"} opacity={tree ? 1 : 0.85} />
                    {showPorts && <>
                      <text x={g.x1 + (g.x2 > g.x1 ? 6 : g.x2 < g.x1 ? -6 : 4)} y={g.y1 - 5} fontSize="10" fill={SUB} textAnchor={g.x2 >= g.x1 ? "start" : "end"}>{pName(fromEnd)}</text>
                      <text x={g.x2 + (g.x2 > g.x1 ? -6 : g.x2 < g.x1 ? 6 : 4)} y={g.y2 - 5} fontSize="10" fill={SUB} textAnchor={g.x2 >= g.x1 ? "end" : "start"}>{pName(toEnd)}</text>
                      {c.label && <text x={(g.x1 + g.x2) / 2} y={(g.y1 + g.y2) / 2 - 6} fontSize="10" fill="#c8d0d8" textAnchor="middle">{c.label}</text>}
                    </>}
                  </g>
                );
              })}
              {draw && posOf(draw.from) && (
                <line x1={posOf(draw.from).x} y1={posOf(draw.from).y} x2={draw.x} y2={draw.y} stroke={ACCENT} strokeWidth="2" strokeDasharray="6 4" />
              )}

              {/* Geräte */}
              {[...L.pos.keys()].map((id) => {
                const d = X.devById.get(id);
                if (!d) return null;
                const p = posOf(id);
                const col = katColor(d.kategorie);
                const sel = selDev?.id === id;
                const st = status[id];
                const iss = devIssues.get(id) || [];
                const worst = iss.some((i) => i.sev === "error") ? ERR : iss.some((i) => i.sev === "warn") ? WARN : null;
                const dim = filtering && !matches(d);
                const hit = ql && matches(d);
                const ip = mainIp(d);
                const v = X.vlanById.get(d.interfaces.find((i) => i.ip)?.vlan || d.interfaces[0]?.vlan);
                const url = webUrl(d);
                const kids = T.children.get(id) || [];
                const collapsed = !!P.layout.collapsed?.[id];
                const isRoot = T.roots[0] === id;
                const side = p.side || (p.x >= 0 ? 1 : -1);
                return (
                  <g key={id} transform={`translate(${p.x - HW},${p.y - HH})`} opacity={dim ? 0.2 : 1}
                    onMouseDown={(e) => onDown(e, id)} style={{ cursor: tool === "connect" ? "crosshair" : "pointer" }}>
                    {(sel || hover === id || hit) && <rect x="-4" y="-4" width={NODE_W + 8} height={NODE_H + 8} rx="11" fill="none" stroke={sel ? ACCENT : hover === id ? OK : "#fff"} strokeWidth="2" opacity=".9" />}
                    <rect width={NODE_W} height={NODE_H} rx="8" fill={isRoot ? "#262d36" : "#1f242b"} stroke={isRoot ? ACCENT : worst || LINE} strokeWidth={isRoot || worst ? 1.6 : 1} />
                    <rect width="5" height={NODE_H} rx="2" fill={col} />
                    <rect x="12" y="11" width="36" height="36" rx="7" fill={col + "1f"} />
                    <SvgIcon icon={d.icon} customIcons={P.icons} x={18} y={17} size={24} color={col} />
                    <text x="56" y="20" fontSize="13" fontWeight="700" fill="#fff">{d.name.length > 20 ? d.name.slice(0, 19) + "…" : d.name}<title>{d.name}</title></text>
                    <text x="56" y="36" fontSize="11" fill={ip ? "#c8d0d8" : MUTED} fontFamily="Consolas,monospace">{ip || (d.interfaces.some((i) => i.dhcp) ? "DHCP" : d.isSwitch && !d.interfaces.length ? "unmanaged" : "keine IP")}</text>
                    {v && <g transform={`translate(${56 + Math.max(ip.length, 7) * 6.6 + 6},27)`}><rect width={v.vid > 99 ? 30 : 24} height="12" rx="3" fill={v.farbe + "33"} stroke={v.farbe} strokeWidth=".8" /><text x={v.vid > 99 ? 15 : 12} y="9.5" fontSize="9" fill="#fff" textAnchor="middle">{v.vid}</text></g>}
                    <text x="56" y="50" fontSize="10" fill={MUTED}>{[d.bereich, d.modell || TYPEN[d.typ]?.label].filter(Boolean).join(" · ").slice(0, url ? 26 : 30)}</text>
                    <circle cx={NODE_W - 11} cy="11" r="4.5" fill={!st || st.ok === null || st.ok === undefined ? "#4a535e" : st.ok ? OK : ERR} stroke="#12161a" strokeWidth="1.5">
                      <title>{!st ? "Status unbekannt" : st.ok ? `erreichbar (${st.method}, ${st.ms} ms)` : st.ok === false ? `nicht erreichbar (${st.method})` : st.method}</title>
                    </circle>
                    {worst && <text x={NODE_W - 26} y="15" fontSize="11" fill={worst} textAnchor="middle">⚠<title>{iss.map((i) => i.msg).join("\n")}</title></text>}
                    {url && (
                      <g className="np-ui" transform={`translate(${NODE_W - 22},${NODE_H - 22})`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); api.openExternal(url); }} style={{ cursor: "pointer" }}>
                        <rect width="16" height="16" rx="4" fill="#2c343e" stroke={LINE} />
                        <text x="8" y="12" fontSize="10" textAnchor="middle">🌐</text>
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
              {P.geraete.length === 0 && (
                <g className="np-ui">
                  <text x="0" y="-10" textAnchor="middle" fill={SUB} fontSize="16" fontWeight="600">Noch keine Geräte</text>
                  <text x="0" y="16" textAnchor="middle" fill={MUTED} fontSize="12">Einen Switch aus der Palette links hierher ziehen oder „+ Aus Katalog …“ wählen.</text>
                </g>
              )}
            </g>
          </svg>
          <div style={{ position: "absolute", left: 10, bottom: 8, fontSize: 11, color: MUTED, pointerEvents: "none" }}>
            {Math.round(view.k * 100)} % · Mausrad = Zoom · Fläche ziehen = verschieben · {tool === "connect" ? "von Gerät zu Gerät ziehen = verbinden" : "Gerät ziehen = Ast verschieben"} · Entf = löschen
          </div>
          <Legend P={P} colorBy={colorBy} />
        </div>
      </div>

      {/* Inspector */}
      {(selDev || selConn) && (
        <div style={{ width: 420, background: PANEL, borderLeft: `1px solid ${LINE}`, overflowY: "auto", padding: 14, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button style={{ ...S.ghostBtn, padding: "2px 8px" }} onClick={() => setSelection(null)}>✕</button>
          </div>
          {selDev && <DeviceEditor key={selDev.id} compact P={P} X={X} dev={selDev} mutate={mutate} status={status[selDev.id]} onCheck={checkReach}
            issues={devIssues.get(selDev.id) || []} onSelectDevice={(id) => setSelection({ type: "dev", id })} onDelete={onDeleteDevice} onShowProto={onShowProto} onSaveVorlage={onSaveVorlage} />}
          {selConn && <ConnEditor P={P} X={X} conn={selConn} mutate={mutate} onDelete={onDeleteConn} issues={connIssues.get(selConn.id) || []} onSelectDevice={(id) => setSelection({ type: "dev", id })} />}
        </div>
      )}
    </div>
  );
}

function Legend({ P, colorBy }) {
  const items = colorBy === "vlan"
    ? [...P.vlans].sort((a, b) => a.vid - b.vid).map((v) => [v.farbe, `${v.vid} ${v.name}`]).concat([["#d8dde3", "Trunk"], ["#ff8c42", "Punkt-zu-Punkt"]])
    : colorBy === "kabel" ? Object.entries(KABEL).map(([k, v]) => [KABEL_FARBEN[k], v.label])
    : Object.keys(KATEGORIEN).map((k) => [katColor(k), k]);
  return (
    <div className="np-legend" style={{ position: "absolute", right: 10, bottom: 10, background: "#1b2026e6", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#c8d0d8", maxHeight: "45%", overflowY: "auto", pointerEvents: "none", opacity: .92 }}>
      {items.map(([c, l]) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0" }}><span style={{ width: 16, height: 3, background: c, borderRadius: 2 }} />{l}</div>)}
    </div>
  );
}
