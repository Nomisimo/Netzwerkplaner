// Erreichbarkeit geplanter Geräte prüfen: TCP auf den Web-UI-Port, sonst ICMP-Ping.
// Mit src = '*' (Standard im Live-Tab) läuft die Prüfung über alle VLANs gleichzeitig: jede IP wird über
// jede Netzwerkkarte geprüft, in deren Subnetz sie liegt (auch die VLAN-Schnittstellen am Mac,
// „NP - <VLAN-Name>“). Liegt eine IP in keinem eigenen Netz, geht die Prüfung über die Route des Systems.
// Das Ergebnis nennt je IP, über welche Schnittstelle sie antwortet (via).
const { ip2int, listInterfaces, ping, tcpProbe } = require('./util');

const IP_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ALLE = '*';

const imNetz = (ip, ifc) => {
  if (!ifc || ifc.prefix == null || ifc.prefix < 1) return false;
  const mask = (0xffffffff << (32 - ifc.prefix)) >>> 0;
  return ((ip2int(ip) & mask) >>> 0) === ((ip2int(ifc.address) & mask) >>> 0);
};

// Prüfaufträge: je Ziel eine Liste von Wegen [{ src, iface, cidr, label }]; src '' = Route des Systems.
// namen: Gerät → Anzeigename (am Mac z. B. vlan0 → „NP - Licht“)
function wege(targets, src, interfaces = [], namen = {}) {
  const list = (targets || []).filter((t) => IP_RE.test(t.ip || '')).slice(0, 1024);
  const eintrag = (i) => ({ src: i.address, iface: i.name, cidr: i.cidr, label: namen[i.name] || i.name });
  if (src !== ALLE) {
    const s = IP_RE.test(src || '') ? src : '';
    const ifc = s && interfaces.find((i) => i.address === s);
    return list.map((t) => ({ t, wege: [ifc ? eintrag(ifc) : { src: s, iface: '', cidr: '', label: s || 'Systemroute' }] }));
  }
  return list.map((t) => {
    const passend = interfaces.filter((i) => imNetz(t.ip, i));
    return { t, wege: passend.length ? passend.map(eintrag) : [{ src: '', iface: '', cidr: '', label: 'Systemroute' }] };
  });
}

async function pruefeWeg(t, w, mit) {
  let r = null;
  if (t.port) { const p = await mit.tcpProbe(t.ip, +t.port, { src: w.src, timeout: 1500 }); r = { ok: p.alive, ms: p.ms, method: `TCP ${t.port}` }; }
  if (!r || !r.ok) {
    const p = await mit.ping(t.ip, { src: w.src });
    if (p.ok || !r) r = { ok: p.ok, ms: p.ms, method: 'Ping' };
  }
  return { ...r, iface: w.iface, cidr: w.cidr, label: w.label, src: w.src };
}

// targets: [{ id, ip, port }] → { id: { ok, ms, method, t, via: [{ ok, ms, method, iface, cidr, label, src }] } }
// ok/ms/method stammen vom schnellsten antwortenden Weg (sonst vom ersten), damit ältere Anzeigen passen.
async function pruefen(targets, src, { interfaces = listInterfaces(), namen = {}, parallel = 32, mit = { ping, tcpProbe } } = {}) {
  const auftraege = wege(targets, src, interfaces, namen);
  const jobs = auftraege.flatMap((a) => a.wege.map((w) => ({ a, w })));
  const erg = new Map(auftraege.map((a) => [a.t.id, []]));
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const { a, w } = jobs[i++];
      erg.get(a.t.id).push(await pruefeWeg(a.t, w, mit));
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
  const out = {};
  const t = Date.now();
  for (const a of auftraege) {
    const via = erg.get(a.t.id).sort((x, y) => (y.ok - x.ok) || ((x.ms ?? 1e9) - (y.ms ?? 1e9)));
    const best = via[0];
    out[a.t.id] = { ok: best.ok, ms: best.ms, method: best.method, t, via };
  }
  return out;
}

module.exports = { ALLE, IP_RE, wege, pruefen, imNetz };
