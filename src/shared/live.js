/* ── Live-Daten mit dem Plan abgleichen (reine Logik, ohne UI) ───────────── */
import { inSubnet, ip2int } from "./net.js";
import { TYPEN } from "./constants.js";

const normMac = (m) => (m || "").trim().toLowerCase().replace(/-/g, ":");

// Alle geplanten Adressen: [{ ip, mac, dev, iface }]
export const planAddresses = (P) =>
  P.geraete.flatMap((dev) => dev.interfaces.filter((i) => i.ip).map((iface) => ({ ip: iface.ip.trim(), mac: normMac(iface.mac), dev, iface })));

// Gerät zu einer IP (und optional MAC oder Name) im Plan finden
export const findPlanned = (P, { ip, mac } = {}) => {
  const all = planAddresses(P);
  return all.find((a) => ip && a.ip === ip) || all.find((a) => mac && a.mac && a.mac === normMac(mac)) || null;
};

/* Soll/Ist eines Scans:
   - ok: geplant und gefunden
   - offline: geplant (im gescannten Netz), aber nicht gefunden
   - unbekannt: gefunden, aber nicht im Plan
   - mac: gefunden, aber MAC weicht vom Plan ab
   - verschoben: MAC aus dem Plan antwortet unter einer anderen IP */
export const compareScan = (P, hosts, cidr) => {
  const planned = planAddresses(P);
  const rows = [];
  const hostByIp = new Map(hosts.map((h) => [h.ip, h]));
  const used = new Set();
  for (const a of planned) {
    if (cidr && !inSubnet(a.ip, cidr)) continue;
    const h = hostByIp.get(a.ip);
    if (h) {
      used.add(h.ip);
      const macDiff = a.mac && h.mac && a.mac !== normMac(h.mac);
      rows.push({ status: macDiff ? "mac" : "ok", ip: a.ip, dev: a.dev, iface: a.iface, host: h });
    } else {
      const moved = a.mac && hosts.find((x) => x.mac && normMac(x.mac) === a.mac);
      if (moved) { used.add(moved.ip); rows.push({ status: "verschoben", ip: a.ip, dev: a.dev, iface: a.iface, host: moved }); }
      else rows.push({ status: "offline", ip: a.ip, dev: a.dev, iface: a.iface, host: null });
    }
  }
  for (const h of hosts) if (!used.has(h.ip)) rows.push({ status: "unbekannt", ip: h.ip, dev: null, iface: null, host: h });
  const ord = { mac: 0, verschoben: 1, offline: 2, unbekannt: 3, ok: 4 };
  rows.sort((a, b) => ord[a.status] - ord[b.status] || (ip2int(a.ip) ?? 0) - (ip2int(b.ip) ?? 0));
  const count = Object.fromEntries(Object.keys(ord).map((k) => [k, rows.filter((r) => r.status === k).length]));
  return { rows, count };
};

// Subnetze aus dem VLAN-Plan als Vorschläge für den Scan
export const scanTargets = (P) => P.vlans.filter((v) => v.subnetz).map((v) => ({ cidr: v.subnetz.trim(), label: `VLAN ${v.vid} ${v.name}`.trim(), farbe: v.farbe }));

// Managed Switches mit Management-IP (Kandidaten für SNMP)
export const snmpSwitches = (P) =>
  P.geraete.filter((d) => TYPEN[d.typ]?.isSwitch && !TYPEN[d.typ]?.unmanaged)
    .map((d) => ({ dev: d, ip: (d.interfaces.find((i) => i.ip) || {}).ip || "" }))
    .filter((s) => s.ip);

/* SNMP-Ports eines Switches mit den geplanten Ports vergleichen.
   Zuordnung über die Reihenfolge: n-ter Ethernet-Port am Switch = n-ter Port im Plan. */
export const compareSwitchPorts = (dev, X, snmpPorts) => {
  const vid = (id) => X.vlanById.get(id)?.vid ?? null;
  return snmpPorts.map((sp, n) => {
    const pp = dev.ports[n] || null;
    let sollVid = null, sollTagged = [];
    if (pp) {
      if (pp.modus === "trunk") sollTagged = (pp.vlans || []).map(vid).filter((v) => v != null);
      else sollVid = pp.vlan ? vid(pp.vlan) : null;
    }
    const istUntagged = sp.untagged?.length ? sp.untagged : sp.pvid != null ? [sp.pvid] : [];
    const conn = pp ? (X.connsByPort.get(`${dev.id}:${pp.id}`) || [])[0] : null;
    const peer = conn ? X.devById.get(conn.a.dev === dev.id ? conn.b.dev : conn.a.dev) : null;
    const hinweise = [];
    if (pp && sollVid != null && sp.pvid != null && +sp.pvid !== +sollVid) hinweise.push(`PVID ${sp.pvid} statt VLAN ${sollVid}`);
    if (pp && sollTagged.length && sp.tagged) {
      const fehlt = sollTagged.filter((v) => !sp.tagged.includes(v) && !istUntagged.includes(v));
      if (fehlt.length) hinweise.push(`Trunk ohne VLAN ${fehlt.join(", ")}`);
    }
    if (peer && sp.ifOper !== undefined && !sp.up) hinweise.push(`${peer.name} geplant, Port aber down`);
    return { snmp: sp, plan: pp, sollVid, sollTagged, istUntagged, peer, hinweise };
  });
};

/* ── Anzeige-Helfer ─────────────────────────────────────────────────────── */
export const fmtAge = (ms) => (ms == null ? "–" : ms < 1500 ? "jetzt" : ms < 60000 ? `vor ${Math.round(ms / 1000)} s` : `vor ${Math.round(ms / 60000)} min`);
export const fmtBps = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} Mbit/s` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} kbit/s` : `${b || 0} bit/s`);
export const fmtUptime = (s) => {
  if (s == null) return "–";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};
