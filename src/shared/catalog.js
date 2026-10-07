import KATALOG from "./data/katalog.json";
import { TYPEN } from "./constants.js";
import { modellIcon } from "./geraeteicons.js";
import { vlanNachVid } from "./qinq.js";

export { KATALOG };
export const uid = () => Math.random().toString(36).slice(2, 10);

/* ── Protokoll-Referenz ─────────────────────────────────────────────────
   Die Einträge kommen 1:1 aus der Protokollrecherche. Hier werden daraus
   Prüf-Eigenschaften abgeleitet (Multicast, Punkt-zu-Punkt, nur L2 …),
   damit die Regeln automatisch mitwachsen, wenn die Tabelle überarbeitet wird. */
const low = (s) => (s || "").toLowerCase();

const deriveFlags = (p) => {
  const sw = low(p["Über Switch / routbar?"]);
  const mc = low(p["Multicast / Broadcast"]);
  const req = low(p["Netzwerk-Anforderungen"]);
  const schicht = low(p["Schicht / Transport"]);
  const p2p = /^nein/.test(sw) || (/paneldaten nein/.test(sw));
  return {
    p2p,
    kein_ip: /kein ip/.test(schicht) || /serielle/.test(sw),
    multicast: /multicast|239\.|224\./.test(mc) && !/^–$/.test(mc),
    igmp: /igmp/.test(req) || /igmp/.test(mc),
    ptp: /ptp/.test(low(p["Takt / Sync"])) || /ptp/.test(req),
    eee: /eee/.test(req),
    l2: /nur (dediziertes )?l2|nur spezielle switches/.test(sw),
    lokal: /lokal/.test(sw),
    geprueft: /geprüft/.test(low(p.Datenstand)),
  };
};

// Namen, unter denen ein Protokoll in Gerätelisten auftaucht
const namesFor = (name) => {
  const base = name.replace(/\(.*?\)/g, " ").split(/\s\/\s|,/).map((s) => s.trim()).filter(Boolean);
  const inParens = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  return [...base, ...inParens, name].map(low).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 2);
};

// Handgepflegte Zuordnungen für Schreibweisen aus dem Hardwarekatalog
const ALIAS = {
  "art-net": "Art-Net 4", "sacn": "sACN (Streaming ACN)", "e1.31": "sACN (Streaming ACN)",
  "slink": "SLink / gigaACE / DX / dSnake", "gigaace": "SLink / gigaACE / DX / dSnake", "dx": "SLink / gigaACE / DX / dSnake",
  "fibreace": "SLink / gigaACE / DX / dSnake", "optocore": "Optocore / SANE", "chamsys net": "ChamSys MagicQ Netzwerk",
  "etcnet3": "ETCNet3 / Eos-Netzwerk", "ndi|hx": "NDI (NDI 5/6, HX)", "ndi": "NDI (NDI 5/6, HX)", "ptp": "PTP (Precision Time Protocol)",
  "citp": "CITP / MSEx", "osc": "OSC (Open Sound Control)", "hdbaset": "HDBaseT", "psn": "PSN (PosiStageNet)",
  "rtmp": "RTMP / RTSP / HLS / WebRTC", "rtsp": "RTMP / RTSP / HLS / WebRTC", "rtp/rtsp": "RTMP / RTSP / HLS / WebRTC",
  "nmos": "NMOS IS-04 / IS-05 / IS-07", "atem-protokoll": "Blackmagic ATEM / HyperDeck / Videohub",
  "hyperdeck ethernet protocol": "Blackmagic ATEM / HyperDeck / Videohub", "videohub ethernet protocol": "Blackmagic ATEM / HyperDeck / Videohub",
  "barco event master json-rpc api": "Barco Event Master / E2 JSON-RPC", "novastar-protokoll": "LED-Prozessoren (Novastar, Brompton, Colorlight)",
  "brompton-protokoll": "LED-Prozessoren (Novastar, Brompton, Colorlight)", "clear-com ip": "Clear-Com (FreeSpeak, HelixNet, Eclipse)",
  "green-go": "Green-GO", "shure command strings": "Shure Command Strings", "midi over tcp": "RTP-MIDI (AppleMIDI)",
  "panasonic ptz-protokoll": "Panasonic AW (PTZ)", "yamaha": "Yamaha RCP / SCP", "l-net": "L-Acoustics Netzwerk",
  "kinesys-protokoll": "Industrie-Ethernet (Profinet, EtherCAT, Modbus TCP)",
};

export const PROTOKOLLE = KATALOG.protokolle.map((p, i) => ({
  id: "p" + i,
  name: p.Protokoll,
  kategorie: p.Kategorie,
  raw: p,
  flags: deriveFlags(p),
  names: namesFor(p.Protokoll),
}));
const PROTO_BY_NAME = Object.fromEntries(PROTOKOLLE.map((p) => [p.name, p]));

const cache = new Map();
// Gerätestring (z. B. "Dante (Karte)", "sACN (E1.31)") → Referenzeintrag oder null
export const findProtokoll = (s) => {
  if (!s) return null;
  if (cache.has(s)) return cache.get(s);
  const clean = low(s).replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const full = low(s).trim();
  let hit = PROTO_BY_NAME[s] || null;
  if (!hit) for (const k of [full, clean]) if (ALIAS[k]) { hit = PROTO_BY_NAME[ALIAS[k]]; break; }
  if (!hit) hit = PROTOKOLLE.find((p) => p.names.includes(clean) || p.names.includes(full)) || null;
  if (!hit && clean.length >= 3) {
    const pref = Object.keys(ALIAS).find((k) => clean.startsWith(k + " ") || clean.startsWith(k + "-"));
    if (pref) hit = PROTO_BY_NAME[ALIAS[pref]];
  }
  if (!hit && clean.length >= 4) hit = PROTOKOLLE.find((p) => p.names.some((n) => n.length >= 4 && (clean.startsWith(n) || n.startsWith(clean)))) || null;
  cache.set(s, hit);
  return hit;
};

export const protoFlags = (list) => (list || []).map(findProtokoll).filter(Boolean);

/* ── Gerätekatalog ─────────────────────────────────────────────────────── */
const TYP_RULES = [
  [/Switch|Glasfaser-Netzwerkknoten/i, "switch_managed"],
  [/Router|Firewall/i, "router"],
  [/WLAN/i, "wlan"],
  [/Lichtpult|Bedienwing|Bedienerweiterung|Processing Unit/i, "lichtpult"],
  [/LED-Kachel|LED-Pixel/i, "scheinwerfer"],
  [/USB-DMX|DMX-Node|I\/O-Node|Pixel-Controller|Pixel-Gateway|DMX-over-IP|DMX-Splitter|DMX-Router|Art-Net-Node|Versorgungseinheit/i, "node"],
  [/Karte|OEM-Modul|Netzwerk-Adapter|Audio-Interface|Dante-Interface/i, "stagebox"],
  [/Software/i, "pc"],
  [/Dimmer/i, "dimmer"],
  [/Moving Head|LED-Wash/i, "scheinwerfer"],
  [/Bildprozessor|LED-Prozessor|LED-Video|LED-Controller/i, "ledproc"],
  [/Mischpult/i, "mischpult"],
  [/Stagebox|I\/O|Audio-Netzwerk-Interface/i, "stagebox"],
  [/Funk|In-Ear|Array-Mikrofon/i, "funk"],
  [/Endstufe|Verstärker/i, "verstaerker"],
  [/Prozessor|DSP/i, "controller"],
  [/Intercom|Sprechstelle/i, "intercom"],
  [/PTZ-Controller/i, "steuerung"],
  [/Kamera/i, "kamera"],
  [/Projektor/i, "projektor"],
  [/Videomischer|Live-Produktion|Kreuzschiene|IP-Video-Konverter/i, "videomischer"],
  [/Medienserver|Recorder/i, "medienserver"],
  [/Motorsteuerung/i, "rigging"],
  [/PC|Workstation/i, "pc"],
];
export const typFuerGeraetetyp = (t) => (TYP_RULES.find(([re]) => re.test(t || "")) || [null, "sonstiges"])[1];

const ANW_KAT = [[/Intercom/i, "Intercom"]];
const katFuer = (g) => {
  for (const [re, k] of ANW_KAT) if (re.test(g.Gerätetyp)) return k;
  const a = (g.Anwendung || "").split("/")[0].trim();
  return { Ton: "Ton", Licht: "Licht", Bild: "Bild", Netzwerk: "Netzwerk", Bühne: "Bühne" }[a] || "Sonstiges";
};

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const KATALOG_GERAETE = KATALOG.geraete.map((g) => ({
  id: `k-${slug(g.Hersteller)}-${slug(g.Modell)}`, // stabil, damit Projekte auch nach einem Katalog-Update ihr Modell finden
  fokus: g.Fokus === "Ja",
  hersteller: g.Hersteller,
  modell: g.Modell,
  geraetetyp: g.Gerätetyp,
  typ: typFuerGeraetetyp(g.Gerätetyp),
  kategorie: katFuer(g),
  icon: modellIcon(g.Hersteller, g.Modell) || TYPEN[typFuerGeraetetyp(g.Gerätetyp)]?.icon || "sonstiges", // Modell-Icon, sonst das des Typs
  raw: g,
}));

/* Ports aus „Netzwerkports (Details)“ ableiten. Beispiel:
   "2× etherCON (Dante Pri/Sec), 1× RJ45 Network" → Primary, Secondary, Network */
const P2P_RE = /AES50|YDIF|Ultranet|SLink|gigaACE|fibreACE|\bDX\b|HDBaseT|DIGITAL LINK|TWINLANe|Ring|P3-Link|StageConnect|EtherSound/i;
const portTyp = (s) => (/SFP28/i.test(s) ? "SFP28" : /SFP\+/i.test(s) ? "SFP+" : /SFP|Glas|opticalCON/i.test(s) ? (/opticalCON/i.test(s) ? "opticalCON" : "SFP") : /etherCON/i.test(s) ? "etherCON" : "RJ45");

export const parsePorts = (details, anzahl, isSwitch) => {
  const ports = [];
  // Mehrere Modellvarianten ("GC10: …; GC30i: …") → nur die erste Variante
  let det = details || "";
  const parts = det.split(";").map((x) => x.trim());
  if (parts.length > 1 && /^[^:×]{1,24}:/.test(parts[0])) det = parts[0].replace(/^[^:×]{1,24}:\s*/, "");
  const segs = det.split(/[,;]|\s\+\s/);
  for (const seg of segs) {
    const m = seg.match(/(\d+)\s*×\s*(.*)$/);
    if (!m) continue;
    let n = Math.min(+m[1], 52);
    const d = m[2];
    const p2p = P2P_RE.test(d) && !/Dante|Network|Steuerung|Management/i.test(d);
    const typ = portTyp(d);
    let names;
    if (n === 2 && /Pri\s*\/\s*Sec|Primary\s*\/\s*Secondary/i.test(d)) names = ["Primary", "Secondary"];
    else {
      const role = (d.match(/\b(Network|Steuerung|Management|Remote|Dante|AES50|LAN|WAN|Uplink)\b/i) || [])[1];
      names = Array.from({ length: n }, (_, k) => (role && !isSwitch ? (n > 1 ? `${role} ${k + 1}` : role) : null));
    }
    for (let k = 0; k < n; k++) ports.push({ name: names[k], typ, p2p });
  }
  if (!ports.length) {
    const n = Math.min(+(String(anzahl || "").match(/\d+/) || [isSwitch ? 8 : 1])[0], 52);
    const typ = portTyp(details || "");
    for (let k = 0; k < n; k++) ports.push({ name: null, typ, p2p: false });
  }
  return ports.map((p, i) => ({ ...p, name: kurzerPortName(p.name || (isSwitch ? String(i + 1) : ports.length > 1 ? `LAN ${i + 1}` : "LAN")) }));
};

/* Anschlussnamen höchstens 10 Zeichen (Platz in der Ansicht „Anschlüsse“).
   Längere Namen werden erst gekürzt (Steuerung → Strg …), dann abgeschnitten. */
export const PORTNAME_MAX = 10;
const KUERZEL = [[/Steuerung/i, "Strg"], [/Management/i, "Mgmt"], [/Secondary/i, "Sec"], [/Primary/i, "Pri"], [/Network/i, "Net"], [/Ethernet/i, "Eth"], [/Control/i, "Ctrl"]];
export const kurzerPortName = (n) => {
  let s = String(n ?? "");
  if (s.length <= PORTNAME_MAX) return s;
  for (const [re, k] of KUERZEL) { s = s.replace(re, k); if (s.length <= PORTNAME_MAX) return s; }
  return s.slice(0, PORTNAME_MAX);
};

export const splitProtokolle = (s) =>
  (s || "").split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => x && x !== "–");

/* ── Neues Gerät (aus Katalogmodell oder generischem Typ) ───────────────── */
/* Ein Port ist zugleich das Interface des Geräts: Name, VLAN und IP-Daten
   liegen direkt am Port. Bei Switches gilt vlan als Access-VLAN des Ports.
   virtuell: Anschluss ohne eigene Buchse (Management-Interface eines Switches),
   hat IP-Daten, lässt sich aber nicht verkabeln. */
export const newPort = (o = {}) => ({
  id: uid(), name: "", typ: o.virtuell ? "" : "RJ45", modus: "access", vlan: null, vlans: [], poe: false, p2p: false, virtuell: false,
  ip: "", prefix: 24, gateway: "", mac: "", dhcp: false, ...o,
});
// Anschlüsse mit Buchse (verkabelbar, auf der Frontplatte)
/* Geräte aus dem Katalog (Herstellermodell) oder aus dem Gerätebestand haben feste
   Hardware: Ports, Buchsen und Netzwerkkarten ändert man nur über „Modell zuweisen“
   oder im Katalog. Einstellbar bleiben VLAN (nur Switches), IP, Modus, PoE je Port und alles Übrige. */
export const hardwareFest = (d) => !!d && !d.generisch && !!(d.katalogId || d.bestandId);
export const physPorts = (d) => (d.ports || []).filter((p) => !p.virtuell);
// Anschlüsse mit IP-Konfiguration: bei Endgeräten jeder Ethernet-Port, bei Switches die Management-Anschlüsse
export const ipPorts = (d) => (d.ports || []).filter((p) => p.virtuell || p.ip || p.dhcp || (!d.isSwitch && !p.p2p));

/* Ältere Geräte (Projekt, Vorlage, Bestand) hatten Ports und Interfaces getrennt.
   Jedes Interface wandert auf den ersten Port, der es nutzt; weitere Ports desselben
   Interfaces bekommen VLAN, Maske und Gateway (ohne IP/MAC, sonst gäbe es IP-Konflikte).
   Interfaces ohne Port (z. B. Management eines Switches) werden virtuelle Anschlüsse.
   Verweise (Web-UI, Datenströme) zeigen danach auf den Port. Ändert g und gibt es zurück. */
const GENERISCHER_NAME = /^(LAN|ETH|Port)?\s*\d*$/i;
export const migrateGeraet = (g) => {
  if (!Array.isArray(g.interfaces)) { g.ports = (g.ports || []).map((p) => newPort(p)); return g; }
  const ifs = g.interfaces, idMap = {}, anzahl = {}; // anzahl: Ports je Interface
  const ifVon = (p) => (!g.isSwitch && p.iface ? ifs.find((i) => i.id === p.iface) : null);
  for (const p of g.ports || []) { const i = ifVon(p); if (i) anzahl[i.id] = (anzahl[i.id] || 0) + 1; }
  const ports = (g.ports || []).map((p) => {
    const i = ifVon(p);
    const { iface, ...rest } = p;
    if (!i) return newPort(rest);
    const erster = !idMap[i.id];
    if (erster) idMap[i.id] = p.id;
    const q = newPort({ ...rest, prefix: i.prefix ?? 24, gateway: i.gateway || "", ip: erster ? i.ip || "" : "", mac: erster ? i.mac || "" : "", dhcp: erster && !!i.dhcp });
    if (i.vlan != null || i.vid != null) { q.vlan = i.vlan ?? null; if ("vid" in i) q.vid = i.vid; }
    // Sprechender Interface-Name (z. B. „Steuerung“, „Dante“) ersetzt einen generischen Portnamen („LAN 1“)
    if (erster && i.name && (anzahl[i.id] === 1 || !GENERISCHER_NAME.test(i.name)) && GENERISCHER_NAME.test(p.name || "")) q.name = i.name;
    return q;
  });
  for (const i of ifs) {
    if (idMap[i.id]) continue;
    const leer = !i.ip && !i.mac && !i.dhcp && !i.gateway && !i.vlan && i.vid == null;
    if (!g.isSwitch && leer) continue; // leeres Interface ohne Port (z. B. bei reinen P2P-Geräten)
    const { id, name, ...daten } = i;
    ports.push(newPort({ ...daten, id, name: name || "Management", virtuell: true }));
    idMap[id] = id;
  }
  g.ports = ports;
  delete g.interfaces;
  if (g.webUi) g.webUi = { ...g.webUi, iface: idMap[g.webUi.iface] || null };
  if (g.stroeme) g.stroeme = g.stroeme.map((s) => (s.iface ? { ...s, iface: idMap[s.iface] || null } : s));
  return g;
};

// Vorlagen und Bestand der Bibliothek auf Ports mit IP-Daten umstellen
const bibEintrag = (e) => (e?.geraet ? { ...e, geraet: migrateGeraet(JSON.parse(JSON.stringify(e.geraet))) } : e);
export const migrateBibliothek = (l) => ({ ...l, vorlagen: (l.vorlagen || []).map(bibEintrag), bestand: (l.bestand || []).map(bibEintrag) });
export const migrateBestand = (liste) => (liste || []).map(bibEintrag);

/* Gerät für Bibliothek (Vorlage oder Bestand) sichern. VLANs gibt es nur an Switch-Ports;
   sie werden über ihre VLAN-ID (vid) gemerkt, weil die internen IDs in jedem Projekt
   anders sind. Endgeräte werden ohne VLAN gesichert, ihr VLAN kommt im Projekt vom Switch. */
export const snapshotDevice = (dev, vlans = []) => {
  const g = JSON.parse(JSON.stringify(dev));
  const vid = (id) => vlans.find((v) => v.id === id)?.vid ?? null;
  for (const p of g.ports) {
    if (!dev.isSwitch) { p.vlan = null; p.vlans = []; p.vid = null; p.vids = []; continue; }
    p.vid = vid(p.vlan); p.vids = (p.vlans || []).map(vid).filter((x) => x != null);
  }
  for (const s of g.stroeme || []) s.ziele = [];
  delete g.bestandId;
  // Genutzte VLANs mitsichern, damit sie beim Einfügen in ein Projekt ohne diese VLAN-ID angelegt werden
  const genutzt = new Set((dev.isSwitch ? dev.ports : []).flatMap((p) => [p.vlan, ...(p.vlans || [])]).filter(Boolean));
  g.vlanDefs = vlans.filter((v) => genutzt.has(v.id)).map(({ vid, name, farbe, subnetz, gateway, zweck, igmp, eeeAus, qos }) => ({ vid, name, farbe, subnetz, gateway, zweck, igmp, eeeAus, qos }));
  return g;
};

// Neue Geräte bekommen kein VLAN. VLANs werden nur an Switch-Ports gesetzt; Endgeräte
// übernehmen das VLAN im Projekt vom Switch-Port, an dem sie stecken (vlansAbleiten).
export const createDevice = ({ katalogId, typ, vlans = [], name, eigeneVorlage, mitAdressen = false }) => {
  const k = katalogId ? KATALOG_GERAETE.find((x) => x.id === katalogId) : null;
  const src = eigeneVorlage || null;
  if (src) {
    const d = JSON.parse(JSON.stringify(src.geraet));
    const idMap = {};
    const defs = d.vlanDefs || [];
    delete d.vlanDefs;
    // Fehlt im Projekt eine VLAN-ID, die das Gerät mitbringt: VLAN mit den gesicherten Daten anlegen
    const anlegen = (vid) => {
      const def = defs.find((x) => +x.vid === +vid);
      if (!def) return null;
      const v = { id: uid(), vid: +def.vid, name: def.name || `VLAN ${def.vid}`, farbe: def.farbe || "#9aa4af", subnetz: def.subnetz || "", gateway: def.gateway || "", zweck: def.zweck || "",
        igmp: !!def.igmp, querier: "", eeeAus: !!def.eeeAus, qos: !!def.qos, dhcp: { aktiv: false, von: "", bis: "" }, notiz: "", svlan: null };
      vlans.push(v);
      return v.id;
    };
    // VLAN über die VLAN-ID zuordnen; ältere Vorlagen ohne vid behalten die ID, falls sie existiert
    const map = (oldId, vid) => (!d.isSwitch ? null : vid != null ? vlanNachVid(vlans, vid)?.id || anlegen(vid) : vlans.some((v) => v.id === oldId) ? oldId : null);
    migrateGeraet(d); // ältere Vorlagen mit getrennten Interfaces
    d.ports = d.ports.map((p) => {
      const { vid, vids, ...rest } = p;
      const nid = uid(); idMap[p.id] = nid;
      return { ...rest, id: nid, vlan: map(p.vlan, vid), vlans: !d.isSwitch ? [] : vids ? vids.map((x) => map(null, x)).filter(Boolean) : (p.vlans || []).filter((id) => vlans.some((v) => v.id === id)),
        ip: mitAdressen ? p.ip || "" : "", mac: mitAdressen ? p.mac || "" : "" };
    });
    if (d.webUi) d.webUi.iface = d.webUi.iface ? idMap[d.webUi.iface] || null : null;
    d.stroeme = (d.stroeme || []).map((s) => ({ ...s, id: uid(), ziele: [], iface: s.iface ? idMap[s.iface] || null : null }));
    return { ...d, id: uid(), name: name || d.name };
  }
  const t = typ || k?.typ || "sonstiges";
  const T = TYPEN[t] || TYPEN.sonstiges;
  const kat = k?.kategorie || T.kat;
  const isSwitch = !!T.isSwitch;

  const rawPorts = k ? parsePorts(k.raw["Netzwerkports (Details)"], k.raw["Netzwerkports (Anzahl)"], isSwitch)
                     : Array.from({ length: T.ports }, (_, i) => ({ name: isSwitch ? String(i + 1) : T.ports > 1 ? `LAN ${i + 1}` : "LAN", typ: "RJ45", p2p: false }));

  const ports = rawPorts.map((p) => newPort({ name: p.name, typ: p.typ, p2p: p.p2p }));
  if (isSwitch && !T.unmanaged) ports.push(newPort({ name: "Management", virtuell: true }));

  const webRaw = k?.raw["Web-UI"] || "";
  const web = k ? /^(Ja|Teilweise)/.test(webRaw) : !!T.web || isSwitch && !T.unmanaged;
  const poe = k ? /^Ja/.test(k.raw.PoE || "") : false;

  return {
    id: uid(),
    name: name || (k ? k.modell : T.label),
    typ: t,
    kategorie: kat,
    hersteller: k?.hersteller || "",
    modell: k?.modell || "",
    katalogId: k?.id || null,
    icon: (k && modellIcon(k.hersteller, k.modell)) || TYPEN[t]?.icon || "sonstiges",
    bereich: "",
    isSwitch,
    poeBudget: isSwitch ? (poe && +k?.raw["PoE-Budget W"]) || 0 : undefined, // Budget aus dem Katalog, 0 = keine Prüfung
    poeBedarf: !isSwitch && poe ? 13 : 0,
    poePse: isSwitch && poe,
    ports,
    webUi: { vorhanden: web, url: "http://{ip}", iface: ipPorts({ isSwitch, ports })[0]?.id || null },
    protokolle: k ? splitProtokolle(k.raw.Protokolle) : [],
    notizen: "",
  };
};

/* Vorhandenes Gerät nachträglich auf ein Katalogmodell / eine Vorlage umbauen.
   Name, Netzwerkname, eigene Felder, Standort, Notizen, IPs (je IP-Anschluss in Reihenfolge)
   und alle Verbindungen bleiben erhalten; Ports, Protokolle, Web-UI, Icon und
   Herstellerdaten kommen aus dem neuen Modell. Verbundene Ports, die das neue
   Modell nicht hat, werden angehängt statt gelöscht. */
// ausBestand: Gerät aus dem eigenen Gerätebestand – dessen feste IPs, Name, Netzwerkname
// und eigene Felder gelten, vom alten Gerät bleiben nur Position und Verbindungen.
export const geraetUmbauen = (P, devId, neu, { ausBestand = false } = {}) => {
  const dev = P.geraete.find((g) => g.id === devId);
  if (!dev) return null;
  // IP-Daten je IP-Anschluss in Reihenfolge übernehmen; was nicht passt und eine Adresse hat, bleibt als virtueller Anschluss
  const uebrig = [];
  if (!ausBestand) {
    const ziele = ipPorts(neu);
    ipPorts(dev).forEach((o, n) => {
      const i = ziele[n];
      if (i) Object.assign(i, { ip: o.ip, prefix: o.prefix || i.prefix, gateway: o.gateway, mac: o.mac, dhcp: o.dhcp, ...(neu.isSwitch ? { vlan: o.vlan || i.vlan } : {}) });
      else if (o.ip || o.dhcp) uebrig.push(o);
    });
  }
  const belegt = new Set(P.verbindungen.flatMap((c) => [c.a, c.b]).filter((e) => e.dev === devId).map((e) => e.port));
  const portMap = {};
  const neuPhys = physPorts(neu);
  physPorts(dev).forEach((p, n) => {
    const np = neuPhys[n];
    if (np) {
      portMap[p.id] = np.id;
      if (dev.isSwitch && neu.isSwitch) Object.assign(np, { modus: p.modus, vlan: p.vlan, vlans: p.vlans, poe: p.poe ?? np.poe });
    } else if (belegt.has(p.id)) { neu.ports.push({ ...p }); portMap[p.id] = p.id; }
  });
  for (const o of uebrig) if (!portMap[o.id]) neu.ports.push({ ...o, typ: "", virtuell: true });
  for (const c of P.verbindungen) for (const e of [c.a, c.b]) if (e.dev === devId && portMap[e.port]) e.port = portMap[e.port];
  // Bei generischen Funden (Discovery) die erkannten Protokolle behalten
  if (dev.generisch) neu.protokolle = [...new Set([...(neu.protokolle || []), ...(dev.protokolle || [])])];
  const bleibt = ausBestand
    ? { id: dev.id, bereich: neu.bereich || dev.bereich, stroeme: [] }
    : { id: dev.id, name: dev.name, netzname: dev.netzname || "", felder: dev.felder || [], bestandId: dev.bestandId, bereich: dev.bereich, notizen: dev.notizen, stroeme: [] };
  for (const k of Object.keys(dev)) delete dev[k];
  Object.assign(dev, neu, bleibt);
  if (!dev.bestandId) delete dev.bestandId;
  return dev;
};
