/* ── MA-Net Gold-Standards ─────────────────────────────────────────────────
   Prüfregeln für Geräte von MA Lighting (MA-Net1, MA-Net2, MA-Net3).
   Grundlage: MA-Vorgaben für grandMA3-Netze (1 GbE non-blocking, IGMP-Snooping
   mit Querier, EEE aus, eigenes VLAN, keine 100-Mbit-Geräte im MA-Net3-VLAN,
   max. 2 ms Laufzeit in der Broadcast-Domain, 192.168.33.x auf Con1–Con3
   unzulässig) und Fachwissen zu MA-Net1/2 (siehe Kernprotokolle). */
import { ip2int, parseCidr, inSubnet } from "./net.js";
import { portSpeed, connSpeed } from "./analyse.js";
import { connVlan } from "./model.js";

export const GOLD_STANDARDS = [
  ["1 GbE non-blocking", "Alle MA-Net3-Stationen und alle Switch-Verbindungen im MA-Net3-VLAN mit mindestens 1 Gbit/s."],
  ["Eigenes VLAN", "MA-Net3 in einem eigenen VLAN (Licht). Kein Dante, kein NDI, keine Büro-Clients im selben VLAN."],
  ["Keine 100-Mbit-Geräte", "Ein 100-Mbit-Gerät im MA-Net3-VLAN bremst die Session aus."],
  ["IGMP-Snooping + Querier", "Auf allen Switches IGMP-Snooping an, genau ein Querier je VLAN (am besten der Core-Switch)."],
  ["EEE aus", "Energy Efficient Ethernet (802.3az, „Green Ethernet“) an allen Ports im MA-Net3-VLAN abschalten."],
  ["Max. 2 ms", "Laufzeit innerhalb der Broadcast-Domain höchstens 2 ms, also wenige Switches in Reihe."],
  ["Kein 192.168.33.x", "Das Netz 192.168.33.0/24 ist für Con1–Con3 der grandMA3-Pulte unzulässig."],
  ["Generationen trennen", "MA-Net1, MA-Net2 und MA-Net3 nicht im selben VLAN mischen."],
  ["Feste Adressen", "Pulte, Processing Units und Nodes einer Session mit statischen IPs im selben Subnetz."],
];

// MA-Net-Generation eines Geräts (höchste gefundene), 0 = kein MA-Net
export const maNetGen = (d) => {
  let g = 0;
  for (const s of d.protokolle || []) {
    const m = /ma-?net\s*([123])?/i.exec(s);
    if (m) g = Math.max(g, +(m[1] || 1));
  }
  return g;
};

// Interfaces, über die MA-Net läuft
const maIfaces = (d) => {
  const mitVlan = d.interfaces.filter((i) => i.vlan);
  const benannt = mitVlan.filter((i) => /ma-?net|session/i.test(i.name));
  return benannt.length ? benannt : mitVlan.slice(0, 1);
};

const SWITCH_MAX = 5; // Richtwert für ≤ 2 ms bei 1 GbE inkl. Warteschlangen unter Last

export const maNetIssues = (P, X) => {
  const issues = [];
  const add = (sev, msg, ref = {}) => issues.push({ sev, msg: `MA-Net: ${msg}`, ...ref });
  const ma = P.geraete.filter((d) => !d.isSwitch && maNetGen(d) > 0);
  if (!ma.length) return issues;

  // VLAN → Generationen und Geräte
  const proVlan = new Map();
  for (const d of ma) for (const i of maIfaces(d)) {
    if (!proVlan.has(i.vlan)) proVlan.set(i.vlan, { gens: new Map(), devs: new Set() });
    const e = proVlan.get(i.vlan);
    const g = maNetGen(d);
    if (!e.gens.has(g)) e.gens.set(g, []);
    e.gens.get(g).push(d);
    e.devs.add(d.id);
  }

  const bad33 = parseCidr("192.168.33.0/24");
  for (const d of ma) {
    const gen = maNetGen(d);
    const ifs = maIfaces(d);
    if (!ifs.length && d.interfaces.some((i) => i.ip || i.dhcp)) add("info", `${d.name} ist keinem VLAN zugeordnet.`, { dev: d.id });
    for (const i of ifs) {
      if (gen === 3 && i.ip && ip2int(i.ip) !== null && inSubnet(i.ip, bad33))
        add("error", `${d.name} › ${i.name}: ${i.ip} liegt in 192.168.33.0/24. Dieses Netz ist für grandMA3 Con1–Con3 unzulässig.`, { dev: d.id });
      if (i.dhcp && /lichtpult|node/.test(d.typ)) add("info", `${d.name} › ${i.name} bezieht die Adresse per DHCP. Für Session-Mitglieder feste IPs vergeben.`, { dev: d.id });
    }
    // Anschluss am Switch: Geschwindigkeit
    if (gen === 3) for (const c of X.connsByDev.get(d.id) || []) {
      const eig = c.a.dev === d.id ? c.a : c.b;
      const p = X.portRef.get(`${eig.dev}:${eig.port}`)?.port;
      const sp = connSpeed(c, X);
      if (p && sp < 1000) add("error", `${d.name} [${p.name}] ist mit ${sp} Mbit/s angebunden. MA-Net3 verlangt 1 GbE.`, { dev: d.id, conn: c.id });
    }
  }

  for (const [vid, e] of proVlan) {
    const v = X.vlanById.get(vid);
    if (!v) continue;
    const name = `VLAN ${v.vid} ${v.name}`;
    const gens = [...e.gens.keys()].sort();
    const hat3 = e.gens.has(3);
    if (gens.length > 1) add("warn", `${name} mischt ${gens.map((g) => `MA-Net${g}`).join(" und ")}. Generationen in getrennte VLANs legen.`, { vlan: vid });
    if (hat3 || e.gens.has(2)) {
      if (!v.igmp) add(hat3 ? "error" : "warn", `${name}: IGMP-Snooping ist aus. ${hat3 ? "MA-Net3" : "MA-Net2"} verteilt die Session per Multicast.`, { vlan: vid });
      else if (!v.querier) add("warn", `${name}: kein IGMP-Querier eingetragen. Genau einen Querier festlegen, sonst bricht die Session nach einigen Minuten ab.`, { vlan: vid });
    }
    if (hat3 && !v.eeeAus) add("error", `${name}: Energy Efficient Ethernet ist nicht als abgeschaltet markiert. Im MA-Net3-VLAN muss EEE aus sein.`, { vlan: vid });

    // Fremde Geräte im MA-VLAN
    const fremd = P.geraete.filter((d) => !d.isSwitch && !e.devs.has(d.id) && d.interfaces.some((i) => i.vlan === vid));
    if (hat3) {
      const langsam = fremd.filter((d) => d.ports.some((p) => p.iface && d.interfaces.some((i) => i.id === p.iface && i.vlan === vid)) && d.ports.filter((p) => p.iface).every((p) => portSpeed(p) < 1000));
      for (const d of langsam) add("warn", `${name}: ${d.name} hat nur 100-Mbit-Ports. Keine 100-Mbit-Geräte ins MA-Net3-VLAN.`, { vlan: vid, dev: d.id });
      const aoip = fremd.filter((d) => (d.protokolle || []).some((s) => /dante|aes67|ravenna|\bndi\b/i.test(s)) && !(d.protokolle || []).some((s) => /art-?net|sacn|e1\.31/i.test(s)));
      if (aoip.length) add("warn", `${name}: ${aoip.slice(0, 3).map((d) => d.name).join(", ")}${aoip.length > 3 ? " …" : ""} im selben VLAN. MA-Net3 gehört in ein eigenes VLAN ohne Dante/NDI.`, { vlan: vid, devs: aoip.map((d) => d.id) });
    }

    // Switch-Verbindungen, die das VLAN tragen
    const sw = [];
    for (const c of P.verbindungen) {
      const ra = X.devById.get(c.a.dev), rb = X.devById.get(c.b.dev);
      if (!ra?.isSwitch || !rb?.isSwitch) continue;
      const cv = connVlan(c, X);
      if (!cv.vlans.includes(vid)) continue;
      sw.push(c);
      if (hat3 && connSpeed(c, X) < 1000) add("error", `${name}: Verbindung ${ra.name} ↔ ${rb.name} mit ${connSpeed(c, X)} Mbit/s. MA-Net3 braucht durchgehend 1 GbE.`, { conn: c.id, devs: [ra.id, rb.id] });
    }
    if (hat3 && sw.length && v.igmp) add("info", `${name}: mehrere Switches tragen das MA-Net3-VLAN. MA empfiehlt dann einen gemeinsamen Querier am Core und, wenn vorhanden, PIM.`, { vlan: vid });

    // Session-Ausdehnung: Switches zwischen MA-Geräten
    if (hat3) {
      const switches = new Set();
      for (const c of P.verbindungen) {
        const cv = connVlan(c, X);
        if (!cv.vlans.includes(vid)) continue;
        for (const end of [c.a, c.b]) if (X.devById.get(end.dev)?.isSwitch) switches.add(end.dev);
      }
      if (switches.size > SWITCH_MAX) add("warn", `${name}: ${switches.size} Switches im MA-Net3-VLAN. Für höchstens 2 ms Laufzeit die Kette kurz halten (Richtwert ≤ ${SWITCH_MAX} in Reihe).`, { vlan: vid });
    }
  }

  // Subnetz der Session
  for (const [vid, e] of proVlan) {
    const v = X.vlanById.get(vid);
    const c = v ? parseCidr(v.subnetz) : null;
    if (!v || c) continue;
    if (e.gens.has(3)) add("info", `VLAN ${v.vid} ${v.name}: kein Subnetz eingetragen. Alle Mitglieder einer MA-Net3-Session brauchen dasselbe Subnetz.`, { vlan: vid });
  }
  return issues;
};
