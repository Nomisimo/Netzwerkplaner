import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, LS_KEY } from "../shared/constants.js";
import { emptyProject, migrateProject, buildIndex, validate, clone, addConnection, webUrl } from "../shared/model.js";
import { createDevice, uid, snapshotDevice } from "../shared/catalog.js";
import { demoProject } from "../shared/demo.js";
import { api, isElectron } from "./api.js";
import { DevicePicker, Modal } from "./ui.jsx";
import { topologySvg, svgToPngBase64, buildXlsxBase64, buildIpCsv, buildPdfHtml, fileBase } from "./exports.js";
import { ProtokollDetail } from "./tabs/BibliothekTab.jsx";
import { PROTOKOLLE } from "../shared/catalog.js";
import ProjektTab from "./tabs/ProjektTab.jsx";
import TopologieTab from "./tabs/TopologieTab.jsx";
import GeraeteTab from "./tabs/GeraeteTab.jsx";
import VlanTab from "./tabs/VlanTab.jsx";
import PatchTab from "./tabs/PatchTab.jsx";
import PruefungTab from "./tabs/PruefungTab.jsx";
import BibliothekTab from "./tabs/BibliothekTab.jsx";
import AnleitungTab from "./tabs/AnleitungTab.jsx";

const CHANGELOG = {
  "0.1.0": [
    "Erste Version: Topologie als Mindmap mit Drag & Drop, Verbinden-Werkzeug, Ein-/Ausklappen und Auto-Layout",
    "Geräte aus dem Hardwarekatalog (Ports, Protokolle, Web-UI vorbelegt) und generische Typen mit eigenen Icons",
    "VLANs, IP-Plan mit Konfliktprüfung und Vorschlag der nächsten freien Adresse",
    "Patchliste, Switch-Port-Konfiguration (Access/Trunk, PoE), Prüfung nach den Regeln der Protokollrecherche",
    "Web-UI-Links und Erreichbarkeit per TCP/Ping, Exporte als PDF, Excel, CSV, SVG und PNG",
  ],
};

const TABS = [["projekt", "Projekt"], ["topologie", "Topologie"], ["geraete", "Geräte"], ["vlans", "VLANs & IP-Plan"], ["patch", "Patchliste"], ["pruefung", "Prüfung"], ["bibliothek", "Bibliothek"], ["hilfe", "Anleitung"]];

const loadAutosave = () => {
  try { const s = localStorage.getItem(LS_KEY); if (s) return migrateProject(JSON.parse(s)); } catch (e) { console.error(e); }
  return emptyProject();
};

export default function App() {
  const [P, setP] = useState(loadAutosave);
  const Pref = useRef(P);
  const hist = useRef({ undo: [], redo: [] });
  const [tab, setTab] = useState(() => localStorage.getItem("netzwerkplaner_tab") || "projekt");
  const [selection, setSelection] = useState(null);
  const [picker, setPicker] = useState(null); // { connectTo }
  const [status, setStatus] = useState({});
  const [autoStatus, setAutoStatus] = useState(false);
  const [library, setLibrary] = useState({ vorlagen: [], bestand: [], icons: [] });
  const [libLoaded, setLibLoaded] = useState(false);
  const [filePath, setFilePath] = useState(() => localStorage.getItem("netzwerkplaner_file") || null);
  const [recents, setRecents] = useState([]);
  const [showRecents, setShowRecents] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [protoModal, setProtoModal] = useState(null);
  const [protoId, setProtoId] = useState(null);
  const [bibSub, setBibSub] = useState("bestand");
  const [changelog, setChangelog] = useState(false);
  const [toast, setToast] = useState(null);
  const [version, setVersion] = useState("");
  const svgRef = useRef(null);

  const notify = (msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200); };

  /* ── Zustand ändern (synchron, mit Undo) ─────────────────────────────── */
  const mutate = useCallback((fn) => {
    const next = clone(Pref.current);
    fn(next);
    hist.current.undo.push(Pref.current);
    if (hist.current.undo.length > 80) hist.current.undo.shift();
    hist.current.redo = [];
    Pref.current = next;
    setP(next);
  }, []);
  const replaceProject = useCallback((next, keepHistory) => {
    if (!keepHistory) hist.current = { undo: [], redo: [] };
    Pref.current = next; setP(next); setSelection(null); setStatus({});
  }, []);
  const undo = () => { const h = hist.current; if (!h.undo.length) return; h.redo.push(Pref.current); const p = h.undo.pop(); Pref.current = p; setP(p); };
  const redo = () => { const h = hist.current; if (!h.redo.length) return; h.undo.push(Pref.current); const p = h.redo.pop(); Pref.current = p; setP(p); };

  useEffect(() => {
    const k = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (mod && e.key.toLowerCase() === "y" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); redo(); }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(false); }
      if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); openProject(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // Autospeichern
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(P)); } catch (e) { console.error(e); } }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [P]);
  useEffect(() => { localStorage.setItem("netzwerkplaner_tab", tab); }, [tab]);
  useEffect(() => { filePath ? localStorage.setItem("netzwerkplaner_file", filePath) : localStorage.removeItem("netzwerkplaner_file"); }, [filePath]);

  // Bibliothek (eigene Vorlagen + Icons) aus dem App-Datenordner
  useEffect(() => {
    api.loadLibrary().then((l) => { if (l) setLibrary({ vorlagen: [], bestand: [], icons: [], ...l }); setLibLoaded(true); });
    api.getRecents().then(setRecents);
    api.appVersion().then(setVersion);
    api.onOpenFile((r) => r && loadFromFile(r));
  }, []);
  useEffect(() => { if (libLoaded) api.saveLibrary(library); }, [library, libLoaded]);

  // Eigene Icons aus der Bibliothek ins Projekt übernehmen, sobald sie benutzt werden
  const allIcons = useMemo(() => {
    const m = new Map(P.icons.map((i) => [i.id, i]));
    for (const i of library.icons || []) if (!m.has(i.id)) m.set(i.id, i);
    return [...m.values()];
  }, [P.icons, library.icons]);
  useEffect(() => {
    const need = new Set(P.geraete.map((d) => d.icon).filter((i) => i?.startsWith("custom:")).map((i) => i.slice(7)));
    const missing = (library.icons || []).filter((i) => need.has(i.id) && !P.icons.some((x) => x.id === i.id));
    if (missing.length) mutate((d) => d.icons.push(...missing));
  }, [P.geraete, library.icons]);
  // Icons aus geöffneten Projekten in die Bibliothek übernehmen
  useEffect(() => {
    if (!libLoaded) return;
    const add = P.icons.filter((i) => !(library.icons || []).some((x) => x.id === i.id));
    if (add.length) setLibrary((l) => ({ ...l, icons: [...(l.icons || []), ...add] }));
  }, [P.icons, libLoaded]);

  const X = useMemo(() => buildIndex(P), [P]);
  const issues = useMemo(() => validate(P, X), [P, X]);
  const Pv = useMemo(() => ({ ...P, icons: allIcons }), [P, allIcons]);

  /* ── Erreichbarkeit ─────────────────────────────────────────────────── */
  const checkReach = useCallback(async (ids) => {
    const P0 = Pref.current;
    const targets = [];
    for (const d of P0.geraete) {
      if (ids && !ids.includes(d.id)) continue;
      const url = webUrl(d);
      const ifc = d.interfaces.find((i) => i.id === d.webUi?.iface && i.ip) || d.interfaces.find((i) => i.ip);
      if (!ifc) continue;
      let port = null;
      if (url) { try { const u = new URL(url); port = +(u.port || (u.protocol === "https:" ? 443 : 80)); } catch {} }
      targets.push({ id: d.id, ip: ifc.ip, port });
    }
    if (!targets.length) { notify("Keine Geräte mit IP-Adresse zum Prüfen.", "warn"); return; }
    const res = await api.checkReachability(targets);
    setStatus((s) => ({ ...s, ...res }));
    if (!isElectron && !ids) notify("Die Erreichbarkeitsprüfung funktioniert nur in der Desktop-App.", "warn");
  }, []);
  useEffect(() => {
    if (!autoStatus) return;
    checkReach();
    const t = setInterval(() => checkReach(), 15000);
    return () => clearInterval(t);
  }, [autoStatus, checkReach]);

  /* ── Geräte & Verbindungen ──────────────────────────────────────────── */
  const addDevice = useCallback((item, { connectTo, at, picker: usePicker } = {}) => {
    if (!item || usePicker) { setPicker({ connectTo }); return null; }
    const vorlage = item.kind === "vorlage" ? (library.vorlagen || []).find((v) => v.id === item.key)
      : item.kind === "bestand" ? (library.bestand || []).find((v) => v.id === item.key) : null;
    let id = null, konflikte = [];
    mutate((d) => {
      const dev = createDevice({ katalogId: item.kind === "katalog" ? item.key : null, typ: item.kind === "typ" ? item.key : null, vlans: d.vlans, eigeneVorlage: vorlage, mitAdressen: item.kind === "bestand" });
      if (item.kind === "bestand") {
        dev.bestandId = vorlage.id;
        const belegt = new Set(d.geraete.flatMap((g) => g.interfaces.map((i) => i.ip)).filter(Boolean));
        konflikte = dev.interfaces.filter((i) => i.ip && belegt.has(i.ip)).map((i) => i.ip);
      }
      // eindeutiger Name
      const names = new Set(d.geraete.map((g) => g.name));
      if (names.has(dev.name)) { let n = 2; while (names.has(`${dev.name} ${n}`)) n++; dev.name = `${dev.name} ${n}`; }
      // Ist ein Endgerät ausgewählt, an dessen Switch anschließen
      let parent = connectTo && d.geraete.find((g) => g.id === connectTo);
      if (parent && !parent.isSwitch) {
        const c = d.verbindungen.find((c) => (c.a.dev === parent.id || c.b.dev === parent.id) && d.geraete.find((g) => g.id === (c.a.dev === parent.id ? c.b.dev : c.a.dev))?.isSwitch);
        parent = c ? d.geraete.find((g) => g.id === (c.a.dev === parent.id ? c.b.dev : c.a.dev)) : null;
      }
      if (parent) dev.bereich = parent.bereich;
      d.geraete.push(dev);
      id = dev.id;
      if (parent) addConnection(d, parent.id, dev.id);
      else if (at) d.layout.pinned = { ...(d.layout.pinned || {}), [dev.id]: at };
    });
    if (konflikte.length) notify(`Gerät eingefügt. IP bereits belegt: ${konflikte.join(", ")} – siehe Prüfung.`, "err");
    else notify(item.kind === "bestand" ? "Gerät aus dem Bestand eingefügt (mit IPs)." : "Gerät hinzugefügt.");
    return id;
  }, [library, mutate]);

  const deleteDevice = useCallback((id) => {
    const d = Pref.current.geraete.find((g) => g.id === id);
    if (!d || !confirm(`„${d.name}“ und alle Verbindungen löschen?`)) return;
    mutate((p) => {
      p.geraete = p.geraete.filter((g) => g.id !== id);
      p.verbindungen = p.verbindungen.filter((c) => c.a.dev !== id && c.b.dev !== id);
      if (p.layout.rootId === id) p.layout.rootId = null;
      delete p.layout.offsets[id];
    });
    setSelection(null);
  }, [mutate]);
  const deleteConn = useCallback((id) => {
    mutate((p) => { p.verbindungen = p.verbindungen.filter((c) => c.id !== id); });
    setSelection((s) => (s?.id === id ? null : s));
  }, [mutate]);

  const saveVorlage = (dev) => {
    const name = prompt("Name der Vorlage:", [dev.hersteller, dev.modell].filter(Boolean).join(" ") || dev.name);
    if (!name) return;
    const g = snapshotDevice(dev, P.vlans);
    g.interfaces.forEach((i) => { i.ip = ""; i.mac = ""; });
    g.notizen = ""; g.netzname = ""; g.inventar = { nr: "", sn: "", case: "" };
    setLibrary((l) => ({ ...l, vorlagen: [...(l.vorlagen || []), { id: uid(), name, geraet: g }] }));
    if (dev.icon?.startsWith("custom:")) { const ic = P.icons.find((i) => "custom:" + i.id === dev.icon); if (ic) setLibrary((l) => ({ ...l, icons: (l.icons || []).some((x) => x.id === ic.id) ? l.icons : [...(l.icons || []), ic] })); }
    notify(`Vorlage „${name}“ gespeichert.`);
  };

  // Konkretes Gerät (mit Name, IPs, MACs, Ports) im Gerätebestand speichern bzw. aktualisieren
  const rememberIcon = (dev) => {
    if (!dev.icon?.startsWith("custom:")) return;
    const ic = P.icons.find((i) => "custom:" + i.id === dev.icon);
    if (ic) setLibrary((l) => ({ ...l, icons: (l.icons || []).some((x) => x.id === ic.id) ? l.icons : [...(l.icons || []), ic] }));
  };
  const saveBestand = (dev) => {
    const g = snapshotDevice(dev, P.vlans);
    const now = new Date().toISOString();
    const vorhanden = dev.bestandId && (library.bestand || []).some((b) => b.id === dev.bestandId);
    if (vorhanden) {
      setLibrary((l) => ({ ...l, bestand: l.bestand.map((b) => (b.id === dev.bestandId ? { ...b, name: dev.name, geraet: g, geaendert: now } : b)) }));
      notify(`„${dev.name}“ im Bestand aktualisiert.`);
    } else {
      const bid = uid();
      setLibrary((l) => ({ ...l, bestand: [...(l.bestand || []), { id: bid, name: dev.name, geraet: g, angelegt: now, geaendert: now }] }));
      mutate((d) => { const x = d.geraete.find((y) => y.id === dev.id); if (x) x.bestandId = bid; });
      notify(`„${dev.name}“ im Gerätebestand gespeichert.`);
    }
    rememberIcon(dev);
  };
  const saveAlleBestand = () => {
    const neu = P.geraete.filter((d) => !d.bestandId || !(library.bestand || []).some((b) => b.id === d.bestandId));
    if (!neu.length) return notify("Alle Projektgeräte sind schon im Bestand.");
    if (!confirm(`${neu.length} Geräte aus diesem Projekt in den Bestand übernehmen?`)) return;
    const now = new Date().toISOString();
    const entries = neu.map((d) => ({ id: uid(), dev: d }));
    setLibrary((l) => ({ ...l, bestand: [...(l.bestand || []), ...entries.map(({ id, dev }) => ({ id, name: dev.name, geraet: snapshotDevice(dev, P.vlans), angelegt: now, geaendert: now }))] }));
    mutate((d) => { for (const e of entries) { const x = d.geraete.find((y) => y.id === e.dev.id); if (x) x.bestandId = e.id; } });
    neu.forEach(rememberIcon);
    notify(`${neu.length} Geräte in den Bestand übernommen.`);
  };

  const selectDevice = (id) => { setSelection({ type: "dev", id }); if (!["topologie", "geraete"].includes(tab)) setTab("geraete"); };
  const showProto = (id) => setProtoModal(id);
  const showIssue = (i) => {
    if (i.vlan && !i.dev && !i.conn) { setTab("vlans"); return; }
    setTab("topologie");
    setSelection(i.conn ? { type: "conn", id: i.conn } : { type: "dev", id: i.dev });
  };

  /* ── Dateien ────────────────────────────────────────────────────────── */
  const loadFromFile = (r) => {
    if (!r || r.error) { if (r?.error === "not-found") { notify("Datei nicht gefunden.", "err"); setRecents(r.recents || []); } return; }
    try {
      const data = JSON.parse(r.data);
      if (data.format !== "netzwerkplaner" && !data.geraete) throw new Error("Keine Netzwerkplaner-Datei");
      replaceProject(migrateProject(data));
      setFilePath(r.filePath || null);
      if (r.recents) setRecents(r.recents);
      notify(`„${r.name}“ geöffnet.`);
    } catch (e) { notify("Datei konnte nicht gelesen werden: " + e.message, "err"); }
  };
  const openProject = async () => loadFromFile(await api.openProject());
  const openRecent = async (p) => { setShowRecents(false); loadFromFile(await api.openRecent(p)); };
  const save = async (saveAs) => {
    const json = JSON.stringify({ ...Pref.current, gespeichert: new Date().toISOString(), app: `Netzwerkplaner ${version}` }, null, 1);
    const r = await api.saveProject(json, fileBase(Pref.current), saveAs ? null : filePath);
    if (r) { setFilePath(r.filePath || null); if (r.recents) setRecents(r.recents); notify(`Gespeichert${r.filePath ? ": " + r.filePath : ""}`); }
  };
  const newProject = () => { if (confirm("Neues leeres Projekt beginnen? Nicht gespeicherte Änderungen gehen verloren.")) { replaceProject(emptyProject()); setFilePath(null); setTab("projekt"); } };
  const loadDemo = () => { if (P.geraete.length && !confirm("Aktuelles Projekt durch das Beispielprojekt ersetzen?")) return; replaceProject(demoProject()); setFilePath(null); setTab("topologie"); };

  /* ── Exporte ────────────────────────────────────────────────────────── */
  const needTopo = async () => {
    if (!svgRef.current) { setTab("topologie"); await new Promise((r) => setTimeout(r, 300)); }
    return topologySvg(svgRef.current, P);
  };
  const doExport = async (kind) => {
    setShowExport(false);
    const base = fileBase(P);
    try {
      if (kind === "pdf") { const t = await needTopo(); await api.exportPdf(buildPdfHtml(P, X, issues, t), `${base} – Netzwerkplan`); }
      if (kind === "xlsx") await api.saveFile(buildXlsxBase64(P, X, issues), `${base} – Netzwerkplan.xlsx`, [{ name: "Excel", extensions: ["xlsx"] }], "base64");
      if (kind === "csv") await api.saveFile(buildIpCsv(P, X), `${base} – IP-Liste.csv`, [{ name: "CSV", extensions: ["csv"] }]);
      if (kind === "svg") { const t = await needTopo(); await api.saveFile(t.svg, `${base} – Topologie.svg`, [{ name: "SVG", extensions: ["svg"] }]); }
      if (kind === "png") { const t = await needTopo(); await api.saveFile(await svgToPngBase64(t.svg, t.w, t.h), `${base} – Topologie.png`, [{ name: "PNG", extensions: ["png"] }], "base64"); }
    } catch (e) { console.error(e); notify("Export fehlgeschlagen: " + e.message, "err"); }
  };

  const nErr = issues.filter((i) => i.sev === "error").length, nWarn = issues.filter((i) => i.sev === "warn").length;
  const shared = { P: Pv, X, mutate, issues, status, checkReach, selection, setSelection, onAddDevice: addDevice, onDeleteDevice: deleteDevice, onDeleteConn: deleteConn, onShowProto: showProto, onSaveVorlage: saveVorlage, onSaveBestand: saveBestand, bestand: library.bestand || [], onSelectDevice: selectDevice };

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.logo}>⌬ NETZWERKPLANER</div>
        <div style={S.headerMeta}>{P.meta.veranstaltung} · v{P.meta.version} · {P.meta.datum}{filePath && <span style={{ color: MUTED }}> · {filePath.split(/[\\/]/).pop()}</span>}</div>
        <span style={{ fontSize: 10, color: "#555" }} title="Automatisch gespeichert">💾 auto</span>
        <button style={{ ...S.ghostBtn, padding: "4px 7px" }} onClick={undo} title="Rückgängig (Strg+Z)" disabled={!hist.current.undo.length}>↶</button>
        <button style={{ ...S.ghostBtn, padding: "4px 7px" }} onClick={redo} title="Wiederholen (Strg+Umschalt+Z)" disabled={!hist.current.redo.length}>↷</button>
        <button style={S.ghostBtn} onClick={openProject}>↥ Öffnen</button>
        {isElectron && <div style={{ position: "relative" }}>
          <button style={{ ...S.ghostBtn, padding: "4px 5px" }} title="Zuletzt geöffnet" onClick={() => setShowRecents((v) => !v)}>⏱</button>
          {showRecents && <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 999, background: "#1b2026", border: "1px solid #2e3640", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 280, maxWidth: 380, marginTop: 4 }} onMouseLeave={() => setShowRecents(false)}>
            <div style={{ padding: "6px 10px", fontSize: 10, color: MUTED, borderBottom: "1px solid #2e3640", letterSpacing: 0.5, textTransform: "uppercase" }}>Zuletzt geöffnet</div>
            {recents.length === 0 ? <div style={{ padding: "10px 12px", fontSize: 11, color: MUTED, fontStyle: "italic" }}>Noch keine Dateien geöffnet.</div>
              : recents.map((r, i) => <button key={i} onClick={() => openRecent(r.filePath)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 12px", cursor: "pointer", color: "#c8d0d8", fontSize: 11, borderBottom: "1px solid #232a33" }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 9, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString("de-DE")} · {r.filePath}</div>
              </button>)}
          </div>}
        </div>}
        <button style={S.ghostBtn} onClick={() => save(false)} title="Speichern (Strg+S)">💾 Speichern</button>
        {isElectron && <button style={S.ghostBtn} onClick={() => save(true)} title="Speichern unter">…</button>}
        <button style={S.ghostBtn} onClick={newProject}>↺ Neu</button>
        <button style={S.ghostBtn} onClick={() => setChangelog(true)} title="Was ist neu?">📋</button>
        <div style={{ position: "relative" }}>
          <button style={S.exportBtn} onClick={() => setShowExport((v) => !v)}>⇩ Export ▾</button>
          {showExport && <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 999, background: "#1b2026", border: "1px solid #2e3640", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 230, marginTop: 4, overflow: "hidden" }} onMouseLeave={() => setShowExport(false)}>
            {[["pdf", "🖨 PDF-Dokumentation"], ["xlsx", "📊 Excel (IP-Liste, VLANs, Patch …)"], ["csv", "IP-Liste als CSV"], ["svg", "Topologie als SVG"], ["png", "Topologie als PNG"]].map(([k, l]) => (
              <button key={k} onClick={() => doExport(k)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #232a33", padding: "9px 12px", cursor: "pointer", color: "#e8eaed", fontSize: 12 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#232a33")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>{l}</button>
            ))}
          </div>}
        </div>
      </header>
      <nav style={S.nav}>
        {TABS.map(([k, label]) => (
          <button key={k} style={{ ...S.navBtn, ...(tab === k ? S.navBtnActive : {}) }} onClick={() => setTab(k)}>
            <span style={{ display: "block", height: 0, fontWeight: 600, overflow: "hidden", visibility: "hidden" }} aria-hidden="true">{label}</span>
            {label}
            {k === "pruefung" && (nErr + nWarn > 0) && <span style={{ ...S.badge, marginLeft: 6, background: nErr ? ERR : WARN, color: "#1c2127" }}>{nErr || nWarn}</span>}
          </button>
        ))}
      </nav>

      {tab === "topologie" ? (
        <TopologieTab {...shared} svgRef={svgRef} autoStatus={autoStatus} setAutoStatus={setAutoStatus} />
      ) : (
        <main style={S.main} key={tab}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "projekt" && <ProjektTab P={Pv} X={X} mutate={mutate} issues={issues} goTab={setTab} loadDemo={loadDemo} newProject={newProject} />}
            {tab === "geraete" && <GeraeteTab {...shared} />}
            {tab === "vlans" && <VlanTab P={Pv} X={X} mutate={mutate} issues={issues} onSelectDevice={selectDevice} />}
            {tab === "patch" && <PatchTab P={Pv} X={X} mutate={mutate} issues={issues} onSelectDevice={selectDevice} onDeleteConn={deleteConn} />}
            {tab === "pruefung" && <PruefungTab P={Pv} X={X} issues={issues} onShowIssue={showIssue} />}
            {tab === "bibliothek" && <BibliothekTab P={Pv} mutate={mutate} onSaveAlleBestand={saveAlleBestand} notify={notify} library={library} setLibrary={setLibrary} protoId={protoId} setProtoId={setProtoId} onAddDevice={addDevice} onSelectDevice={selectDevice} sub={bibSub} setSub={setBibSub} allIcons={allIcons} />}
            {tab === "hilfe" && <AnleitungTab />}
          </div>
        </main>
      )}

      {picker && <DevicePicker vorlagen={library.vorlagen || []} bestand={library.bestand || []} customIcons={allIcons} title={picker.connectTo && X.devById.get(picker.connectTo)?.isSwitch ? `Gerät an „${X.devById.get(picker.connectTo)?.name}“ anschließen` : "Gerät hinzufügen"}
        onClose={() => setPicker(null)} onPick={(item) => { const id = addDevice({ kind: item.kind, key: item.key }, { connectTo: picker.connectTo }); setPicker(null); if (id) setSelection({ type: "dev", id }); }} />}
      {protoModal && <Modal title="Protokoll" width={860} onClose={() => setProtoModal(null)}
        footer={<button style={S.secondaryBtn} onClick={() => { setProtoId(protoModal); setBibSub("protokolle"); setTab("bibliothek"); setProtoModal(null); }}>In der Bibliothek öffnen</button>}>
        <ProtokollDetail p={PROTOKOLLE.find((p) => p.id === protoModal)} P={Pv} onSelectDevice={(id) => { setProtoModal(null); selectDevice(id); }} />
      </Modal>}
      {changelog && <Modal title={`Netzwerkplaner ${version}`} onClose={() => setChangelog(false)}>
        {Object.entries(CHANGELOG).map(([v, items]) => <div key={v}><div className="sp-section-label">Version {v}</div><ul style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}
      </Modal>}
      {toast && <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#1b2026", border: `1px solid ${toast.kind === "err" ? ERR : toast.kind === "warn" ? WARN : ACCENT}`, color: "#e8eaed", padding: "9px 16px", borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,.5)", maxWidth: "80vw" }}>{toast.msg}</div>}
    </div>
  );
}
