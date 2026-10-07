// Gemeinsame Helfer für die Live-Monitore (nur Hauptprozess, kein Electron-Import,
// damit die Module auch in Tests unter reinem Node laufen)
const dgram = require('dgram');
const os = require('os');

const ip2int = (s) => s.split('.').reduce((a, o) => ((a << 8) >>> 0) + (+o), 0) >>> 0;
const int2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

// IPv4-Schnittstellen des Rechners (ohne Loopback)
function listInterfaces() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      const mask = ip2int(a.netmask);
      const bcast = int2ip(((ip2int(a.address) & mask) | (~mask >>> 0)) >>> 0);
      const prefix = a.cidr ? +a.cidr.split('/')[1] : 32 - Math.log2((~mask >>> 0) + 1);
      out.push({ name, address: a.address, netmask: a.netmask, prefix, broadcast: bcast, mac: a.mac, cidr: `${int2ip((ip2int(a.address) & mask) >>> 0)}/${prefix}` });
    }
  }
  return out;
}

// Adressen, auf denen Multicast-Gruppen beigetreten werden: gewählte Schnittstelle oder alle
const joinAddrs = (iface) => (iface ? [iface] : listInterfaces().map((i) => i.address));

// UDP-Socket mit geteiltem Port (andere Programme wie grandMA3 onPC oder sACNView dürfen parallel laufen)
function openUdp({ port, groups = [], iface, broadcast = false, onMessage }) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const fail = (e) => { try { sock.close(); } catch {} reject(e); };
    sock.once('error', fail);
    sock.on('message', onMessage);
    sock.bind(port, () => {
      sock.removeListener('error', fail);
      sock.on('error', () => {});
      if (broadcast) { try { sock.setBroadcast(true); } catch {} }
      if (iface) { try { sock.setMulticastInterface(iface); } catch {} }
      const res = { sock, joined: [], failed: [] };
      for (const g of groups) join(res, g, iface);
      resolve(res);
    });
  });
}

function join(res, group, iface) {
  let ok = false;
  for (const a of joinAddrs(iface)) {
    try { res.sock.addMembership(group, a); ok = true; } catch (e) { if (e.code === 'EADDRINUSE') ok = true; }
  }
  if (!joinAddrs(iface).length) { try { res.sock.addMembership(group); ok = true; } catch {} }
  (ok ? res.joined : res.failed).push(group);
  return ok;
}

function leave(res, group, iface) {
  for (const a of joinAddrs(iface)) { try { res.sock.dropMembership(group, a); } catch {} }
  res.joined = res.joined.filter((g) => g !== group);
}

const closeUdp = (res) => { if (res) { try { res.sock.close(); } catch {} } };

// Nullterminierte ASCII/UTF-8-Zeichenkette aus einem festen Feld
const cstr = (buf, start, len) => {
  const end = Math.min(buf.length, start + len);
  let z = buf.indexOf(0, start);
  if (z < 0 || z > end) z = end;
  return buf.toString('utf8', start, z).trim();
};

const mac = (buf, start, n = 6) => [...buf.subarray(start, start + n)].map((b) => b.toString(16).padStart(2, '0')).join(':');

// Zählt Ereignisse und liefert die Rate der letzten Sekunde
class Rate {
  constructor() { this.n = 0; this.bytes = 0; this.rate = 0; this.bps = 0; this.total = 0; }
  hit(bytes = 0) { this.n++; this.total++; this.bytes += bytes; }
  tick(dtMs) { const f = 1000 / Math.max(dtMs, 1); this.rate = Math.round(this.n * f * 10) / 10; this.bps = Math.round(this.bytes * 8 * f); this.n = 0; this.bytes = 0; }
}

/* Einträge bleiben stehen: Statt nach einer Frist zu löschen, bekommt jeder Eintrag einen Zustand.
   aktiv = innerhalb der Frist gesehen, alt = Frist überschritten, beendet = hat sich ausdrücklich abgemeldet. */
const MAX_EINTRAEGE = 2000; // Obergrenze je Liste, damit ein tagelang laufender Monitor nicht unbegrenzt wächst
const zustand = (seen, frist, now = Date.now(), beendet = false) => (beendet ? 'beendet' : now - (seen || 0) > frist ? 'alt' : 'aktiv');
const ZUSTAND_ORD = { aktiv: 0, alt: 1, beendet: 2 };
// Aktive zuerst, die Reihenfolge innerhalb einer Gruppe bleibt (sort ist stabil)
const aktivZuerst = (list) => list.sort((a, b) => ZUSTAND_ORD[a.zustand] - ZUSTAND_ORD[b.zustand]);
// Älteste Einträge entfernen, sobald eine Liste die Obergrenze überschreitet
function kappen(map, max = MAX_EINTRAEGE, seenOf = (v) => v.seen) {
  if (map.size <= max) return;
  const alt = [...map.entries()].sort((a, b) => (seenOf(a[1]) || 0) - (seenOf(b[1]) || 0));
  for (const [k] of alt.slice(0, map.size - max)) map.delete(k);
}
// „Alte entfernen“: alles, was nicht mehr aktiv ist
function alteEntfernen(map, frist, seenOf = (v) => v.seen, now = Date.now()) {
  let n = 0;
  for (const [k, v] of map) if (v?.beendet || now - (seenOf(v) || 0) > frist) { map.delete(k); n++; }
  return n;
}

// Fehlermeldungen beim Öffnen von Ports verständlich machen
const explainError = (e, port) => {
  if (!e) return '';
  if (e.code === 'EACCES') return `Port ${port}: keine Berechtigung (Ports unter 1024 brauchen unter Linux Root-Rechte).`;
  if (e.code === 'EADDRINUSE') return `Port ${port} ist von einem anderen Programm exklusiv belegt.`;
  if (e.code === 'EADDRNOTAVAIL') return 'Die gewählte Netzwerkschnittstelle ist nicht verfügbar.';
  return `${e.code || 'Fehler'}: ${e.message}`;
};


// Ping über eine bestimmte Netzwerkkarte (Quelladresse src), sonst über die Route des Systems
const { execFile } = require('child_process');
const net = require('net');
function pingArgs(ip, src, waitMs = 1000) {
  if (process.platform === 'win32') return ['-n', '1', '-w', String(waitMs), ...(src ? ['-S', src] : []), ip];
  if (process.platform === 'darwin') return ['-c', '1', '-t', String(Math.max(1, Math.round(waitMs / 1000))), ...(src ? ['-S', src] : []), ip];
  return ['-c', '1', '-W', String(Math.max(1, Math.round(waitMs / 1000))), ...(src ? ['-I', src] : []), ip];
}
function ping(ip, { src, waitMs = 1000 } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('ping', pingArgs(ip, src, waitMs), { timeout: 3000, windowsHide: true }, (err, stdout) => {
      const out = String(stdout || '');
      const m = out.match(/(?:time|Zeit)[=<]\s*([\d.,]+)\s*ms/i);
      const ttl = out.match(/ttl=(\d+)/i);
      // Windows meldet „Zielhost nicht erreichbar“ mit Exitcode 0 → auf TTL prüfen
      resolve({ ok: !err && !!ttl, ms: m ? Math.round(parseFloat(m[1].replace(',', '.'))) : Date.now() - t0, ttl: ttl ? +ttl[1] : null, method: 'Ping' });
    });
  });
}
// TCP-Verbindung über eine bestimmte Netzwerkkarte; RST (ECONNREFUSED) heißt: Gerät lebt, Port zu
function tcpProbe(ip, port, { src, timeout = 700 } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = new net.Socket();
    const done = (open, alive) => { s.destroy(); resolve({ open, alive, ms: Date.now() - t0 }); };
    s.setTimeout(timeout);
    s.once('connect', () => done(true, true));
    s.once('timeout', () => done(false, false));
    s.once('error', (e) => done(false, e.code === 'ECONNREFUSED'));
    s.connect({ port, host: ip, ...(src ? { localAddress: src } : {}) });
  });
}

module.exports = { zustand, aktivZuerst, kappen, alteEntfernen, MAX_EINTRAEGE, ping, tcpProbe, pingArgs, listInterfaces, openUdp, join, leave, closeUdp, cstr, mac, Rate, explainError, ip2int, int2ip, joinAddrs };
