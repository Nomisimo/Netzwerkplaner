/* ── Analyse: Datenströme, Leitungslast, Multicast, Hops ─────────────────────
   Datenströme hängen an Geräten (dev.stroeme). Jede Rechnung ist eine
   Planungsabschätzung (Worst Case), keine Messung. */
import { KERN, KERN_BY_ID, streamRate, streamFlutet, defaultParams } from "./kernprotokolle.js";
import { buildTree, subtreeIds, connVlan, carriesMedia, isP2PConn, otherEnd } from "./model.js";
import { uid } from "./catalog.js";

export const newStream = (o = {}) => ({ id: uid(), proto: "dante", menge: 8, param: {}, mc: false, iface: null, ziele: [], notiz: "", ...o });

// Portgeschwindigkeit in Mbit/s
const SPEED = { SFP28: 25000, "SFP+": 10000, SFP: 1000, opticalCON: 1000, WLAN: 300 };
export const portSpeed = (port) => (+port?.speed > 0 ? +port.speed : SPEED[port?.typ] ?? 1000);
export const connSpeed = (c, X) => {
  if (c.kabel === "wlan") return 300;
  const pa = X.portRef.get(`${c.a.dev}:${c.a.port}`)?.port;
  const pb = X.portRef.get(`${c.b.dev}:${c.b.port}`)?.port;
  return Math.min(portSpeed(pa), portSpeed(pb));
};
export const fmtMbit = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} Gbit/s` : m >= 10 ? `${m.toFixed(0)} Mbit/s` : m >= 0.1 ? `${m.toFixed(1)} Mbit/s` : m > 0 ? `${(m * 1000).toFixed(0)} kbit/s` : "0");

// In welchem VLAN (bzw. welchen VLANs) läuft ein Strom? Dante mit Secondary zählt in beiden Netzen.
export const streamVlans = (d, s) => {
  if (s.iface) {
    const i = d.interfaces.find((x) => x.id === s.iface);
    return i?.vlan ? [i.vlan] : [];
  }
  const media = d.interfaces.filter((i) => i.vlan && carriesMedia(d, i));
  if (s.proto === "dante") {
    const pri = media.find((i) => /primary|dante/i.test(i.name)) || media[0];
    const sec = media.find((i) => /secondary/i.test(i.name) && i !== pri);
    return [pri?.vlan, sec?.vlan].filter(Boolean);
  }
  return media[0] ? [media[0].vlan] : [];
};

// Anzahl Multicast-Gruppen, die ein Strom belegt
export const streamGruppen = (s) => {
  const n = +s.menge || 0;
  if (s.proto === "sacn") return n;
  if (s.proto === "manet") return 1;
  if (s.proto === "citp") return 1;
  if (s.proto === "dante" && s.mc) return streamRate(s).flows || 1;
  if (s.proto === "ndi" && s.mc) return n;
  return 0;
};
const isBroadcast = (s) => s.proto === "artnet" && !!s.param?.broadcast;

// Alle Ströme des Projekts mit berechneter Rate
export const alleStroeme = (P) => {
  const out = [];
  for (const d of P.geraete) for (const s of d.stroeme || []) {
    if (!KERN_BY_ID[s.proto]) continue;
    const r = streamRate(s);
    out.push({ s, dev: d, vlans: streamVlans(d, s), mbit: r.mbit || 0, pps: r.pps || 0, rate: r, gruppen: streamGruppen(s), flutet: streamFlutet(s), broadcast: isBroadcast(s) });
  }
  return out;
};

/* Statistik je Protokoll und je VLAN */
export const statistik = (P, X) => {
  const st = alleStroeme(P);
  const proto = KERN.map((k) => {
    const l = st.filter((x) => x.s.proto === k.id);
    return { k, anzahl: l.length, geraete: new Set(l.map((x) => x.dev.id)).size, menge: l.reduce((a, x) => a + (+x.s.menge || 0), 0), mbit: l.reduce((a, x) => a + x.mbit, 0), pps: l.reduce((a, x) => a + x.pps, 0), gruppen: l.reduce((a, x) => a + x.gruppen, 0) };
  });
  // Geräte, die ein Kernprotokoll sprechen (aus der Protokollliste), auch ohne Strom
  const sprechen = (re) => P.geraete.filter((d) => (d.protokolle || []).some((p) => re.test(p))).length;
  const RE = { dante: /dante/i, manet: /ma-?net/i, artnet: /art-?net/i, sacn: /sacn|e1\.31/i, ndi: /\bndi/i, osc: /\bosc\b/i, citp: /citp|msex/i };
  for (const p of proto) p.sprechen = sprechen(RE[p.k.id]);

  const vlan = P.vlans.map((v) => {
    const l = st.filter((x) => x.vlans.includes(v.id));
    const mc = l.filter((x) => x.flutet && !x.broadcast);
    const bc = l.filter((x) => x.broadcast);
    const flutMbit = bc.reduce((a, x) => a + x.mbit, 0) + (v.igmp ? 0 : mc.reduce((a, x) => a + x.mbit, 0));
    return { v, stroeme: l.length, mbit: l.reduce((a, x) => a + x.mbit, 0), mcMbit: mc.reduce((a, x) => a + x.mbit, 0), bcMbit: bc.reduce((a, x) => a + x.mbit, 0), gruppen: l.reduce((a, x) => a + x.gruppen, 0), flutMbit, geraete: P.geraete.filter((d) => d.interfaces.some((i) => i.vlan === v.id)).length };
  }).filter((x) => x.stroeme || x.geraete);

  const dante = st.filter((x) => x.s.proto === "dante");
  return {
    stroeme: st, proto, vlan,
    summe: {
      mbit: st.reduce((a, x) => a + x.mbit, 0),
      danteKanaele: dante.reduce((a, x) => a + (+x.s.menge || 0), 0),
      danteFlows: dante.reduce((a, x) => a + (x.rate.flows || 0), 0),
      universen: st.filter((x) => ["artnet", "sacn", "manet"].includes(x.s.proto)).reduce((a, x) => a + (+x.s.menge || 0), 0),
      ndi: st.filter((x) => x.s.proto === "ndi").reduce((a, x) => a + (+x.s.menge || 0), 0),
      gruppen: st.reduce((a, x) => a + x.gruppen, 0),
    },
  };
};

/* Leitungslast je Verbindung im Topologiebaum.
   hoch = vom Kind-Teilbaum Richtung Core, runter = vom Core in den Teilbaum.
   - Strom mit Zielen: läuft über jede Leitung, die Quelle und Ziel trennt
     (Unicast je Ziel, Multicast einmal).
   - Strom ohne Ziele: Worst Case, der Sender schickt alles Richtung Core;
     zurück in fremde Teilbäume kommt er nur, wenn er flutet
     (Broadcast immer, Multicast wenn im VLAN kein IGMP-Snooping aktiv ist). */
export const leitungslast = (P, X, T = buildTree(P, X), st = alleStroeme(P)) => {
  const out = [];
  for (const [child, c] of T.treeConn) {
    if (isP2PConn(c, X)) continue;
    const sub = new Set(subtreeIds(T, child));
    const cv = connVlan(c, X);
    const vl = cv.vlans.length ? new Set(cv.vlans) : null; // null = unbekannt → alle
    let hoch = 0, runter = 0;
    const anteile = [];
    for (const x of st) {
      const vs = x.vlans.filter((v) => !vl || vl.has(v));
      if (!vs.length) continue;
      const innen = sub.has(x.dev.id);
      let up = 0, down = 0;
      const ziele = (x.s.ziele || []).filter((z) => X.devById.has(z));
      if (ziele.length) {
        const zi = ziele.filter((z) => sub.has(z)).length, za = ziele.length - zi;
        if (innen && za) up = x.s.mc ? x.mbit : x.mbit * za;
        if (!innen && zi) down = x.s.mc ? x.mbit : x.mbit * zi;
      } else if (innen) {
        up = x.mbit;
      } else if (x.broadcast || (x.flutet && vs.some((v) => !X.vlanById.get(v)?.igmp))) {
        down = x.mbit;
      }
      if (up || down) { hoch += up; runter += down; anteile.push({ x, up, down }); }
    }
    const speed = connSpeed(c, X);
    out.push({ c, child, parent: T.parent.get(child), hoch, runter, speed, last: Math.max(hoch, runter) / speed, anteile: anteile.sort((a, b) => Math.max(b.up, b.down) - Math.max(a.up, a.down)) });
  }
  return out.sort((a, b) => b.last - a.last);
};

/* Pfad zwischen zwei Geräten (Breitensuche über alle Verbindungen, ohne P2P).
   Mit vlan nur über Leitungen, die dieses VLAN tragen (oder deren VLAN unbekannt ist). */
export const pfad = (P, X, fromId, toId, vlan = null) => {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, null]]);
  const q = [fromId];
  while (q.length) {
    const id = q.shift();
    // nur über Switches weiterleiten (Endgeräte routen nicht)
    if (id !== fromId && !X.devById.get(id)?.isSwitch) continue;
    for (const c of X.connsByDev.get(id) || []) {
      if (isP2PConn(c, X)) continue;
      if (vlan) { const cv = connVlan(c, X).vlans; if (cv.length && !cv.includes(vlan)) continue; }
      const o = otherEnd(c, id).dev;
      if (prev.has(o)) continue;
      prev.set(o, id);
      if (o === toId) {
        const p = [o];
        for (let n = id; n; n = prev.get(n)) p.unshift(n);
        return p;
      }
      q.push(o);
    }
  }
  return null;
};
export const switchHops = (path, X) => (path ? path.filter((id) => X.devById.get(id)?.isSwitch).length : null);

// Latenz-Empfehlung für Dante nach Anzahl Switches im Pfad
export const danteLatenz = (hops, langsam = false) => (langsam || hops > 10 ? "2 ms" : hops > 5 ? "1 ms" : hops > 3 ? "0,5 ms" : "0,25 ms");

/* Größte Switch-Anzahl zwischen zwei Dante-Geräten im selben Netz */
export const danteHops = (P, X) => {
  const dev = P.geraete.filter((d) => !d.isSwitch && ((d.protokolle || []).some((p) => /dante/i.test(p)) || (d.stroeme || []).some((s) => s.proto === "dante")));
  const pri = new Map(dev.map((d) => [d.id, streamVlans(d, { proto: "dante" })[0] || null]));
  let max = { hops: 0, a: null, b: null, path: null };
  for (let i = 0; i < dev.length; i++) for (let j = i + 1; j < dev.length; j++) {
    const v = pri.get(dev[i].id);
    if (v !== pri.get(dev[j].id)) continue; // nur innerhalb desselben (Primary-)Netzes
    const p = pfad(P, X, dev[i].id, dev[j].id, v);
    const h = switchHops(p, X);
    if (p && h > max.hops) max = { hops: h, a: dev[i], b: dev[j], path: p };
  }
  return { ...max, geraete: dev.length, empfehlung: danteLatenz(max.hops) };
};

/* Laufzeit über n Switches: Serialisierung (Store & Forward) + Switch-Durchlauf + Kabel
   + im Worst Case ein volles Paket in der Warteschlange je Hop. */
export const laufzeit = ({ hops = 3, mbit = 1000, bytes = 1500, switchUs = 3, meter = 100, queue = true }) => {
  const ser = ((bytes + 38) * 8) / mbit; // µs je Übertragung inkl. Präambel/Header/IFG
  const q = queue ? ((1538 * 8) / mbit) : 0;
  const kabel = meter * 0.005; // ≈5 ns/m
  const proHop = ser + switchUs + q;
  const gesamt = ser + hops * proHop + kabel; // Sender-Serialisierung + je Switch
  return { ser, q, kabel, proHop, gesamt };
};

/* Zusätzliche Prüfhinweise aus der Analyse */
export const analyseIssues = (P, X) => {
  const issues = [];
  const st = alleStroeme(P);
  if (!st.length) return issues;
  const T = buildTree(P, X);
  for (const l of leitungslast(P, X, T, st)) {
    const a = X.devById.get(l.parent)?.name, b = X.devById.get(l.child)?.name;
    const pct = Math.round(l.last * 100);
    if (l.last > 1) issues.push({ sev: "error", msg: `Leitung ${a} ↔ ${b}: geschätzte Last ${fmtMbit(Math.max(l.hoch, l.runter))} übersteigt ${fmtMbit(l.speed)} (${pct} %).`, conn: l.c.id, devs: [l.parent, l.child] });
    else if (l.last > 0.7) issues.push({ sev: "warn", msg: `Leitung ${a} ↔ ${b}: geschätzte Last ${pct} % von ${fmtMbit(l.speed)} (Reserve unter 30 %).`, conn: l.c.id, devs: [l.parent, l.child] });
  }
  const S = statistik(P, X);
  for (const v of S.vlan) {
    if (!v.v.igmp && v.mcMbit > 0) issues.push({ sev: v.mcMbit > 50 ? "warn" : "info", msg: `VLAN ${v.v.vid}: ${fmtMbit(v.mcMbit)} Multicast ohne IGMP-Snooping. Diese Last liegt an jedem Port im VLAN an.`, vlan: v.v.id });
    if (v.gruppen > 256) issues.push({ sev: "warn", msg: `VLAN ${v.v.vid}: ${v.gruppen} Multicast-Gruppen. Die IGMP-Tabelle der Switches prüfen (oft 256–1024 Einträge).`, vlan: v.v.id });
    if (v.bcMbit > 20) issues.push({ sev: "warn", msg: `VLAN ${v.v.vid}: ${fmtMbit(v.bcMbit)} Art-Net-Broadcast. Unicast verwenden, damit Kameras, Laptops und Nodes nicht überlastet werden.`, vlan: v.v.id });
  }
  const dh = danteHops(P, X);
  if (dh.hops > 10) issues.push({ sev: "warn", msg: `Dante: bis zu ${dh.hops} Switches zwischen ${dh.a.name} und ${dh.b.name}. Latenz mindestens ${dh.empfehlung} einstellen.`, devs: [dh.a.id, dh.b.id] });
  return issues;
};

export { defaultParams };
