import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { S, ACCENT, LINE, SUB, MUTED, ERR, WARN, LS_KEY } from "../shared/constants.js";
import { emptyProject, migrateProject, buildIndex, validate, clone, addConnection, webUrl } from "../shared/model.js";
import { createDevice, uid, snapshotDevice, geraetUmbauen, migrateBibliothek, ipPorts } from "../shared/catalog.js";
import { migrateLibrary, fehlendeFeldDefs } from "../shared/felder.js";
import { demoProject } from "../shared/demo.js";
import { api, isElectron } from "./api.js";
import { DevicePicker, Modal } from "./ui.jsx";
import { topologySvg, svgToPngBase64, buildXlsxBase64, buildIpCsv, buildPdfHtml, buildPatchCsv, fileBase } from "./exports.js";
import PatchlisteTab from "./tabs/PatchlisteTab.jsx";
import { ProtokollDetail } from "./tabs/BibliothekTab.jsx";
import { PROTOKOLLE } from "../shared/catalog.js";
import ProjektTab from "./tabs/ProjektTab.jsx";
import TopologieTab from "./tabs/TopologieTab.jsx";
import GeraeteTab from "./tabs/GeraeteTab.jsx";
import VlanTab from "./tabs/VlanTab.jsx";
import PruefungTab from "./tabs/PruefungTab.jsx";
import BibliothekTab from "./tabs/BibliothekTab.jsx";
import WissenTab from "./tabs/WissenTab.jsx";
import { analyseIssues } from "../shared/analyse.js";
import { maNetIssues } from "../shared/manet.js";
import { ladeLogo, speichereLogo, logoAusDatei } from "./logo.js";
import APP_ICON_SVG from "../../assets/app-icon/icon.svg";
const APP_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(APP_ICON_SVG)}`;
import { CHANGELOG, compareVersions, neuesteVersion, istBeta, RELEASES_URL } from "../shared/version.js";
import AnleitungTab from "./tabs/AnleitungTab.jsx";
import LiveTab from "./tabs/LiveTab.jsx";
import SitzungDialog from "./SitzungDialog.jsx";
import { useSitzung } from "./sync.js";
import { diff, apply, invert, valueAt, pathKey } from "../shared/ops.js";
import { removeDevice } from "../shared/invarianten.js";
import { bestandSchluessel } from "../shared/bestandschluessel.js";
import { Pencil, Plus, X as XIcon, ArrowUpCircle, Save, Undo2, Redo2, Users, FolderOpen, History, RotateCcw, ScrollText, Download, ChevronDown, Printer, Sheet, Power } from "lucide-react";


const TABS = [["projekt", "Projekt"], ["topologie", "Topologie"], ["geraete", "Geräte"], ["patch", "Patchliste"], ["vlans", "VLANs"], ["pruefung", "Prüfung"], ["live", "Live"], ["wissen", "Wissen"], ["bibliothek", "Katalog"], ["hilfe", "Anleitung"]];

const loadAutosave = () => {
  try { const s = localStorage.getItem(LS_KEY); if (s) return migrateProject(JSON.parse(s)); } catch (e) { console.error(e); }
  return emptyProject();
};

export default function App() {
  const [P, setP] = useState(loadAutosave);
  const Pref = useRef(P);
  const hist = useRef({ undo: [], redo: [] }); // Transaktionen als Operationen (nur eigene Änderungen)
  const [tab, setTab] = useState(() => { const t = localStorage.getItem("netzwerkplaner_tab"); return !t || t === "analyse" ? "projekt" : t; });
  const [selection, setSelection] = useState(null);
  const [picker, setPicker] = useState(null); // { connectTo }
  const [status, setStatus] = useState({});
  const [autoStatus, setAutoStatus] = useState(false);
  const [library, setLibrary] = useState({ vorlagen: [], bestand: [], icons: [], felder: [] });
  const [libLoaded, setLibLoaded] = useState(false);
  const [filePath, setFilePath] = useState(() => localStorage.getItem("netzwerkplaner_file") || null);
  const [recents, setRecents] = useState([]);
  const [showRecents, setShowRecents] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [protoModal, setProtoModal] = useState(null);
  const [protoId, setProtoId] = useState(null);
  const [bibSub, setBibSub] = useState("bestand");
  const [changelog, setChangelog] = useState(false);
  const [corpLogo, setCorpLogo] = useState(ladeLogo);
  const logoHochladen = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { const url = await logoAusDatei(f); setCorpLogo(url); speichereLogo(url); } catch { notify("Das Bild ließ sich nicht lesen.", "warn"); }
  };
  const [update, setUpdate] = useState(null); // { tag, url } wenn neuer als die laufende Version
  const [updateStatus, setUpdateStatus] = useState("");
  const [toast, setToast] = useState(null);
  const [version, setVersion] = useState("");
  const svgRef = useRef(null);

  const notify = (msg, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200); };
  const sitzung = useSitzung({ Pref, setP, notify, version });
  const [showSitzung, setShowSitzung] = useState(false);
  // Projekt ersetzen geht nur außerhalb einer Sitzung
  // Neue Sitzung: eigene Undo-Schritte von vorher passen nicht zum Stand der Sitzung
  useEffect(() => { hist.current = { undo: [], redo: [] }; }, [sitzung.zustand?.info?.id]);
  const sitzungVerlassenOk = () => {
    if (!sitzung.zustand) return true;
    if (!confirm("Dafür musst du die gemeinsame Sitzung verlassen. Dein aktueller Stand bleibt als lokale Kopie. Verlassen?")) return false;
    sitzung.verlassen();
    return true;
  };

  /* ── Zustand ändern (synchron, mit Undo) ─────────────────────────────── */
  const mutate = useCallback((fn) => {
    const prev = Pref.current;
    const next = clone(prev);
    fn(next);
    const ops = diff(prev, next);
    if (!ops.length) return;
    // Tippen in dasselbe Feld ist ein Undo-Schritt (solange das Eingabefeld den Fokus hat oder kurz danach)
    const h = hist.current, last = h.undo[h.undo.length - 1], jetzt = Date.now();
    const el = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) ? document.activeElement : null;
    const einFeld = (o) => o.length === 1 && o[0].op === "set";
    if (last && einFeld(ops) && einFeld(last.ops) && (jetzt - last.t < 1500 || (el && last.el === el)) && pathKey(ops[0].path) === pathKey(last.ops[0].path)) { last.ops = [{ ...ops[0], old: last.ops[0].old }]; last.t = jetzt; }
    else { h.undo.push({ ops, t: jetzt, el }); if (h.undo.length > 80) h.undo.shift(); }
    h.redo = [];
    Pref.current = next;
    setP(next);
    sitzung.senden(ops);
  }, []);
  const replaceProject = useCallback((next, keepHistory) => {
    if (!keepHistory) hist.current = { undo: [], redo: [] };
    Pref.current = next; setP(next); setSelection(null); setStatus({});
  }, []);
  // Undo/Redo nimmt nur eigene Änderungen zurück. Felder, die inzwischen jemand anderes geändert hat, bleiben.
  const schritt = (von, nach) => {
    const e = von.pop();
    if (!e) return;
    const cur = Pref.current;
    const inv = invert(e.ops);
    // `old` des inversen Ops ist der Wert, den wir damals geschrieben haben; steht dort etwas anderes, hat es jemand geändert
    const ok = inv.filter((o) => (o.op !== "set" && o.op !== "del") || JSON.stringify(valueAt(cur, o.path)) === JSON.stringify(o.old));
    const next = clone(cur);
    const verworfen = apply(next, ok).length + inv.length - ok.length;
    const angewendet = diff(cur, next);
    nach.push({ ops: angewendet, t: 0 });
    Pref.current = next; setP(next);
    sitzung.senden(angewendet);
    if (verworfen) notify(`${inv.length - verworfen} von ${inv.length} Änderungen zurückgenommen, der Rest wurde inzwischen von anderen geändert.`, "warn");
  };
  const undo = () => schritt(hist.current.undo, hist.current.redo);
  const redo = () => schritt(hist.current.redo, hist.current.undo);

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
    api.loadLibrary().then((l) => { if (l) setLibrary(migrateBibliothek(migrateLibrary(l))); setLibLoaded(true); });
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
  const issues = useMemo(() => [...validate(P, X), ...analyseIssues(P, X), ...maNetIssues(P, X)], [P, X]);
  // Eigene Felder, die in Geräten vorkommen (fremde Projektdatei, im Editor neu angelegt), in den Katalog übernehmen
  useEffect(() => {
    if (!libLoaded) return;
    const geraete = [...P.geraete, ...(library.bestand || []).map((b) => b.geraet), ...(library.vorlagen || []).map((v) => v.geraet)];
    const add = fehlendeFeldDefs(library.felder || [], geraete);
    if (add.length) setLibrary((l) => ({ ...l, felder: [...(l.felder || []), ...add] }));
  }, [P.geraete, libLoaded, library]);

  const Pv = useMemo(() => ({ ...P, icons: allIcons, feldKatalog: library.felder || [] }), [P, allIcons, library.felder]);

  /* ── Erreichbarkeit ─────────────────────────────────────────────────── */
  const checkReach = useCallback(async (ids) => {
    const P0 = Pref.current;
    const targets = [];
    for (const d of P0.geraete) {
      if (ids && !ids.includes(d.id)) continue;
      const url = webUrl(d);
      const ifc = d.ports.find((i) => i.id === d.webUi?.iface && i.ip) || ipPorts(d).find((i) => i.ip);
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

  /* ── Versionen: beim Start prüfen, ob auf GitHub eine neuere Version liegt ── */
  const checkUpdate = useCallback(async (manuell = false) => {
    if (!version || version === "dev") return;
    if (manuell) setUpdateStatus("Suche …");
    const list = await api.fetchReleases();
    if (!list) { if (manuell) setUpdateStatus("GitHub nicht erreichbar."); return; }
    // Stabile Versionen sehen nur stabile Releases, Betas sehen alles
    const n = neuesteVersion(istBeta(version) ? list : list.filter((r) => !r.prerelease));
    if (n && compareVersions(n.tag_name, version) > 0) { setUpdate((u) => ({ ...u, tag: n.tag_name.replace(/^v/, ""), url: n.html_url || RELEASES_URL })); setUpdateStatus((s) => (/geladen|bereit/.test(s) ? s : `Neue Version ${n.tag_name} verfügbar.`)); }
    else if (manuell) setUpdateStatus(`Du nutzt die neueste Version (${version}).`);
    // Windows: electron-updater lädt die neue Version im Hintergrund
    if (manuell) api.checkForUpdates();
  }, [version]);
  useEffect(() => { checkUpdate(false); }, [checkUpdate]);
  useEffect(() => api.onUpdateStatus((m) => {
    if (m.type === "available") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag })); setUpdateStatus(`Version ${m.version} wird geladen …`); }
    else if (m.type === "downloading") setUpdateStatus(`Update wird geladen … ${m.percent} %`);
    else if (m.type === "installing-after-download") setUpdateStatus("Update wird geladen und danach automatisch installiert …");
    else if (m.type === "downloaded") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag, bereit: true })); setUpdateStatus(`Version ${m.version || ""} ist bereit. „Neu starten“ installiert sie.`); }
    else if (m.type === "mac-dmg-offen") { setUpdate((u) => ({ url: RELEASES_URL, ...u, macOffen: true })); setUpdateStatus(`Version ${m.version} ist geöffnet. Netzwerkplaner beenden, im Finder-Fenster auf „Programme“ ziehen, „Ersetzen“ wählen und neu starten.`); setChangelog(true); }
    else if (m.type === "error") setUpdateStatus((s) => (/verfügbar/.test(s) ? s : "Automatisches Update nicht möglich. Download-Seite nutzen."));
  }), []);
  // Windows: electron-updater lädt und installiert selbst. macOS: Download-Seite (App nicht mit Apple-ID signiert)
  // macOS: DMG in der App laden und öffnen, der Nutzer zieht die App nach „Programme“
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [macUpdate, setMacUpdate] = useState(false);
  useEffect(() => { api.checkForUpdates().then((r) => { setAutoUpdate(!!r?.auto); setMacUpdate(!!r?.mac); }).catch(() => {}); }, []);
  const updateAusfuehren = () => {
    if (macUpdate && update?.tag) { setChangelog(true); if (update.macOffen) return; api.macUpdateLaden(update.tag).then((r) => !r?.ok && setUpdateStatus("Download läuft schon oder ist nicht möglich. Download-Seite nutzen.")); return; }
    return autoUpdate || update?.bereit ? api.installUpdate() : api.installUpdate(update?.url || RELEASES_URL);
  };

  /* ── Geräte & Verbindungen ──────────────────────────────────────────── */
  const addDevice = useCallback((item, { connectTo, at, picker: usePicker } = {}) => {
    if (!item || usePicker) { setPicker({ connectTo }); return null; }
    const vorlage = item.kind === "vorlage" ? (library.vorlagen || []).find((v) => v.id === item.key)
      : item.kind === "bestand" ? (library.bestand || []).find((v) => v.id === item.key) : null;
    if (sitzung.aktiv) { // In der Sitzung vergibt der Server Namen, Port und IDs
      sitzung.intent("addDevice", { item: { kind: item.kind, key: item.key, objekt: vorlage }, connectTo, at }).then((r) => {
        setSelection({ type: "dev", id: r.id });
        if (r.konflikte?.length) notify(`Gerät eingefügt. IP bereits belegt: ${r.konflikte.join(", ")} – siehe Prüfung.`, "err");
        else if (r.voll) notify(`Gerät hinzugefügt, aber nicht verbunden: „${r.voll}“ hat keinen freien Anschluss mehr.`, "warn");
        else notify("Gerät hinzugefügt." + (r.neueVlans?.length ? ` Neues VLAN angelegt: ${r.neueVlans.join(", ")}.` : ""));
      }).catch(() => {});
      return null;
    }
    let id = null, konflikte = [], neueVlans = [], voll = null;
    mutate((d) => {
      const vorher = new Set(d.vlans.map((v) => v.id));
      const dev = createDevice({ katalogId: item.kind === "katalog" ? item.key : null, typ: item.kind === "typ" ? item.key : null, vlans: d.vlans, eigeneVorlage: vorlage, mitAdressen: item.kind === "bestand" });
      if (item.kind === "bestand") {
        dev.bestandId = vorlage.id;
        const belegt = new Set(d.geraete.flatMap((g) => g.ports.map((i) => i.ip)).filter(Boolean));
        konflikte = dev.ports.filter((i) => i.ip && belegt.has(i.ip)).map((i) => i.ip);
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
      neueVlans = d.vlans.filter((v) => !vorher.has(v.id)).map((v) => `${v.vid} ${v.name}`);
      if (parent && !addConnection(d, parent.id, dev.id)) voll = parent.name;
      else if (at) d.layout.pinned = { ...(d.layout.pinned || {}), [dev.id]: at };
    });
    if (konflikte.length) notify(`Gerät eingefügt. IP bereits belegt: ${konflikte.join(", ")} – siehe Prüfung.`, "err");
    else if (voll) notify(`Gerät hinzugefügt, aber nicht verbunden: „${voll}“ hat keinen freien Anschluss mehr. Zum Ersetzen im Werkzeug „Verbinden“ ziehen.`, "warn");
    else notify((item.kind === "bestand" ? "Gerät aus dem Bestand eingefügt (mit IPs)." : "Gerät hinzugefügt.") + (neueVlans.length ? ` Neues VLAN angelegt: ${neueVlans.join(", ")}.` : ""));
    return id;
  }, [library, mutate]);

  // Gerät nachträglich auf ein Katalogmodell, eine Vorlage oder einen Bestandseintrag umbauen
  const umbauen = useCallback((devId, item) => {
    const quelle = item.kind === "vorlage" ? (library.vorlagen || []).find((v) => v.id === item.key)
      : item.kind === "bestand" ? (library.bestand || []).find((v) => v.id === item.key) : null;
    const ausBestand = item.kind === "bestand" && !!quelle;
    if (sitzung.aktiv) {
      sitzung.intent("umbauen", { dev: devId, item: { kind: item.kind, key: item.key, objekt: quelle } }).then((r) => {
        notify(r.konflikte?.length ? `Übernommen. IP bereits vergeben: ${r.konflikte.join(", ")}` : "Modell übernommen. Name, IPs und Verbindungen sind geblieben.", r.konflikte?.length ? "warn" : "ok");
      }).catch(() => {});
      return;
    }
    let konflikte = [];
    mutate((d) => {
      const neu = createDevice({ katalogId: item.kind === "katalog" ? item.key : null, typ: item.kind === "typ" ? item.key : null, vlans: d.vlans, eigeneVorlage: quelle, mitAdressen: ausBestand });
      if (ausBestand) {
        neu.bestandId = quelle.id;
        const belegt = new Set(d.geraete.filter((g) => g.id !== devId).flatMap((g) => g.ports.map((i) => i.ip)).filter(Boolean));
        konflikte = neu.ports.filter((i) => i.ip && belegt.has(i.ip)).map((i) => i.ip);
      }
      geraetUmbauen(d, devId, neu, { ausBestand });
    });
    if (konflikte.length) notify(`Gerät aus dem Bestand übernommen. IP bereits vergeben: ${konflikte.join(", ")}`, "warn");
    else notify(ausBestand ? "Gerät aus dem Bestand übernommen, mit seinen festen IPs. Die Verbindungen sind geblieben." : item.kind === "typ" ? "Leeres Gerät angelegt. Name, IPs und Verbindungen sind geblieben." : "Modell übernommen. Name, IPs und Verbindungen sind geblieben.");
  }, [library, mutate]);

  const deleteDevice = useCallback((id) => {
    const d = Pref.current.geraete.find((g) => g.id === id);
    if (!d || !confirm(`„${d.name}“ und alle Verbindungen löschen?`)) return;
    if (sitzung.aktiv) sitzung.intent("loescheGeraete", { ids: [id] }).catch(() => {});
    else mutate((p) => removeDevice(p, id)); // räumt auch Stapel, Positionen, Knicke und Stromziele auf
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
    g.ports.forEach((i) => { i.ip = ""; i.mac = ""; });
    g.notizen = ""; g.netzname = ""; (g.felder || []).forEach((f) => { f.wert = ""; }); // Vorlage behält die Felder, ohne Werte
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
  // Feste ID aus Inventar-Nr., Seriennummer oder MAC: derselbe Bestand auf zwei Rechnern hat dieselben IDs
  const bestandId = (g) => { const k = bestandSchluessel(g); return k && !(library.bestand || []).some((b) => b.id === k) ? k : uid(); };
  const saveBestand = (dev) => {
    const g = snapshotDevice(dev, P.vlans);
    const now = new Date().toISOString();
    const vorhanden = dev.bestandId && (library.bestand || []).some((b) => b.id === dev.bestandId);
    if (vorhanden) {
      setLibrary((l) => ({ ...l, bestand: l.bestand.map((b) => (b.id === dev.bestandId ? { ...b, name: dev.name, geraet: g, geaendert: now } : b)) }));
      notify(`„${dev.name}“ im Bestand aktualisiert.`);
    } else {
      const bid = bestandId(g);
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
    const entries = neu.map((d) => ({ id: bestandId(snapshotDevice(d, P.vlans)), dev: d }));
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
  const openProject = async () => { if (sitzungVerlassenOk()) loadFromFile(await api.openProject()); };
  const openRecent = async (p) => { setShowRecents(false); if (sitzungVerlassenOk()) loadFromFile(await api.openRecent(p)); };
  const save = async (saveAs) => {
    const json = JSON.stringify({ ...Pref.current, gespeichert: new Date().toISOString(), app: `Netzwerkplaner ${version}` }, null, 1);
    const r = await api.saveProject(json, fileBase(Pref.current), saveAs ? null : filePath);
    if (r) { setFilePath(r.filePath || null); if (r.recents) setRecents(r.recents); notify(`Gespeichert${r.filePath ? ": " + r.filePath : ""}`); }
  };
  const newProject = () => { if (sitzungVerlassenOk() && confirm("Neues leeres Projekt beginnen? Nicht gespeicherte Änderungen gehen verloren.")) { replaceProject(emptyProject()); setFilePath(null); setTab("projekt"); } };
  const loadDemo = () => { if (!sitzungVerlassenOk()) return; if (P.geraete.length && !confirm("Aktuelles Projekt durch das Beispielprojekt ersetzen?")) return; replaceProject(demoProject()); setFilePath(null); setTab("topologie"); };

  /* ── Exporte ────────────────────────────────────────────────────────── */
  const needTopo = async () => {
    if (!svgRef.current) { setTab("topologie"); await new Promise((r) => setTimeout(r, 300)); }
    return topologySvg(svgRef.current, P);
  };
  const doExport = async (kind) => {
    setShowExport(false);
    const base = fileBase(P);
    try {
      if (kind === "pdf") { const t = await needTopo(); await api.exportPdf(buildPdfHtml(Pv, X, issues, t), `${base} – Netzwerkplan`); }
      if (kind === "xlsx") await api.saveFile(buildXlsxBase64(Pv, X, issues), `${base} – Netzwerkplan.xlsx`, [{ name: "Excel", extensions: ["xlsx"] }], "base64");
      if (kind === "patch-pdf") await api.exportPdf(buildPdfHtml(Pv, X, issues, null, { nurPatch: true }), `${base} – Patchliste`);
      if (kind === "patch-csv") await api.saveFile(buildPatchCsv(Pv, X), `${base} – Patchliste.csv`, [{ name: "CSV", extensions: ["csv"] }]);
      if (kind === "csv") await api.saveFile(buildIpCsv(P, X), `${base} – IP-Liste.csv`, [{ name: "CSV", extensions: ["csv"] }]);
      if (kind === "svg") { const t = await needTopo(); await api.saveFile(t.svg, `${base} – Topologie.svg`, [{ name: "SVG", extensions: ["svg"] }]); }
      if (kind === "png") { const t = await needTopo(); await api.saveFile(await svgToPngBase64(t.svg, t.w, t.h), `${base} – Topologie.png`, [{ name: "PNG", extensions: ["png"] }], "base64"); }
    } catch (e) { console.error(e); notify("Export fehlgeschlagen: " + e.message, "err"); }
  };

  const nErr = issues.filter((i) => i.sev === "error").length, nWarn = issues.filter((i) => i.sev === "warn").length;
  const shared = { P: Pv, X, mutate, issues, status, checkReach, selection, setSelection, onAddDevice: addDevice, onDeleteDevice: deleteDevice, onDeleteConn: deleteConn, onShowProto: showProto, onSaveVorlage: saveVorlage, onSaveBestand: saveBestand, bestand: library.bestand || [], onSelectDevice: selectDevice, onUmbauen: (id) => setPicker({ umbauFor: id }), onTypWaehlen: (id, key) => umbauen(id, { kind: "typ", key }) };

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={{ ...S.logo, display: "flex", alignItems: "center", gap: 8 }}><img src={APP_ICON} alt="" style={{ width: 24, height: 24, display: "block" }} />NETZWERKPLANER</div>
        {corpLogo && <img src={corpLogo} alt="Logo" style={{ height: 26, maxWidth: 110, objectFit: "contain", display: "block" }} />}
        <label style={{ ...S.ghostBtn, padding: "3px 7px", fontSize: 10, cursor: "pointer" }} title={corpLogo ? "Logo ersetzen" : "Eigenes Logo hochladen (erscheint auch in PDF-Exporten)"}>
          {corpLogo ? <Pencil size={12} /> : <Plus size={12} />}Logo<input type="file" accept="image/*" style={{ display: "none" }} onChange={logoHochladen} />
        </label>
        {corpLogo && <button style={{ ...S.ghostBtn, padding: "3px 6px", fontSize: 10 }} onClick={() => { setCorpLogo(""); speichereLogo(""); }} title="Logo entfernen"><XIcon size={12} /></button>}
        {version && <button onClick={() => setChangelog(true)} title="Version und Änderungen" style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 10, color: SUB, fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
          v{version.replace(/-beta\.?\d*$/i, "")}{istBeta(version) && <span style={{ marginLeft: 5, color: "#fff", background: ACCENT, borderRadius: 6, padding: "0 5px", fontSize: 9.5, fontWeight: 700 }}>BETA {(version.match(/beta\.?(\d+)/i) || [])[1] || ""}</span>}
        </button>}
        {update?.tag && <button onClick={updateAusfuehren} title={autoUpdate ? "Update automatisch installieren" : macUpdate ? "Update laden und öffnen" : "Download-Seite öffnen"} style={{ background: "#2ecc7122", border: "1px solid #2ecc71", borderRadius: 10, color: "#2ecc71", fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowUpCircle size={12} /> {autoUpdate || macUpdate ? `${update.tag} installieren` : `${update.tag} verfügbar`}</button>}
        <div style={S.headerMeta}>{P.meta.veranstaltung} · v{P.meta.version} · {P.meta.datum}{filePath && <span style={{ color: MUTED }}> · {filePath.split(/[\\/]/).pop()}</span>}</div>
        <span style={{ fontSize: 10, color: "#555", display: "inline-flex", alignItems: "center", gap: 3 }} title="Automatisch gespeichert"><Save size={11} /> auto</span>
        <button style={{ ...S.ghostBtn, padding: "4px 7px" }} onClick={undo} title="Rückgängig (Strg+Z)" disabled={!hist.current.undo.length}><Undo2 size={14} /></button>
        <button style={{ ...S.ghostBtn, padding: "4px 7px" }} onClick={redo} title="Wiederholen (Strg+Umschalt+Z)" disabled={!hist.current.redo.length}><Redo2 size={14} /></button>
        <button style={{ ...S.ghostBtn, ...(sitzung.zustand ? { borderColor: sitzung.zustand.veraltet ? ERR : sitzung.zustand.status === "online" ? "#2ecc71" : WARN } : {}) }} onClick={() => setShowSitzung(true)} title="Gemeinsam arbeiten über den Planer-Server">
          <Users size={14} /> {sitzung.zustand ? (sitzung.zustand.veraltet ? "Sitzung beendet" : `${sitzung.zustand.users?.length || 0} online${sitzung.zustand.ausstehend ? ` · ${sitzung.zustand.ausstehend} ausstehend` : ""}`) : "Sitzung"}
        </button>
        <button style={S.ghostBtn} onClick={openProject}><FolderOpen size={14} /> Öffnen</button>
        {isElectron && <div style={{ position: "relative" }}>
          <button style={{ ...S.ghostBtn, padding: "4px 5px" }} title="Zuletzt geöffnet" onClick={() => setShowRecents((v) => !v)}><History size={14} /></button>
          {showRecents && <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 999, background: "#1b2026", border: "1px solid #2e3640", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 280, maxWidth: 380, marginTop: 4 }} onMouseLeave={() => setShowRecents(false)}>
            <div style={{ padding: "6px 10px", fontSize: 10, color: MUTED, borderBottom: "1px solid #2e3640", letterSpacing: 0.5, textTransform: "uppercase" }}>Zuletzt geöffnet</div>
            {recents.length === 0 ? <div style={{ padding: "10px 12px", fontSize: 11, color: MUTED, fontStyle: "italic" }}>Noch keine Dateien geöffnet.</div>
              : recents.map((r, i) => <button key={i} onClick={() => openRecent(r.filePath)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "7px 12px", cursor: "pointer", color: "#c8d0d8", fontSize: 11, borderBottom: "1px solid #232a33" }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 9, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString("de-DE")} · {r.filePath}</div>
              </button>)}
          </div>}
        </div>}
        <button style={S.ghostBtn} onClick={() => save(false)} title="Speichern (Strg+S)"><Save size={14} /> Speichern</button>
        {isElectron && <button style={S.ghostBtn} onClick={() => save(true)} title="Speichern unter">…</button>}
        <button style={S.ghostBtn} onClick={newProject}><RotateCcw size={14} /> Neu</button>
        <button style={S.ghostBtn} onClick={() => setChangelog(true)} title="Was ist neu?"><ScrollText size={14} /></button>
        <div style={{ position: "relative" }}>
          <button style={S.exportBtn} onClick={() => setShowExport((v) => !v)}><Download size={14} /> Export <ChevronDown size={14} /></button>
          {showExport && <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 999, background: "#1b2026", border: "1px solid #2e3640", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 230, marginTop: 4, overflow: "hidden" }} onMouseLeave={() => setShowExport(false)}>
            {[["pdf", "PDF-Dokumentation", Printer], ["xlsx", "Excel (Patchliste, IP-Liste, VLANs, Ports …)", Sheet], ["patch-pdf", "Patchliste (PDF zum Ausdrucken)", Printer], ["patch-csv", "Patchliste als CSV"], ["csv", "IP-Liste als CSV"], ["svg", "Topologie als SVG"], ["png", "Topologie als PNG"]].map(([k, l, Ic]) => (
              <button key={k} onClick={() => doExport(k)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #232a33", padding: "9px 12px", cursor: "pointer", color: "#e8eaed", fontSize: 12 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#232a33")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>{Ic && <Ic size={14} />}{l}</button>
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
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} key={tab}><main style={S.main}>
          <div style={{ animation: "npFade .18s ease" }}>
            {tab === "projekt" && <ProjektTab P={Pv} X={X} mutate={mutate} issues={issues} goTab={setTab} loadDemo={loadDemo} newProject={newProject} />}
            {tab === "geraete" && <GeraeteTab {...shared} />}
            {tab === "patch" && <PatchlisteTab P={Pv} X={X} mutate={mutate} onSelectDevice={selectDevice} onExport={doExport} />}
            {tab === "vlans" && <VlanTab P={Pv} X={X} mutate={mutate} issues={issues} onSelectDevice={selectDevice} />}
            {tab === "pruefung" && <PruefungTab P={Pv} X={X} issues={issues} onShowIssue={showIssue} />}
            {tab === "bibliothek" && <BibliothekTab P={Pv} mutate={mutate} onSaveAlleBestand={saveAlleBestand} notify={notify} library={library} setLibrary={setLibrary} protoId={protoId} setProtoId={setProtoId} onAddDevice={addDevice} onSelectDevice={selectDevice} sub={bibSub} setSub={setBibSub} allIcons={allIcons} />}
            {tab === "live" && <LiveTab P={Pv} X={X} mutate={mutate} status={status} checkReach={checkReach} autoStatus={autoStatus} setAutoStatus={setAutoStatus} onSelectDevice={selectDevice} notify={notify} />}
            {tab === "wissen" && <WissenTab />}
            {tab === "hilfe" && <AnleitungTab goTab={setTab} />}
          </div>
        </main></div>
      )}

      {picker && <DevicePicker vorlagen={library.vorlagen || []} bestand={library.bestand || []} customIcons={allIcons} title={picker.umbauFor ? `Modell für „${X.devById.get(picker.umbauFor)?.name}“ wählen` : picker.connectTo && X.devById.get(picker.connectTo)?.isSwitch ? `Gerät an „${X.devById.get(picker.connectTo)?.name}“ anschließen` : "Gerät hinzufügen"}
        onClose={() => setPicker(null)} onPick={(item) => { if (picker.umbauFor) { umbauen(picker.umbauFor, item); setPicker(null); return; } const id = addDevice({ kind: item.kind, key: item.key }, { connectTo: picker.connectTo }); setPicker(null); if (id) setSelection({ type: "dev", id }); }} />}
      {protoModal && <Modal title="Protokoll" width={860} onClose={() => setProtoModal(null)}
        footer={<button style={S.secondaryBtn} onClick={() => { setProtoId(protoModal); setBibSub("protokolle"); setTab("bibliothek"); setProtoModal(null); }}>Im Katalog öffnen</button>}>
        <ProtokollDetail p={PROTOKOLLE.find((p) => p.id === protoModal)} P={Pv} onSelectDevice={(id) => { setProtoModal(null); selectDevice(id); }} />
      </Modal>}
      {changelog && <Modal title={`Netzwerkplaner ${version}`} onClose={() => setChangelog(false)}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <button style={S.secondaryBtn} onClick={() => checkUpdate(true)}>Nach Updates suchen</button>
          {update?.tag && autoUpdate && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Lädt das Update (falls nötig), beendet die App, installiert und startet neu"><ArrowUpCircle size={14} /> {update.bereit ? "Neu starten und installieren" : `${update.tag} automatisch installieren`}</button>}
          {update?.tag && macUpdate && !update.macOffen && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Lädt das passende DMG in den Download-Ordner und öffnet es. Danach die App nach „Programme“ ziehen."><ArrowUpCircle size={14} /> {update.tag} laden und öffnen</button>}
          {update?.tag && macUpdate && update.macOffen && <button style={S.primaryBtn} onClick={() => api.appBeenden()} title="Beendet den Netzwerkplaner, damit du die neue Version nach „Programme“ ziehen kannst. Vorher speichern!"><Power size={14} /> Netzwerkplaner beenden</button>}
          {update?.tag && !autoUpdate && !macUpdate && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Öffnet die Download-Seite."><Download size={14} /> {update.tag} herunterladen</button>}
          <button style={S.ghostBtn} onClick={() => api.openExternal(update?.url || RELEASES_URL)}>Alle Versionen auf GitHub</button>
          <span style={{ fontSize: 12, color: update ? "#2ecc71" : SUB }}>{updateStatus}</span>
        </div>
        {Object.entries(CHANGELOG).map(([v, items]) => <div key={v}><div className="sp-section-label">Version {v}{v === version ? " (installiert)" : ""}</div><ul style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}
      </Modal>}
      {showSitzung && <SitzungDialog sitzung={sitzung} projektName={P.meta.veranstaltung} onClose={() => setShowSitzung(false)} onKopieSpeichern={() => save(true)} />}
      {toast && <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#1b2026", border: `1px solid ${toast.kind === "err" ? ERR : toast.kind === "warn" ? WARN : ACCENT}`, color: "#e8eaed", padding: "9px 16px", borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,.5)", maxWidth: "80vw" }}>{toast.msg}</div>}
    </div>
  );
}
