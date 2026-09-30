/* ── Konfiguration kopieren, Geräte und Stapel duplizieren ──────────────────
   Die Zwischenablage enthält reine Daten (kein Projektbezug außer VLANs).
   VLANs werden mit id und VLAN-ID gemerkt: im selben Projekt gilt die id,
   in einem anderen Projekt die VLAN-ID. */
import { uid, createDevice } from "./catalog.js";
import { vlanNachVid } from "./qinq.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

export const KONFIG_TEILE = [
  { key: "ports", label: "Port-Einstellungen", hint: "Modus, Access-VLAN, Trunk-VLANs, PoE, Porttyp, P2P, Interface-Zuordnung (je Port nach Name, sonst nach Reihenfolge)" },
  { key: "interfaces", label: "Interfaces", hint: "Name, VLAN, Maske, Gateway, DHCP. IP- und MAC-Adressen werden nie kopiert." },
  { key: "protokolle", label: "Protokolle", hint: "Liste der Protokolle des Geräts" },
  { key: "stroeme", label: "Datenströme", hint: "Sender und Empfänger, ohne Ziele" },
  { key: "webUi", label: "Web-UI", hint: "Web-UI vorhanden und URL-Muster" },
  { key: "poe", label: "PoE", hint: "PoE-Budget bzw. PoE-Bedarf" },
  { key: "allgemein", label: "Bereich und Kategorie", hint: "Bereich (z. B. FOH), Anwendung und Symbol" },
  { key: "notizen", label: "Notizen", hint: "" },
];

const vlanRef = (id, vlans) => (id ? { id, vid: vlans.find((v) => v.id === id)?.vid ?? null } : null);
const vlanAuf = (ref, vlans) => {
  if (!ref) return null;
  if (vlans.some((v) => v.id === ref.id)) return ref.id;
  return ref.vid != null ? vlanNachVid(vlans, ref.vid)?.id || null : null;
};

// Welche Teile hat ein Gerät überhaupt (für die Vorauswahl im Dialog)
export const konfigTeileVon = (dev) => KONFIG_TEILE.filter((t) => {
  if (t.key === "ports") return dev.ports.length > 0;
  if (t.key === "interfaces") return dev.interfaces.length > 0;
  if (t.key === "protokolle") return (dev.protokolle || []).length > 0;
  if (t.key === "stroeme") return (dev.stroeme || []).length > 0;
  if (t.key === "notizen") return !!dev.notizen;
  return true;
}).map((t) => t.key);

/* Konfiguration eines Geräts in die Zwischenablage */
export const konfigAus = (dev, vlans, teile) => {
  const d = {};
  const ifIndex = (id) => dev.interfaces.findIndex((i) => i.id === id);
  if (teile.includes("ports")) d.ports = dev.ports.map((p) => ({
    name: p.name, typ: p.typ, modus: p.modus, poe: !!p.poe, p2p: !!p.p2p,
    vlan: vlanRef(p.vlan, vlans), vlans: (p.vlans || []).map((id) => vlanRef(id, vlans)).filter(Boolean),
    iface: p.iface ? ifIndex(p.iface) : -1,
  }));
  if (teile.includes("interfaces")) d.interfaces = dev.interfaces.map((i) => ({ name: i.name, vlan: vlanRef(i.vlan, vlans), prefix: i.prefix, gateway: i.gateway, dhcp: !!i.dhcp }));
  if (teile.includes("protokolle")) d.protokolle = [...(dev.protokolle || [])];
  if (teile.includes("stroeme")) d.stroeme = (dev.stroeme || []).map((s) => ({ ...clone(s), ziele: [], iface: s.iface ? ifIndex(s.iface) : -1 }));
  if (teile.includes("webUi")) d.webUi = dev.webUi ? { vorhanden: !!dev.webUi.vorhanden, url: dev.webUi.url } : null;
  if (teile.includes("poe")) d.poe = { poeBudget: dev.poeBudget, poeBedarf: dev.poeBedarf, poePse: dev.poePse };
  if (teile.includes("allgemein")) d.allgemein = { bereich: dev.bereich, kategorie: dev.kategorie, icon: dev.icon };
  if (teile.includes("notizen")) d.notizen = dev.notizen || "";
  return { art: "konfig", quelle: { name: dev.name, modell: [dev.hersteller, dev.modell].filter(Boolean).join(" "), typ: dev.typ, isSwitch: !!dev.isSwitch, ports: dev.ports.length }, teile: Object.keys(d), daten: d };
};

/* Konfiguration auf ein Gerät anwenden (ändert ziel direkt).
   Ergebnis: { teile, fehlendePorts } für die Rückmeldung. */
export const konfigAnwenden = (ziel, clip, teile, vlans) => {
  const d = clip.daten;
  const res = { teile: [], fehlendePorts: 0 };
  const hat = (k) => teile.includes(k) && d[k] !== undefined;
  if (hat("interfaces")) {
    d.interfaces.forEach((s, n) => {
      let i = ziel.interfaces[n];
      if (!i) { i = { id: uid(), name: s.name, ip: "", prefix: 24, gateway: "", vlan: null, mac: "", dhcp: false }; ziel.interfaces.push(i); }
      Object.assign(i, { name: s.name, vlan: vlanAuf(s.vlan, vlans), prefix: s.prefix, gateway: s.gateway, dhcp: s.dhcp });
    });
    res.teile.push("interfaces");
  }
  const ifAuf = (n) => (n >= 0 ? ziel.interfaces[n]?.id || null : null);
  if (hat("ports")) {
    const namen = new Map(ziel.ports.map((p) => [p.name, p]));
    const frei = new Set(ziel.ports);
    const paare = d.ports.map((s) => { const p = namen.get(s.name); if (p) frei.delete(p); return [s, p]; });
    const rest = ziel.ports.filter((p) => frei.has(p));
    for (const pr of paare) if (!pr[1]) pr[1] = rest.shift() || null; // ohne Namenstreffer nach Reihenfolge
    for (const [s, p] of paare) {
      if (!p) { res.fehlendePorts++; continue; }
      Object.assign(p, { typ: s.typ, modus: s.modus, poe: s.poe, p2p: s.p2p, vlan: vlanAuf(s.vlan, vlans), vlans: s.vlans.map((r) => vlanAuf(r, vlans)).filter(Boolean) });
      if (!ziel.isSwitch) p.iface = ifAuf(s.iface);
    }
    res.teile.push("ports");
  }
  if (hat("protokolle")) { ziel.protokolle = [...d.protokolle]; res.teile.push("protokolle"); }
  if (hat("stroeme")) { ziel.stroeme = d.stroeme.map((s) => ({ ...clone(s), id: uid(), ziele: [], iface: ifAuf(s.iface) })); res.teile.push("stroeme"); }
  if (hat("webUi") && d.webUi) { ziel.webUi = { ...(ziel.webUi || {}), vorhanden: d.webUi.vorhanden, url: d.webUi.url, iface: ziel.webUi?.iface || ziel.interfaces[0]?.id || null }; res.teile.push("webUi"); }
  if (hat("poe")) {
    if (ziel.isSwitch) { ziel.poeBudget = d.poe.poeBudget || 0; if (d.poe.poePse != null) ziel.poePse = d.poe.poePse; }
    else ziel.poeBedarf = d.poe.poeBedarf || 0;
    res.teile.push("poe");
  }
  if (hat("allgemein")) { Object.assign(ziel, { bereich: d.allgemein.bereich || "", kategorie: d.allgemein.kategorie || ziel.kategorie, icon: d.allgemein.icon || ziel.icon }); res.teile.push("allgemein"); }
  if (hat("notizen")) { ziel.notizen = d.notizen; res.teile.push("notizen"); }
  return res;
};

/* Gerät duplizieren: neue ids, IPs und MACs leer, kein Bestandsbezug */
export const geraetKopie = (dev, name) => {
  const c = clone(dev); const idMap = {};
  c.id = uid(); c.name = name ?? dev.name + " (Kopie)";
  c.interfaces.forEach((i) => { const n = uid(); idMap[i.id] = n; i.id = n; i.ip = ""; i.mac = ""; });
  c.ports.forEach((p) => { p.id = uid(); p.iface = p.iface ? idMap[p.iface] || null : null; });
  if (c.webUi) c.webUi.iface = idMap[c.webUi.iface] || null;
  c.stroeme = (c.stroeme || []).map((s) => ({ ...s, id: uid(), ziele: [], iface: s.iface ? idMap[s.iface] || null : null }));
  delete c.bestandId;
  return c;
};

/* Stapel in die Zwischenablage: Geräte (mit VLAN-IDs) und die Verbindungen
   zwischen ihnen. Verbindungen nach außen bleiben weg. */
export const stapelAus = (P, stapelId) => {
  const s = (P.layout.stapel || []).find((x) => x.id === stapelId);
  if (!s) return null;
  const devs = s.ids.map((id) => P.geraete.find((g) => g.id === id)).filter(Boolean);
  const di = new Map(devs.map((g, n) => [g.id, n]));
  const pi = (end) => devs[di.get(end.dev)].ports.findIndex((p) => p.id === end.port);
  const vid = (id) => P.vlans.find((v) => v.id === id)?.vid ?? null;
  const geraete = devs.map((g) => {
    const c = clone(g);
    for (const i of c.interfaces) { i.vid = vid(i.vlan); i.ip = ""; i.mac = ""; }
    for (const p of c.ports) { p.vid = vid(p.vlan); p.vids = (p.vlans || []).map(vid).filter((x) => x != null); }
    delete c.bestandId;
    return c;
  });
  const verbindungen = P.verbindungen.filter((c) => di.has(c.a.dev) && di.has(c.b.dev)).map((c) => {
    const { id, a, b, ...rest } = clone(c);
    return { ...rest, a: { g: di.get(a.dev), p: pi(a) }, b: { g: di.get(b.dev), p: pi(b) } };
  });
  return { art: "stapel", name: s.name || "", geraete, verbindungen };
};

/* Stapel aus der Zwischenablage ins Projekt einfügen (ändert d).
   Ergebnis: { ids: neue Geräte, stapelId: neuer Stapel oder null } */
export const stapelEinfuegen = (d, clip, { namensZusatz = " (Kopie)" } = {}) => {
  const neu = clip.geraete.map((g) => createDevice({ eigeneVorlage: { geraet: g }, vlans: d.vlans, name: g.name + namensZusatz }));
  d.geraete.push(...neu);
  for (const c of clip.verbindungen) {
    const pa = neu[c.a.g]?.ports[c.a.p], pb = neu[c.b.g]?.ports[c.b.p];
    if (pa && pb) d.verbindungen.push({ ...clone(c), id: uid(), a: { dev: neu[c.a.g].id, port: pa.id }, b: { dev: neu[c.b.g].id, port: pb.id } });
  }
  const ids = neu.map((g) => g.id);
  if (ids.length < 2) return { ids, stapelId: null };
  const stapelId = uid();
  d.layout.stapel = [...(d.layout.stapel || []), { id: stapelId, name: clip.name ? clip.name + namensZusatz : "", ids }];
  return { ids, stapelId };
};
