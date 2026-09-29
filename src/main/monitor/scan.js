// Netzwerkscan eines Subnetzes: Ping, TCP-Ports, MAC aus der ARP-Tabelle, Namen per Reverse-DNS
const net = require('net');
const dns = require('dns');
const { execFile } = require('child_process');
const { ip2int, int2ip, listInterfaces } = require('./util');

const DEFAULT_PORTS = [80, 443, 8080, 22, 23, 4440, 5959, 30021, 49280, 161];
const PORT_NAMES = { 22: 'SSH', 23: 'Telnet', 80: 'HTTP', 443: 'HTTPS', 8080: 'HTTP-Alt (MA Web Remote)', 4440: 'Dante ARC', 5959: 'NDI Discovery', 30021: 'MA-Net3 Worldserver', 49280: 'Yamaha RCP', 161: 'SNMP' };
const MAX_HOSTS = 1024;

function tcpProbe(ip, port, timeout = 700) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    const done = (open, alive) => { s.destroy(); resolve({ open, alive }); };
    s.setTimeout(timeout);
    s.once('connect', () => done(true, true));
    s.once('timeout', () => done(false, false));
    s.once('error', (e) => done(false, e.code === 'ECONNREFUSED')); // RST heißt: Gerät lebt, Port zu
    s.connect(port, ip);
  });
}

function ping(ip) {
  const args = process.platform === 'win32' ? ['-n', '1', '-w', '800', ip]
    : process.platform === 'darwin' ? ['-c', '1', '-t', '1', ip]
    : ['-c', '1', '-W', '1', ip];
  return new Promise((resolve) => {
    const t0 = Date.now();
    execFile('ping', args, { timeout: 3000, windowsHide: true }, (err, stdout) => {
      const m = String(stdout || '').match(/(?:time|Zeit)[=<]\s*([\d.,]+)\s*ms/i);
      const ttl = String(stdout || '').match(/ttl=(\d+)/i);
      resolve({ ok: !err && !!ttl, ms: m ? Math.round(parseFloat(m[1].replace(',', '.'))) : Date.now() - t0, ttl: ttl ? +ttl[1] : null });
    });
  });
}

// ARP-Tabelle des Betriebssystems lesen (macOS, Windows, Linux)
const normMac = (m) => m.replace(/-/g, ':').split(':').map((x) => x.padStart(2, '0')).join(':').toLowerCase();
function parseArp(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const ip = line.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
    const m = line.match(/\b([0-9a-f]{1,2}(?:[:-][0-9a-f]{1,2}){5})\b/i);
    if (!ip || !m) continue;
    const mac = normMac(m[1]);
    if (mac === 'ff:ff:ff:ff:ff:ff' || mac.startsWith('01:00:5e')) continue;
    out[ip[1]] = mac;
  }
  return out;
}
const readArp = () => new Promise((resolve) => {
  execFile('arp', ['-a'], { timeout: 5000, windowsHide: true }, (err, stdout) => resolve(err && !stdout ? {} : parseArp(stdout)));
});

const reverse = (ip) => new Promise((resolve) => {
  const t = setTimeout(() => resolve(''), 1500);
  dns.reverse(ip, (err, names) => { clearTimeout(t); resolve(err ? '' : (names[0] || '')); });
});

function hostsOf(cidr) {
  const m = String(cidr).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!m) throw new Error('Bitte ein Subnetz wie 192.168.1.0/24 angeben.');
  const prefix = +m[2];
  if (prefix < 22) throw new Error(`Subnetz zu groß: höchstens /22 (${MAX_HOSTS} Adressen) auf einmal scannen.`);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const base = (ip2int(m[1]) & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  if (size <= 2) return Array.from({ length: size }, (_, i) => int2ip(base + i));
  return Array.from({ length: size - 2 }, (_, i) => int2ip(base + i + 1));
}

async function create(opts = {}, ctx) {
  let hosts = [], running = false, cancel = false, progress = { done: 0, total: 0 }, cidr = '', started = 0, finished = 0, err = '';

  const run = async ({ cidr: c, ports = DEFAULT_PORTS, concurrency = 32 }) => {
    if (running) return false;
    let list;
    try { list = hostsOf(c); } catch (e) { err = e.message; ctx.dirty(); return false; }
    running = true; cancel = false; err = ''; cidr = c; started = Date.now(); finished = 0;
    progress = { done: 0, total: list.length };
    hosts = [];
    const own = new Set(listInterfaces().map((i) => i.address));
    let i = 0;
    const worker = async () => {
      while (i < list.length && !cancel) {
        const ip = list[i++];
        const p = await ping(ip);
        let alive = p.ok, open = [];
        // Auch Geräte finden, die Ping blocken: typische Ports probieren
        const probe = await Promise.all(ports.map((port) => tcpProbe(ip, port).then((r) => ({ port, ...r }))));
        open = probe.filter((r) => r.open).map((r) => r.port);
        if (probe.some((r) => r.alive)) alive = true;
        if (alive) hosts.push({ ip, ms: p.ok ? p.ms : null, ping: p.ok, ttl: p.ttl, open, self: own.has(ip) });
        progress.done++;
        ctx.dirty();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
    // ARP erst nach dem Sweep lesen, dann ist die Tabelle gefüllt
    const arp = await readArp();
    const inNet = new Set(list);
    for (const [ip, mac] of Object.entries(arp)) {
      const h = hosts.find((x) => x.ip === ip);
      if (h) h.mac = mac;
      else if (inNet.has(ip) && !cancel) hosts.push({ ip, mac, ms: null, ping: false, open: [], arpOnly: true });
    }
    await Promise.all(hosts.map(async (h) => { h.name = await reverse(h.ip); }));
    hosts.sort((a, b) => ip2int(a.ip) - ip2int(b.ip));
    running = false; finished = Date.now();
    ctx.dirty();
    return true;
  };

  return {
    tick() {},
    snapshot() { return { running, progress, cidr, started, finished, err, hosts, portNames: PORT_NAMES, defaultPorts: DEFAULT_PORTS, interfaces: listInterfaces() }; },
    action(name, args = {}) {
      if (name === 'scan') { run(args); return true; }
      if (name === 'cancel') { cancel = true; return true; }
      return false;
    },
    stop() { cancel = true; },
  };
}

module.exports = { kind: 'scan', create, parseArp, hostsOf, DEFAULT_PORTS };
