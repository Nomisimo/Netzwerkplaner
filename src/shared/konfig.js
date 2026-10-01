/* ── Konfiguration kopieren, Geräte und Stapel duplizieren ──────────────────
   Die Zwischenablage enthält reine Daten (kein Projektbezug außer VLANs).
   VLANs werden mit id und VLAN-ID gemerkt: im selben Projekt gilt die id,
   in einem anderen Projekt die VLAN-ID. */
import { uid, createDevice, snapshotDevice, newPort, ipPorts, hardwareFest } from "./catalog.js";
import { vlanNachVid } from "./qinq.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

export const KONFIG_TEILE = [
  { key: "ports", label: "Port-Einstellungen", hint: "Porttyp, Modus, VLAN, Trunk-VLANs, PoE, P2P, Maske, Gateway, DHCP (je Port nach Name, sonst nach Reihenfolge). IP- und MAC-Adressen werden nie kopiert." },
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
  if (t.key === "protokolle") return (dev.protokolle || []).length > 0;
  if (t.key === "stroeme") return (dev.stroeme || []).length > 0;
  if (t.key === "notizen") return !!dev.notizen;
  return true;
}).map((t) => t.key);

/* Konfiguration eines Geräts in die Zwischenablage */
export const konfigAus = (dev, vlans, teile) => {
  const d = {};
  const portIndex = (id) => dev.ports.findIndex((p) => p.id === id);
  if (teile.includes("ports")) d.ports = dev.ports.map((p) => ({
    name: p.name, typ: p.typ, modus: p.modus, poe: !!p.poe, p2p: !!p.p2p, virtuell: !!p.virtuell,
    vlan: vlanRef(p.vlan, vlans), vlans: (p.vlans || []).map((id) => vlanRef(id, vlans)).filter(Boolean),
    prefix: p.prefix, gateway: p.gateway, dhcp: !!p.dhcp,
  }));
  if (teile.includes("protokolle")) d.protokolle = [...(dev.protokolle || [])];
  if (teile.includes("stroeme")) d.stroeme = (dev.stroeme || []).map((s) => ({ ...clone(s), ziele: [], iface: s.iface ? portIndex(s.iface) : -1 }));
  if (teile.includes("webUi")) d.webUi = dev.webUi ? { vorhanden: !!dev.webUi.vorhanden, url: dev.webUi.url } : null;
  if (teile.includes("poe")) d.poe = { poeBudget: dev.poeBudget, poeBedarf: dev.poeBedarf, poePse: dev.poePse };
  if (teile.includes("allgemein")) d.allgemein = { bereich: dev.bereich, kategorie: dev.kategorie, icon: dev.icon };
  if (teile.includes("notizen")) d.notizen = dev.notizen || "";
  return { art: "konfig", quelle: { name: dev.name, modell: [dev.hersteller, dev.modell].filter(Boolean).join(" "), typ: dev.typ, isSwitch: !!dev.isSwitch, ports: dev.ports.filter((p) => !p.virtuell).length }, teile: Object.keys(d), daten: d };
};

/* Zwischenablage aus Versionen mit getrennten Interfaces: Interface-Daten auf die Ports legen */
export const konfigNormal = (clip) => {
  if (!clip || clip.art !== "konfig" || !clip.daten?.interfaces) return clip;
  const { interfaces: ifs, ...d } = clip.daten;
  const ipDaten = (i) => ({ vlan: i.vlan, prefix: i.prefix, gateway: i.gateway, dhcp: !!i.dhcp });
  if (d.ports) d.ports = d.ports.map(({ iface, ...s }) => (ifs[iface] ? { ...s, ...ipDaten(ifs[iface]) } : s));
  else d.ports = ifs.map((i) => ({ name: i.name, ...ipDaten(i) }));
  if (d.stroeme) d.stroeme = d.stroeme.map((s) => ({ ...s, iface: -1 }));
  return { ...clip, teile: [...new Set(clip.teile.map((t) => (t === "interfaces" ? "ports" : t)))], daten: d };
};

/* Konfiguration auf ein Gerät anwenden (ändert ziel direkt).
   Ergebnis: { teile, fehlendePorts } für die Rückmeldung. */
export const konfigAnwenden = (ziel, clip, teile, vlans) => {
  const d = konfigNormal(clip).daten;
  const res = { teile: [], fehlendePorts: 0 };
  const hat = (k) => teile.includes(k) && d[k] !== undefined;
  const zielFuer = []; // Quell-Port-Index → Zielport
  const fest = hardwareFest(ziel); // Buchsen, P2P und PoE-Werte des Modells bleiben
  if (hat("ports")) {
    const namen = new Map(ziel.ports.map((p) => [p.name, p]));
    const frei = new Set(ziel.ports);
    const paare = d.ports.map((s) => {
      const p = namen.get(s.name);
      if (!p || !frei.has(p) || !!p.virtuell !== !!s.virtuell) return [s, null];
      frei.delete(p);
      return [s, p];
    });
    const rest = ziel.ports.filter((p) => frei.has(p));
    for (const pr of paare) if (!pr[1]) { // ohne Namenstreffer nach Reihenfolge (Buchse zu Buchse, virtuell zu virtuell)
      const n = rest.findIndex((p) => !!p.virtuell === !!pr[0].virtuell);
      if (n >= 0) pr[1] = rest.splice(n, 1)[0];
      else if (pr[0].virtuell) { pr[1] = newPort({ name: pr[0].name, virtuell: true }); ziel.ports.push(pr[1]); }
    }
    paare.forEach(([s, p], n) => {
      zielFuer[n] = p;
      if (!p) { res.fehlendePorts++; return; }
      const werte = { typ: s.virtuell || fest ? undefined : s.typ, modus: s.modus, poe: s.poe, p2p: fest ? undefined : s.p2p, prefix: s.prefix, gateway: s.gateway, dhcp: s.dhcp,
        vlan: vlanAuf(s.vlan, vlans), vlans: s.vlans && s.vlans.map((r) => vlanAuf(r, vlans)).filter(Boolean) };
      for (const [k, v] of Object.entries(werte)) if (v !== undefined) p[k] = v;
    });
    res.teile.push("ports");
  }
  const portAuf = (n) => (n >= 0 ? (zielFuer[n] || ziel.ports[n])?.id || null : null);
  if (hat("protokolle")) { ziel.protokolle = [...d.protokolle]; res.teile.push("protokolle"); }
  if (hat("stroeme")) { ziel.stroeme = d.stroeme.map((s) => ({ ...clone(s), id: uid(), ziele: [], iface: portAuf(s.iface) })); res.teile.push("stroeme"); }
  if (hat("webUi") && d.webUi) { ziel.webUi = { ...(ziel.webUi || {}), vorhanden: d.webUi.vorhanden, url: d.webUi.url, iface: ziel.webUi?.iface || ipPorts(ziel)[0]?.id || null }; res.teile.push("webUi"); }
  if (hat("poe") && !fest) {
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
  c.ports.forEach((p) => { const n = uid(); idMap[p.id] = n; p.id = n; p.ip = ""; p.mac = ""; });
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
  const geraete = devs.map((g) => {
    const c = snapshotDevice(g, P.vlans); // mit VLAN-IDs und VLAN-Daten, damit es auch in anderen Projekten passt
    for (const p of c.ports) { p.ip = ""; p.mac = ""; }
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

/* Geräte-Auswahl in die Zwischenablage (⌘C): Geräte ohne IP/MAC (sonst IP-Konflikte),
   Verbindungen und Stapel zwischen ihnen und ihre Lage zueinander (rel). */
export const auswahlAus = (P, ids, pos = new Map()) => {
  const devs = ids.map((id) => P.geraete.find((g) => g.id === id)).filter(Boolean);
  if (!devs.length) return null;
  const di = new Map(devs.map((g, n) => [g.id, n]));
  const pi = (end) => devs[di.get(end.dev)].ports.findIndex((p) => p.id === end.port);
  const geraete = devs.map((g) => {
    const c = snapshotDevice(g, P.vlans);
    for (const p of c.ports) { p.ip = ""; p.mac = ""; }
    return c;
  });
  const verbindungen = P.verbindungen.filter((c) => di.has(c.a.dev) && di.has(c.b.dev)).map((c) => {
    const { id, a, b, ...rest } = clone(c);
    return { ...rest, a: { g: di.get(a.dev), p: pi(a) }, b: { g: di.get(b.dev), p: pi(b) } };
  });
  const stapel = (P.layout.stapel || []).filter((s) => s.ids.some((id) => di.has(id)))
    .map((s) => ({ name: s.name || "", g: s.ids.filter((id) => di.has(id)).map((id) => di.get(id)) })).filter((s) => s.g.length > 1);
  const pts = devs.map((g) => pos.get(g.id)).filter(Boolean);
  const mx = pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : 0, my = pts.length ? pts.reduce((a, p) => a + p.y, 0) / pts.length : 0;
  const rel = devs.map((g, n) => { const p = pos.get(g.id); return p ? { x: Math.round(p.x - mx), y: Math.round(p.y - my) } : { x: n * 30, y: n * 30 }; });
  return { art: "geraete", geraete, verbindungen, stapel, rel };
};

/* Geräte aus der Zwischenablage einfügen (⌘V, ändert d). at = Mitte der neuen Geräte auf der Fläche */
export const auswahlEinfuegen = (d, clip, at = null) => {
  const neu = clip.geraete.map((g) => createDevice({ eigeneVorlage: { geraet: g }, vlans: d.vlans, name: g.name + " (Kopie)" }));
  d.geraete.push(...neu);
  for (const c of clip.verbindungen) {
    const pa = neu[c.a.g]?.ports[c.a.p], pb = neu[c.b.g]?.ports[c.b.p];
    if (pa && pb) d.verbindungen.push({ ...clone(c), id: uid(), a: { dev: neu[c.a.g].id, port: pa.id }, b: { dev: neu[c.b.g].id, port: pb.id } });
  }
  for (const s of clip.stapel || []) {
    const ids = s.g.map((n) => neu[n]?.id).filter(Boolean);
    if (ids.length > 1) d.layout.stapel = [...(d.layout.stapel || []), { id: uid(), name: s.name ? s.name + " (Kopie)" : "", ids }];
  }
  if (at) d.layout.pinned = { ...(d.layout.pinned || {}), ...Object.fromEntries(neu.map((g, n) => [g.id, { x: Math.round(at.x + (clip.rel?.[n]?.x || 0)), y: Math.round(at.y + (clip.rel?.[n]?.y || 0)) }])) };
  return neu.map((g) => g.id);
};
