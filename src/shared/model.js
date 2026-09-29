import { STANDARD_VLANS, DEFAULT_BEREICHE, KABEL } from "./constants.js";
import { uid, findProtokoll, newIface, newPort } from "./catalog.js";
import { ip2int, int2ip, parseCidr, inSubnet, subnetsOverlap, nextFreeIp, DEFAULT_RANGES, isValidMac } from "./net.js";

export const clone = (x) => JSON.parse(JSON.stringify(x));

export const newVlan = (o = {}) => ({
  id: uid(), vid: 1, name: "", farbe: "#9aa4af", subnetz: "", gateway: "", zweck: "",
  igmp: false, querier: "", eeeAus: false, qos: false, dhcp: { aktiv: false, von: "", bis: "" }, notiz: "", ...o,
});

export const standardVlans = () => STANDARD_VLANS.map((v) => newVlan(clone(v)));

export const emptyProject = () => ({
  format: "netzwerkplaner",
  version: 1,
  meta: { veranstaltung: "Veranstaltung 2026", ort: "", ersteller: "", datum: new Date().toISOString().slice(0, 10), version: "1", notiz: "" },
  bereiche: [...DEFAULT_BEREICHE],
  vlans: standardVlans(),
  geraete: [],
  verbindungen: [],
  layout: { rootId: null, offsets: {}, collapsed: {} },
  icons: [],
});

// Ältere oder unvollständige Projektdateien auf den aktuellen Stand bringen
export const migrateProject = (p) => {
  const e = emptyProject();
  const out = { ...e, ...p, meta: { ...e.meta, ...(p.meta || {}) }, layout: { ...e.layout, ...(p.layout || {}) } };
  out.vlans = (p.vlans || []).map((v) => newVlan({ ...v, dhcp: { aktiv: false, von: "", bis: "", ...(v.dhcp || {}) } }));
  out.geraete = (p.geraete || []).map((d) => ({
    kategorie: "Sonstiges", bereich: "", protokolle: [], notizen: "", webUi: { vorhanden: false, url: "http://{ip}", iface: null },
    poeBedarf: 0, poeBudget: 0, ...d,
    interfaces: (d.interfaces || []).map((i) => newIface(i)),
    ports: (d.ports || []).map((pt) => newPort(pt)),
  }));
  out.verbindungen = (p.verbindungen || []).filter((c) => c.a && c.b).map((c) => ({ kabel: "cat6", laenge: "", label: "", notiz: "", ...c }));
  out.bereiche = p.bereiche || e.bereiche;
  out.icons = p.icons || [];
  return out;
};

/* ── Index über das Projekt ────────────────────────────────────────────── */
export const buildIndex = (P) => {
  const devById = new Map(P.geraete.map((d) => [d.id, d]));
  const vlanById = new Map(P.vlans.map((v) => [v.id, v]));
  const portRef = new Map(); // "dev:port" → { dev, port }
  const ifaceById = new Map();
  for (const d of P.geraete) {
    for (const p of d.ports) portRef.set(`${d.id}:${p.id}`, { dev: d, port: p });
    for (const i of d.interfaces) ifaceById.set(i.id, { dev: d, iface: i });
  }
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
  return { devById, vlanById, portRef, ifaceById, connsByPort, connsByDev };
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
    const ifc = port.iface ? X.ifaceById.get(port.iface)?.iface : null;
    return { kind: "access", vlans: ifc?.vlan ? [ifc.vlan] : [], sw: false, ifc };
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
  const free = dev.ports.filter((p) => !(X.connsByPort.get(`${dev.id}:${p.id}`) || []).length);
  return free.find((p) => !!p.p2p === preferP2P) || free[0] || null;
};

export const usedIps = (P, exceptIfaceId) => {
  const s = new Set();
  for (const d of P.geraete) for (const i of d.interfaces) {
    if (i.id === exceptIfaceId) continue;
    const n = ip2int(i.ip);
    if (n !== null) s.add(n);
  }
  return s;
};

export const suggestIp = (P, vlan, exceptIfaceId) => {
  if (!vlan?.subnetz) return null;
  const used = usedIps(P, exceptIfaceId);
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
  const ifc = dev.interfaces.find((i) => i.id === dev.webUi.iface) || dev.interfaces.find((i) => i.ip);
  const tpl = dev.webUi.url || "http://{ip}";
  if (tpl.includes("{ip}") && !ifc?.ip) return null;
  return tpl.replace("{ip}", ifc?.ip || "");
};
export const mainIp = (dev) => (dev.interfaces.find((i) => i.ip) || {}).ip || "";

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
// Steuer-/Management-Interfaces tragen keine Medienströme, wenn das Gerät noch andere Interfaces hat
const CTRL_IF = /steuer|manage|network|control|remote|mgmt|editor/i;
export const carriesMedia = (d, i) => !(d.interfaces.length > 1 && CTRL_IF.test(i.name));

export const validate = (P, X) => {
  const issues = [];
  const add = (sev, msg, ref = {}) => issues.push({ sev, msg, ...ref });
  const vlanList = P.vlans;

  // VLANs
  const vids = new Map();
  for (const v of vlanList) {
    if (vids.has(+v.vid)) add("error", `VLAN-ID ${v.vid} ist doppelt vergeben (${vids.get(+v.vid).name} / ${v.name}).`, { vlan: v.id });
    vids.set(+v.vid, v);
    if (+v.vid < 1 || +v.vid > 4094) add("error", `VLAN „${v.name}“: ID ${v.vid} liegt außerhalb 1–4094.`, { vlan: v.id });
    const c = parseCidr(v.subnetz);
    if (v.subnetz && !c) add("error", `VLAN ${v.vid}: Subnetz „${v.subnetz}“ ist keine gültige CIDR-Angabe.`, { vlan: v.id });
    if (c && !c.exact) add("warn", `VLAN ${v.vid}: „${v.subnetz}“ ist keine Netzadresse (gemeint: ${c.cidr}?).`, { vlan: v.id });
    if (c && v.gateway && !inSubnet(v.gateway, c)) add("error", `VLAN ${v.vid}: Gateway ${v.gateway} liegt nicht im Subnetz ${c.cidr}.`, { vlan: v.id });
    for (const r of DEFAULT_RANGES) if (c && subnetsOverlap(c.cidr, r.cidr)) add("info", `VLAN ${v.vid} (${c.cidr}) überschneidet sich mit dem Default-Bereich ${r.cidr} – ${r.name}.`, { vlan: v.id });
  }
  for (let i = 0; i < vlanList.length; i++) for (let j = i + 1; j < vlanList.length; j++) {
    const a = vlanList[i], b = vlanList[j];
    if (a.subnetz && b.subnetz && parseCidr(a.subnetz) && parseCidr(b.subnetz) && subnetsOverlap(a.subnetz, b.subnetz))
      add("error", `Subnetze überschneiden sich: VLAN ${a.vid} (${a.subnetz}) und VLAN ${b.vid} (${b.subnetz}).`, { vlan: a.id });
  }

  // Adressen
  const ipOwners = new Map();
  for (const d of P.geraete) {
    for (const i of d.interfaces) {
      const where = `${d.name} › ${i.name}`;
      if (i.mac && !isValidMac(i.mac)) add("warn", `${where}: MAC „${i.mac}“ hat kein gültiges Format.`, { dev: d.id });
      if (i.dhcp) {
        const v = X.vlanById.get(i.vlan);
        if (v && !v.dhcp?.aktiv) add("info", `${where} bezieht die Adresse per DHCP, im VLAN ${v.vid} ist aber kein DHCP-Bereich eingetragen.`, { dev: d.id });
        if (!i.ip) continue;
      }
      if (!i.ip) continue;
      const n = ip2int(i.ip);
      if (n === null) { add("error", `${where}: „${i.ip}“ ist keine gültige IPv4-Adresse.`, { dev: d.id }); continue; }
      if (!ipOwners.has(n)) ipOwners.set(n, []);
      ipOwners.get(n).push({ d, i });
      const v = X.vlanById.get(i.vlan);
      const c = v ? parseCidr(v.subnetz) : null;
      if (!v) add("warn", `${where} (${i.ip}) ist keinem VLAN zugeordnet.`, { dev: d.id });
      else if (c) {
        if (!inSubnet(n, c)) add("error", `${where}: ${i.ip} liegt nicht im Subnetz von VLAN ${v.vid} (${c.cidr}).`, { dev: d.id });
        else if (c.prefix < 31 && (n === c.net || n === c.bcast)) add("error", `${where}: ${i.ip} ist ${n === c.net ? "die Netzadresse" : "die Broadcast-Adresse"} von ${c.cidr}.`, { dev: d.id });
        if (+i.prefix !== c.prefix) add("warn", `${where}: Maske /${i.prefix} passt nicht zu VLAN ${v.vid} (/${c.prefix}).`, { dev: d.id });
        if (v.gateway && ip2int(v.gateway) === n) add("error", `${where}: ${i.ip} ist die Gateway-Adresse von VLAN ${v.vid}.`, { dev: d.id });
        if (v.dhcp?.aktiv && !i.dhcp) {
          const a = ip2int(v.dhcp.von), b = ip2int(v.dhcp.bis);
          if (a !== null && b !== null && n >= a && n <= b) add("warn", `${where}: statische Adresse ${i.ip} liegt im DHCP-Bereich von VLAN ${v.vid}.`, { dev: d.id });
        }
      }
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
    const devs = P.geraete.filter((d) => !d.isSwitch && d.interfaces.some((i) => i.vlan === v.id && carriesMedia(d, i)));
    const refs = new Map();
    for (const d of devs) for (const s of d.protokolle || []) { const r = findProtokoll(s); if (r) refs.set(r.name, r); }
    const mc = [...refs.values()].filter((r) => r.flags.igmp || r.flags.multicast && !r.flags.p2p);
    if (mc.length && !v.igmp) add("warn", `VLAN ${v.vid} ${v.name}: Multicast-Protokolle (${mc.slice(0, 4).map((r) => r.name).join(", ")}) ohne IGMP-Snooping/Querier.`, { vlan: v.id });
    if (v.igmp && !v.querier) add("info", `VLAN ${v.vid} ${v.name}: IGMP ist aktiv – genau einen Querier festlegen (Feld „Querier“).`, { vlan: v.id });
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
const takePort = (P, dev, preferP2P, preferName) => {
  const free = dev.ports.filter((p) => !portUsed(P, dev.id, p.id));
  const byName = preferName && free.find((p) => p.name === preferName);
  const copper = (p) => !/SFP|optical/i.test(p.typ);
  const pick = byName || free.find((p) => !!p.p2p === preferP2P && copper(p) && (dev.isSwitch || p.name !== "Secondary")) || free.find((p) => !!p.p2p === preferP2P && (dev.isSwitch || p.name !== "Secondary")) || free.find((p) => !!p.p2p === preferP2P) || free[0];
  if (pick) return pick;
  const np = newPort({ name: dev.isSwitch ? String(dev.ports.length + 1) : `LAN ${dev.ports.length + 1}`, iface: dev.isSwitch ? null : dev.interfaces[0]?.id || null });
  dev.ports.push(np);
  return np;
};

export const addConnection = (P, fromId, toId, opts = {}) => {
  opts = { ...opts };
  const a = P.geraete.find((x) => x.id === fromId), b = P.geraete.find((x) => x.id === toId);
  if (!a || !b || a === b) return null;
  const p2p = !a.isSwitch && !b.isSwitch && a.ports.some((p) => p.p2p && !portUsed(P, a.id, p.id)) && b.ports.some((p) => p.p2p && !portUsed(P, b.id, p.id));
  const fib = (d) => d.ports.find((p) => /SFP|optical/i.test(p.typ) && !portUsed(P, d.id, p.id));
  const uplinkFib = a.isSwitch && b.isSwitch && !opts.portA && !opts.portB && fib(a) && fib(b);
  const pa = uplinkFib ? fib(a) : takePort(P, a, p2p, opts.portA);
  const pb = uplinkFib ? fib(b) : takePort(P, b, p2p, opts.portB);
  if (uplinkFib && !opts.kabel) opts = { ...opts, kabel: "fiber_mm" };
  const c = { id: uid(), a: { dev: a.id, port: pa.id }, b: { dev: b.id, port: pb.id }, kabel: opts.kabel || (p2p ? "p2p" : "cat6"), laenge: opts.laenge || "", label: opts.label || "", notiz: "" };
  const managed = (d) => d.isSwitch && d.typ !== "switch_unmanaged";
  // Switch-Port übernimmt das VLAN des Endgeräts (Access)
  for (const [sw, sp, ep, epp] of [[a, pa, b, pb], [b, pb, a, pa]]) {
    if (!managed(sw) || ep.isSwitch) continue;
    const ifc = ep.interfaces.find((i) => i.id === epp.iface);
    if (ifc?.vlan && !sp.vlan && sp.modus === "access") sp.vlan = ifc.vlan;
  }
  // Switch ↔ Switch: Trunk mit allen VLANs
  if (managed(a) && managed(b)) for (const p of [pa, pb]) if (!p.vlan) { p.modus = "trunk"; p.vlans = P.vlans.map((v) => v.id); }
  P.verbindungen.push(c);
  return c.id;
};
