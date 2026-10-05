import { doppelteBestandsgeraete } from "./bestandschluessel.js";
import { STANDARD_VLANS, DEFAULT_BEREICHE, KABEL } from "./constants.js";
import { uid, findProtokoll, migrateGeraet, physPorts, ipPorts } from "./catalog.js";
import { ip2int, int2ip, parseCidr, inSubnet, subnetsOverlap, nextFreeIp, DEFAULT_RANGES, isValidMac } from "./net.js";
import { qinqIssues } from "./qinq.js";
import { migrateFelder } from "./felder.js";

export const clone = (x) => JSON.parse(JSON.stringify(x));

export const newVlan = (o = {}) => ({
  id: uid(), vid: 1, name: "", farbe: "#9aa4af", subnetz: "", gateway: "", zweck: "",
  igmp: false, querier: "", eeeAus: false, qos: false, dhcp: { aktiv: false, von: "", bis: "" }, notiz: "", svlan: null, ...o,
});

export const standardVlans = () => STANDARD_VLANS.map((v) => newVlan(clone(v)));

export const emptyProject = () => ({
  format: "netzwerkplaner",
  version: 1,
  meta: { veranstaltung: "Veranstaltung 2026", ort: "", ersteller: "", datum: new Date().toISOString().slice(0, 10), version: "1", notiz: "" },
  bereiche: [...DEFAULT_BEREICHE],
  standortInfo: {}, // Standortname → { anmerkung }: erscheint nur in der Clean-Cat-Ansicht
  vlans: standardVlans(),
  geraete: [],
  verbindungen: [],
  layout: { rootId: null, offsets: {}, collapsed: {} },
  icons: [],
  vlanVomSwitch: true, // VLANs nur an Switches (seit 0.7.0-beta.8)
});

// Ältere oder unvollständige Projektdateien auf den aktuellen Stand bringen
export const migrateProject = (p) => {
  const e = emptyProject();
  const out = { ...e, ...p, meta: { ...e.meta, ...(p.meta || {}) }, layout: { ...e.layout, ...(p.layout || {}) } };
  out.vlans = (p.vlans || []).map((v) => newVlan({ ...v, dhcp: { aktiv: false, von: "", bis: "", ...(v.dhcp || {}) } }));
  // Ports und Interfaces waren früher getrennt: migrateGeraet führt sie zusammen
  out.geraete = (p.geraete || []).map((d) => migrateGeraet(migrateFelder({
    kategorie: "Sonstiges", bereich: "", protokolle: [], notizen: "", webUi: { vorhanden: false, url: "http://{ip}", iface: null },
    poeBedarf: 0, poeBudget: 0, stroeme: [], netzname: "", ...d,
  })));
  if (out.layout.titel === "inventar") out.layout.titel = "feld:inventar-nr"; // frühere Titel-Option „Inventar-Nr.“
  out.verbindungen = (p.verbindungen || []).filter((c) => c.a && c.b).map((c) => ({ kabel: "cat6", laenge: "", label: "", notiz: "", ...c }));
  out.bereiche = p.bereiche || e.bereiche;
  out.standortInfo = p.standortInfo && typeof p.standortInfo === "object" ? p.standortInfo : {};
  out.icons = p.icons || [];
  out.vlanVomSwitch = !!p.vlanVomSwitch;
  return vlansAbleiten(out);
};

/* ── VLAN der Endgeräte ───────────────────────────────────────────────────
   VLANs werden nur an Switches eingestellt. Ein Port eines Endgeräts bekommt sein VLAN
   vom Access-Port des Switches, an dem er steckt (auch über unmanaged Switches hinweg).
   Steckt er nirgends oder an einem Trunk, gilt das VLAN, in dessen Subnetz seine IP liegt. */
const managedSw = (d) => d?.isSwitch && d.typ !== "switch_unmanaged";
export const vlanQuelle = (P, X, dev, port) => {
  if (!dev || dev.isSwitch || port.p2p) return null;
  const besucht = new Set([dev.id]);
  let ends = (X.connsByPort.get(`${dev.id}:${port.id}`) || []).map((c) => otherEnd(c, dev.id));
  let trunk = null;
  while (ends.length) {
    const next = [];
    for (const e of ends) {
      const r = X.portRef.get(`${e.dev}:${e.port}`);
      if (!r || besucht.has(r.dev.id)) continue;
      besucht.add(r.dev.id);
      if (managedSw(r.dev)) {
        if (r.port.modus === "trunk") { trunk = trunk || r; continue; }
        if (r.port.vlan && X.vlanById.has(r.port.vlan)) return { vlan: r.port.vlan, art: "switch", sw: r.dev, swPort: r.port };
        return { vlan: null, art: "switch-ohne", sw: r.dev, swPort: r.port };
      }
      if (r.dev.isSwitch) for (const p of physPorts(r.dev)) for (const c of X.connsByPort.get(`${r.dev.id}:${p.id}`) || []) next.push(otherEnd(c, r.dev.id));
    }
    ends = next;
  }
  if (port.ip) {
    const v = P.vlans.find((x) => x.subnetz && inSubnet(port.ip, x.subnetz));
    if (v) return { vlan: v.id, art: "ip", sw: trunk?.dev, swPort: trunk?.port };
  }
  return trunk ? { vlan: null, art: "trunk", sw: trunk.dev, swPort: trunk.port } : null;
};

/* Setzt das VLAN aller Endgeräte-Ports nach den Switches (in place, gibt P zurück) */
export const vlansAbleiten = (P) => {
  const X = buildIndex(P);
  // Einmalig für ältere Projekte: VLAN des Endgeräts auf den leeren Access-Port des Switches übernehmen
  if (!P.vlanVomSwitch) {
    for (const d of P.geraete) if (!d.isSwitch) for (const p of physPorts(d)) {
      if (!p.vlan || !X.vlanById.has(p.vlan)) continue;
      for (const c of X.connsByPort.get(`${d.id}:${p.id}`) || []) {
        const r = X.portRef.get(`${otherEnd(c, d.id).dev}:${otherEnd(c, d.id).port}`);
        if (managedSw(r?.dev) && r.port.modus !== "trunk" && !r.port.vlan) r.port.vlan = p.vlan;
      }
    }
    P.vlanVomSwitch = true;
  }
  for (const d of P.geraete) {
    if (d.isSwitch) continue;
    for (const p of d.ports) {
      const q = vlanQuelle(P, X, d, p);
      const neu = q?.vlan || null;
      if ((p.vlan || null) === neu) continue;
      p.vlan = neu;
      const v = X.vlanById.get(neu);
      const pr = v && parseCidr(v.subnetz)?.prefix;
      if (pr != null && !p.ip) p.prefix = pr;
    }
  }
  return P;
};

/* ── Index über das Projekt ────────────────────────────────────────────── */
export const buildIndex = (P) => {
  const devById = new Map(P.geraete.map((d) => [d.id, d]));
  const vlanById = new Map(P.vlans.map((v) => [v.id, v]));
  const portRef = new Map(); // "dev:port" → { dev, port }
  for (const d of P.geraete) for (const p of d.ports) portRef.set(`${d.id}:${p.id}`, { dev: d, port: p });
  const connsByPort = new Map();
  const connsByDev = new Map();
  for (const c of P.verbindungen) {
    for (const end of [c.a, c.b]) {
      const k = `${end.dev}:${end.port}`;
      if (!connsByPort.has(k)) connsByPort.set(k, []);
      connsByPort.get(k).push(c);
      if (!connsByDev.has(end.dev)) connsByDev.set(end.dev, []);
      connsByDev.get(end.dev).push(c);
    }
  }
  return { devById, vlanById, portRef, connsByPort, connsByDev };
};

export const otherEnd = (c, devId) => (c.a.dev === devId ? c.b : c.a);
export const thisEnd = (c, devId) => (c.a.dev === devId ? c.a : c.b);

export const vlanLabel = (v) => (v ? `${v.vid} ${v.name}` : "–");

// Welche VLANs laufen über eine Verbindung?
export const connVlan = (c, X) => {
  const side = (end) => {
    const r = X.portRef.get(`${end.dev}:${end.port}`);
    if (!r) return null;
    const { dev, port } = r;
    if (dev.isSwitch && dev.typ !== "switch_unmanaged") {
      if (port.modus === "trunk") return { kind: "trunk", vlans: port.vlans || [], sw: true };
      return { kind: "access", vlans: port.vlan ? [port.vlan] : [], sw: true };
    }
    return { kind: "access", vlans: port.vlan ? [port.vlan] : [], sw: false, ifc: port };
  };
  const A = side(c.a), B = side(c.b);
  if (!A || !B) return { kind: "none", vlans: [] };
  if (A.kind === "trunk" && B.kind === "trunk") return { kind: "trunk", vlans: A.vlans.filter((v) => B.vlans.includes(v)), A, B };
  const acc = [A, B].find((s) => s.sw && s.kind === "access" && s.vlans.length) || [A, B].find((s) => s.kind === "access" && s.vlans.length);
  if (acc) return { kind: "access", vlans: acc.vlans, A, B };
  const tr = [A, B].find((s) => s.kind === "trunk");
  if (tr) return { kind: "trunk", vlans: tr.vlans, A, B };
  return { kind: "none", vlans: [], A, B };
};

export const isP2PConn = (c, X) => {
  if (c.kabel === "p2p") return true;
  const pa = X.portRef.get(`${c.a.dev}:${c.a.port}`)?.port;
  const pb = X.portRef.get(`${c.b.dev}:${c.b.port}`)?.port;
  return !!(pa?.p2p || pb?.p2p);
};

/* ── Ports & Adressen ──────────────────────────────────────────────────── */
export const freePort = (dev, X, preferP2P = false) => {
  const free = physPorts(dev).filter((p) => !(X.connsByPort.get(`${dev.id}:${p.id}`) || []).length);
  return free.find((p) => !!p.p2p === preferP2P) || free[0] || null;
};

export const usedIps = (P, exceptPortId) => {
  const s = new Set();
  for (const d of P.geraete) for (const i of ipPorts(d)) {
    if (i.id === exceptPortId) continue;
    const n = ip2int(i.ip);
    if (n !== null) s.add(n);
  }
  return s;
};

export const suggestIp = (P, vlan, exceptPortId) => {
  if (!vlan?.subnetz) return null;
  const used = usedIps(P, exceptPortId);
  const reserved = [vlan.gateway].filter(Boolean);
  // DHCP-Bereich nicht für statische Vorschläge verwenden
  const c = parseCidr(vlan.subnetz);
  if (vlan.dhcp?.aktiv && c) {
    const a = ip2int(vlan.dhcp.von), b = ip2int(vlan.dhcp.bis);
    if (a !== null && b !== null) for (let n = Math.max(a, c.first); n <= Math.min(b, c.last); n++) reserved.push(n);
  }
  // Bei /24 und größer die ersten 9 Adressen für Gateway/Infrastruktur freihalten
  if (c && c.hosts > 60) for (let n = c.first; n < c.first + 9; n++) reserved.push(n);
  return nextFreeIp(vlan.subnetz, used, reserved) || nextFreeIp(vlan.subnetz, used, [vlan.gateway].filter(Boolean));
};

export const webUrl = (dev) => {
  if (!dev.webUi?.vorhanden) return null;
  const ifc = dev.ports.find((i) => i.id === dev.webUi.iface) || ipPorts(dev).find((i) => i.ip);
  const tpl = dev.webUi.url || "http://{ip}";
  if (tpl.includes("{ip}") && !ifc?.ip) return null;
  return tpl.replace("{ip}", ifc?.ip || "");
};
export const mainIp = (dev) => (ipPorts(dev).find((i) => i.ip) || {}).ip || "";

/* ── Topologie-Baum (für das Mindmap-Layout) ──────────────────────────── */
export const pickRoot = (P, X) => {
  if (P.layout.rootId && X.devById.has(P.layout.rootId)) return P.layout.rootId;
  const deg = (d) => (X.connsByDev.get(d.id) || []).length;
  const sw = P.geraete.filter((d) => d.isSwitch).sort((a, b) => deg(b) - deg(a));
  if (sw.length) return sw[0].id;
  const all = [...P.geraete].sort((a, b) => deg(b) - deg(a));
  return all.length && deg(all[0]) ? all[0].id : null;
};

export const buildTree = (P, X) => {
  const children = new Map();
  const parent = new Map();
  const treeConn = new Map();
  const extra = [];
  const roots = [];
  const seen = new Set();
  const usedConn = new Set();
  const deg = (id) => (X.connsByDev.get(id) || []).length;

  // Phase 1 verzweigt nur über Switches (Endgeräte sind Blätter). So hängt z. B.
  // ein Dante-Secondary-Switch nicht als Kind an einer Stagebox, sondern bildet
  // ein eigenes Netz. Phase 2 hängt Ketten hinter Endgeräten an (Daisy-Chain).
  const isSw = (id) => !!X.devById.get(id)?.isSwitch;
  const bfs = (rootId, viaEndpoints = false, startQueue = null) => {
    if (!startQueue) { roots.push(rootId); seen.add(rootId); }
    const q = startQueue || [rootId];
    while (q.length) {
      const id = q.shift();
      if (!children.has(id)) children.set(id, []);
      if (!viaEndpoints && !isSw(id) && id !== rootId) continue;
      const conns = [...(X.connsByDev.get(id) || [])].sort((a, b) => {
        // Switches zuerst, dann nach Name
        const da = X.devById.get(otherEnd(a, id).dev), db = X.devById.get(otherEnd(b, id).dev);
        return (db?.isSwitch ? 1 : 0) - (da?.isSwitch ? 1 : 0) || (da?.name || "").localeCompare(db?.name || "", "de", { numeric: true });
      });
      for (const c of conns) {
        if (usedConn.has(c.id)) continue;
        const o = otherEnd(c, id).dev;
        if (viaEndpoints && isSw(o) && !seen.has(o)) continue; // Switches nie über Endgeräte anhängen
        usedConn.add(c.id);
        if (o === id || !X.devById.has(o)) continue;
        if (seen.has(o)) { extra.push(c); continue; }
        seen.add(o);
        parent.set(o, id);
        treeConn.set(o, c);
        children.get(id).push(o);
        q.push(o);
      }
    }
  };

  const island = (id) => {
    bfs(id);
    bfs(id, true, [...seen].filter((x) => !isSw(x)));
  };
  const r = pickRoot(P, X);
  if (r) island(r);
  // Weitere Inseln (nicht über Switches mit dem Core verbunden)
  const rest = () => P.geraete.filter((d) => !seen.has(d.id) && deg(d.id) > 0).sort((a, b) => (b.isSwitch - a.isSwitch) || deg(b.id) - deg(a.id));
  for (let d = rest()[0]; d; d = rest()[0]) island(d.id);
  // Übrige, noch nicht gezeichnete Verbindungen als Querverbindungen
  for (const c of P.verbindungen) if (!usedConn.has(c.id) && seen.has(c.a.dev) && seen.has(c.b.dev)) { usedConn.add(c.id); extra.push(c); }
  // Einheitlich für alle Geräte: Äste in Port-Reihenfolge des Elternteils (Port 1 oben),
  // so wie man aufbaut und wie die Patchliste sortiert
  const portNr = (eltern, kind) => {
    const c = treeConn.get(kind), d = X.devById.get(eltern);
    const e = c && (c.a.dev === eltern ? c.a : c.b.dev === eltern ? c.b : null);
    const i = e ? (d?.ports || []).findIndex((p) => p.id === e.port) : -1;
    return i < 0 ? 9999 : i;
  };
  for (const [id, ch] of children) ch.sort((a, b) => portNr(id, a) - portNr(id, b));
  const lose = P.geraete.filter((d) => !seen.has(d.id)).map((d) => d.id);
  return { roots, children, parent, treeConn, extra, lose };
};

export const subtreeIds = (T, id) => {
  const out = [id];
  for (let i = 0; i < out.length; i++) out.push(...(T.children.get(out[i]) || []));
  return out;
};

/* ── Prüfungen ─────────────────────────────────────────────────────────── */
const AOIP = /dante|aes67|ravenna|avb|milan|q-lan|soundgrid/i;
// Steuer-/Management-Ports tragen keine Medienströme, wenn das Gerät noch andere IP-Ports hat
const CTRL_IF = /steuer|manage|network|control|remote|mgmt|editor/i;
export const carriesMedia = (d, i) => !(ipPorts(d).length > 1 && CTRL_IF.test(i.name));

export const validate = (P, X) => {
  const issues = [];
  const add = (sev, msg, ref = {}) => issues.push({ sev, msg, ...ref });
  const vlanList = P.vlans;

  // Dasselbe Bestandsgerät (Inventar-Nr., Seriennummer oder MAC) mehrfach im Plan
  for (const grp of doppelteBestandsgeraete(P)) add("warn", `Dasselbe Bestandsgerät steht ${grp.length}× im Plan: ${grp.map((d) => `„${d.name}“`).join(", ")}.`, { dev: grp[1].id });

  // VLANs
  // Doppelte IDs sind erlaubt, wenn QinQ (IEEE 802.1ad) sie trennt
  issues.push(...qinqIssues(vlanList));
  for (const v of vlanList) {
    if (+v.vid < 1 || +v.vid > 4094) add("error", `VLAN „${v.name}“: ID ${v.vid} liegt außerhalb 1–4094.`, { vlan: v.id });
  }
  // Trunk-Port mit zwei VLANs gleicher ID: auf der Leitung nicht unterscheidbar
  for (const sw of P.geraete.filter((d) => d.isSwitch)) for (const p of sw.ports) {
    if (p.modus !== "trunk") continue;
    const seen = new Map();
    for (const id of p.vlans || []) {
      const v = X.vlanById.get(id);
      if (!v) continue;
      if (seen.has(+v.vid)) add("warn", `${sw.name} [${p.name}]: Trunk führt zweimal VLAN-ID ${v.vid} (${seen.get(+v.vid).name} / ${v.name}). Auf einem normalen Trunk sind die nicht zu unterscheiden; nur ein QinQ-Port (802.1ad) trennt sie über das S-Tag.`, { dev: sw.id, vlan: v.id });
      else seen.set(+v.vid, v);
    }
  }

  // Adressen
  const ipOwners = new Map();
  for (const d of P.geraete) {
    for (const i of ipPorts(d)) {
      const where = `${d.name} › ${i.name}`;
      if (i.mac && !isValidMac(i.mac)) add("warn", `${where}: MAC „${i.mac}“ hat kein gültiges Format.`, { dev: d.id });
      if (i.dhcp) {
        const v = X.vlanById.get(i.vlan);
        if (v && !v.dhcp?.aktiv) add("info", `${where} bezieht die Adresse per DHCP, im VLAN ${v.vid} ist DHCP aber nicht aktiviert.`, { dev: d.id });
        if (!i.ip) continue;
      }
      if (!i.ip) continue;
      const n = ip2int(i.ip);
      if (n === null) { add("error", `${where}: „${i.ip}“ ist keine gültige IPv4-Adresse.`, { dev: d.id }); continue; }
      if (!ipOwners.has(n)) ipOwners.set(n, []);
      ipOwners.get(n).push({ d, i });
      if (!X.vlanById.get(i.vlan)) add("warn", d.isSwitch ? `${where} (${i.ip}) ist keinem VLAN zugeordnet.` : `${where} (${i.ip}) hat kein VLAN: Der Switch-Port, an dem es steckt, hat keins, und die IP liegt in keinem VLAN-Subnetz.`, { dev: d.id });
    }
    if (d.webUi?.vorhanden && !webUrl(d)) add("info", `${d.name}: Web-UI ist eingetragen, aber es fehlt eine IP-Adresse für den Link.`, { dev: d.id });
  }
  for (const [n, owners] of ipOwners) if (owners.length > 1)
    add("error", `IP-Konflikt ${int2ip(n)}: ${owners.map((o) => `${o.d.name} › ${o.i.name}`).join(", ")}.`, { dev: owners[0].d.id, devs: owners.map((o) => o.d.id) });

  // Verbindungen
  for (const [k, list] of X.connsByPort) if (list.length > 1) {
    const r = X.portRef.get(k);
    if (r) add("error", `Port „${r.port.name}“ an ${r.dev.name} ist ${list.length}× belegt.`, { dev: r.dev.id, conn: list[1].id });
  }
  for (const c of P.verbindungen) {
    const ra = X.portRef.get(`${c.a.dev}:${c.a.port}`), rb = X.portRef.get(`${c.b.dev}:${c.b.port}`);
    if (!ra || !rb) { add("error", `Verbindung ${c.label || ""} zeigt auf einen gelöschten Port.`, { conn: c.id }); continue; }
    const name = `${ra.dev.name} [${ra.port.name}] ↔ ${rb.dev.name} [${rb.port.name}]`;
    if (isP2PConn(c, X) && (ra.dev.isSwitch || rb.dev.isSwitch))
      add("error", `${name}: Punkt-zu-Punkt-Verbindung (z. B. AES50, SLink, HDBaseT) endet an einem Switch. Diese Protokolle laufen nicht über Ethernet-Switches.`, { conn: c.id, dev: ra.dev.id });
    // Endgerät, das nur P2P-Protokolle spricht, hängt am Switch
    for (const [me, other] of [[ra, rb], [rb, ra]]) {
      if (!other.dev.isSwitch || me.dev.isSwitch) continue;
      const refs = (me.dev.protokolle || []).map(findProtokoll).filter(Boolean);
      if (refs.length && refs.every((p) => p.flags.p2p || p.flags.kein_ip))
        add("error", `${name}: ${me.dev.name} spricht laut Katalog nur Punkt-zu-Punkt-Protokolle (${me.dev.protokolle.join(", ")}).`, { conn: c.id, dev: me.dev.id });
    }
    const cv = connVlan(c, X);
    const A = cv.A, B = cv.B;
    if (A && B) {
      const sw = A.sw ? A : B.sw ? B : null, ep = A.sw ? (B.sw ? null : B) : A;
      if (sw && ep && ep.vlans.length) {
        if (sw.kind === "access" && sw.vlans.length && sw.vlans[0] !== ep.vlans[0])
          add("warn", `${name}: Switch-Port ist Access-VLAN ${X.vlanById.get(sw.vlans[0])?.vid}, das Gerät ist im VLAN ${X.vlanById.get(ep.vlans[0])?.vid} eingetragen.`, { conn: c.id, dev: ep === A ? ra.dev.id : rb.dev.id });
        if (sw.kind === "trunk" && !sw.vlans.includes(ep.vlans[0]))
          add("warn", `${name}: Trunk-Port erlaubt VLAN ${X.vlanById.get(ep.vlans[0])?.vid} nicht.`, { conn: c.id });
      }
      if (A.sw && B.sw && A.kind === "trunk" && B.kind === "trunk") {
        const a = new Set(A.vlans), b = new Set(B.vlans);
        const diff = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x)));
        if (diff.length) add("warn", `${name}: Trunk-VLANs unterscheiden sich an beiden Enden (${diff.map((id) => X.vlanById.get(id)?.vid).join(", ")}).`, { conn: c.id });
      }
      if (A.sw && B.sw && A.kind !== B.kind && (A.vlans.length || B.vlans.length))
        add("info", `${name}: Switch-zu-Switch-Verbindung mit Access auf einer und Trunk auf der anderen Seite.`, { conn: c.id });
    }
    const Ka = ra.port.typ, Kb = rb.port.typ;
    const fibre = (t) => /SFP|optical/i.test(t);
    if (fibre(Ka) !== fibre(Kb) && c.kabel !== "p2p") add("info", `${name}: ${Ka} ↔ ${Kb} – Medienkonverter oder passendes SFP-Modul einplanen.`, { conn: c.id });
  }

  // Protokolle je VLAN (Multicast → IGMP, Audio over IP → EEE aus / QoS)
  for (const v of vlanList) {
    const devs = P.geraete.filter((d) => !d.isSwitch && ipPorts(d).some((i) => i.vlan === v.id && carriesMedia(d, i)));
    const refs = new Map();
    for (const d of devs) for (const s of d.protokolle || []) { const r = findProtokoll(s); if (r) refs.set(r.name, r); }
    const mc = [...refs.values()].filter((r) => r.flags.igmp || r.flags.multicast && !r.flags.p2p);
    if (mc.length && !v.igmp) add("warn", `VLAN ${v.vid} ${v.name}: Multicast-Protokolle (${mc.slice(0, 4).map((r) => r.name).join(", ")}) ohne IGMP-Snooping/Querier.`, { vlan: v.id });
    const aoip = devs.some((d) => (d.protokolle || []).some((s) => AOIP.test(s)));
    if (aoip && !v.eeeAus) add("warn", `VLAN ${v.vid} ${v.name}: Audio over IP im VLAN – Energy Efficient Ethernet (802.3az) auf den Switches abschalten.`, { vlan: v.id });
    if (aoip && !v.qos) add("info", `VLAN ${v.vid} ${v.name}: Audio over IP ohne QoS (DSCP) geplant.`, { vlan: v.id });
  }
  const allRefs = new Set(P.geraete.flatMap((d) => (d.protokolle || []).map(findProtokoll).filter(Boolean).map((r) => r.name)));
  const dante = [...allRefs].some((n) => /^Dante$/.test(n)), aes67 = [...allRefs].some((n) => /AES67|RAVENNA|2110/.test(n));
  if (dante && aes67) add("info", "Dante und AES67/RAVENNA/ST 2110 im Projekt: unterschiedliche DSCP-Schemata (Dante 56/46/8, AES67 46/34) – ein gemeinsames QoS-Schema festlegen.", {});
  if (allRefs.has("HogNet") && dante) add("info", "HogNet (172.31.0.1) und Dante Secondary (172.31.x.x) nutzen denselben Default-Bereich – bei Default-Adressen trennen.", {});

  // PoE-Budget
  for (const d of P.geraete.filter((x) => x.isSwitch && +x.poeBudget > 0)) {
    let sum = 0;
    for (const p of d.ports) {
      if (!p.poe) continue;
      for (const c of X.connsByPort.get(`${d.id}:${p.id}`) || []) sum += +(X.devById.get(otherEnd(c, d.id).dev)?.poeBedarf || 0);
    }
    if (sum > +d.poeBudget) add("warn", `${d.name}: PoE-Bedarf ${sum} W übersteigt das Budget von ${d.poeBudget} W.`, { dev: d.id });
  }
  for (const d of P.geraete) {
    if (!+d.poeBedarf) continue;
    for (const c of X.connsByDev.get(d.id) || []) {
      const o = otherEnd(c, d.id), r = X.portRef.get(`${o.dev}:${o.port}`);
      if (r?.dev.isSwitch && !r.port.poe) add("info", `${d.name} braucht PoE (${d.poeBedarf} W), Port ${r.port.name} an ${r.dev.name} liefert laut Plan kein PoE.`, { dev: d.id, conn: c.id });
    }
  }

  const order = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.sev] - order[b.sev]);
};

export const kabelLabel = (k) => KABEL[k]?.label || k || "–";

/* ── Verbindung anlegen (arbeitet direkt auf einem Projekt-Entwurf) ─────── */
const portUsed = (P, devId, portId) => P.verbindungen.some((c) => (c.a.dev === devId && c.a.port === portId) || (c.b.dev === devId && c.b.port === portId));
export const freiePorts = (P, dev) => physPorts(dev).filter((p) => !portUsed(P, dev.id, p.id));
/* Freien Port wählen. Ein Gerät hat nur so viele Anschlüsse, wie es Ports hat:
   ist keiner frei, gibt es null (die Oberfläche fragt dann, welcher Anschluss ersetzt wird). */
const takePort = (P, dev, preferP2P, preferName, portId) => {
  const free = freiePorts(P, dev);
  if (portId) return free.find((p) => p.id === portId) || null;
  const byName = preferName && free.find((p) => p.name === preferName);
  const copper = (p) => !/SFP|optical/i.test(p.typ);
  return byName || free.find((p) => !!p.p2p === preferP2P && copper(p) && (dev.isSwitch || p.name !== "Secondary")) || free.find((p) => !!p.p2p === preferP2P && (dev.isSwitch || p.name !== "Secondary")) || free.find((p) => !!p.p2p === preferP2P) || free[0] || null;
};

export const addConnection = (P, fromId, toId, opts = {}) => {
  opts = { ...opts };
  const a = P.geraete.find((x) => x.id === fromId), b = P.geraete.find((x) => x.id === toId);
  if (!a || !b || a === b) return null;
  const p2p = !a.isSwitch && !b.isSwitch && a.ports.some((p) => p.p2p && !portUsed(P, a.id, p.id)) && b.ports.some((p) => p.p2p && !portUsed(P, b.id, p.id));
  const fib = (d) => physPorts(d).find((p) => /SFP|optical/i.test(p.typ) && !portUsed(P, d.id, p.id));
  const uplinkFib = a.isSwitch && b.isSwitch && !opts.portA && !opts.portB && !opts.portIdA && !opts.portIdB && fib(a) && fib(b);
  const pa = uplinkFib ? fib(a) : takePort(P, a, p2p, opts.portA, opts.portIdA);
  const pb = uplinkFib ? fib(b) : takePort(P, b, p2p, opts.portB, opts.portIdB);
  if (!pa || !pb) return null; // kein freier Anschluss
  if (uplinkFib && !opts.kabel) opts = { ...opts, kabel: "fiber_mm" };
  const c = { id: uid(), a: { dev: a.id, port: pa.id }, b: { dev: b.id, port: pb.id }, kabel: opts.kabel || (p2p ? "p2p" : "cat6"), laenge: opts.laenge || "", label: opts.label || "", notiz: "" };
  const managed = (d) => d.isSwitch && d.typ !== "switch_unmanaged";
  // Switch ↔ Switch: Trunk mit allen VLANs
  if (managed(a) && managed(b)) for (const p of [pa, pb]) if (!p.vlan) { p.modus = "trunk"; p.vlans = P.vlans.map((v) => v.id); }
  P.verbindungen.push(c);
  return c.id;
};

/* Standort überall umbenennen: in der Liste, an allen Geräten und in der Anmerkung.
   Gibt es den neuen Namen schon, werden die beiden Standorte zusammengeführt. */
export const standortUmbenennen = (d, alt, neu) => {
  const a = String(alt || "").trim(), n = String(neu || "").trim();
  if (!a || !n || a === n) return false;
  const i = d.bereiche.indexOf(a);
  if (d.bereiche.includes(n)) { if (i >= 0) d.bereiche.splice(i, 1); }
  else if (i >= 0) d.bereiche[i] = n;
  else d.bereiche.push(n);
  for (const g of d.geraete) if ((g.bereich || "").trim() === a) g.bereich = n;
  const info = d.standortInfo || (d.standortInfo = {});
  if (info[a]) { if (!info[n]) info[n] = info[a]; delete info[a]; }
  return true;
};
