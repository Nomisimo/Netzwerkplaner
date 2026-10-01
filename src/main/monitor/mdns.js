// mDNS/DNS-SD: Dante- und NDI-Geräte (und weitere Dienste) im Netz finden
const dgram = require('dgram');
const { openUdp, closeUdp, explainError, joinAddrs } = require('./util');

const GROUP = '224.0.0.251';
const PORT = 5353;
const T = { A: 1, PTR: 12, TXT: 16, AAAA: 28, SRV: 33 };

const SERVICES = {
  dante: ['_netaudio-arc._udp.local', '_netaudio-cmc._udp.local', '_netaudio-dbc._udp.local', '_netaudio-chan._udp.local'],
  ndi: ['_ndi._tcp.local'],
  web: ['_http._tcp.local', '_https._tcp.local'],
};

/* ── DNS-Nachrichten ───────────────────────────────────────────────────── */
function encodeName(name) {
  const parts = name.replace(/\.$/, '').split('.');
  return Buffer.concat([...parts.map((p) => { const b = Buffer.from(p, 'utf8'); return Buffer.concat([Buffer.from([b.length]), b]); }), Buffer.from([0])]);
}

function buildQuery(names, type = T.PTR) {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(names.length, 4);
  const qs = names.map((n) => { const q = Buffer.alloc(4); q.writeUInt16BE(type, 0); q.writeUInt16BE(1, 2); return Buffer.concat([encodeName(n), q]); });
  return Buffer.concat([head, ...qs]);
}

function readName(buf, o) {
  const labels = [];
  let jumped = false, end = o, guard = 0;
  while (guard++ < 128) {
    if (o >= buf.length) throw new Error('Name außerhalb des Pakets');
    const len = buf[o];
    if (len === 0) { if (!jumped) end = o + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = o + 2;
      o = ((len & 0x3f) << 8) | buf[o + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.toString('utf8', o + 1, o + 1 + len));
    o += 1 + len;
  }
  return [labels.join('.'), end];
}

function parse(buf) {
  if (buf.length < 12) return null;
  const flags = buf.readUInt16BE(2);
  const counts = [4, 6, 8, 10].map((o) => buf.readUInt16BE(o));
  let o = 12;
  for (let i = 0; i < counts[0]; i++) { [, o] = readName(buf, o); o += 4; }
  const records = [];
  const total = counts[1] + counts[2] + counts[3];
  for (let i = 0; i < total && o < buf.length; i++) {
    let name;
    [name, o] = readName(buf, o);
    const type = buf.readUInt16BE(o), ttl = buf.readUInt32BE(o + 4), len = buf.readUInt16BE(o + 8);
    const d = o + 10;
    o = d + len;
    const r = { name, type, ttl };
    if (type === T.A && len === 4) r.data = [...buf.subarray(d, d + 4)].join('.');
    else if (type === T.PTR) r.data = readName(buf, d)[0];
    else if (type === T.SRV) r.data = { priority: buf.readUInt16BE(d), weight: buf.readUInt16BE(d + 2), port: buf.readUInt16BE(d + 4), target: readName(buf, d + 6)[0] };
    else if (type === T.TXT) {
      const txt = {};
      for (let p = d; p < d + len;) { const l = buf[p]; const s = buf.toString('utf8', p + 1, p + 1 + l); p += 1 + l; if (!s) continue; const eq = s.indexOf('='); txt[eq < 0 ? s : s.slice(0, eq)] = eq < 0 ? true : s.slice(eq + 1); }
      r.data = txt;
    } else continue;
    records.push(r);
  }
  return { response: !!(flags & 0x8000), records };
}

/* ── Monitor ───────────────────────────────────────────────────────────── */
async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const services = opts.services || [...SERVICES.dante, ...SERVICES.ndi];
  const ptr = new Map(); // Dienst → Set(Instanz)
  const srv = new Map(), txt = new Map(), addr = new Map(), from = new Map(), seen = new Map();
  const notes = [];

  const onMessage = (buf, rinfo) => {
    let p;
    try { p = parse(buf); } catch { return; }
    if (!p || !p.response) return;
    const now = Date.now();
    for (const r of p.records) {
      const n = r.name.toLowerCase();
      if (r.type === T.PTR) {
        if (!ptr.has(n)) ptr.set(n, new Set());
        if (r.ttl === 0) ptr.get(n).delete(r.data); else ptr.get(n).add(r.data);
        seen.set(r.data.toLowerCase(), now); from.set(r.data.toLowerCase(), rinfo.address);
      }
      if (r.type === T.SRV) srv.set(n, r.data);
      if (r.type === T.TXT) txt.set(n, r.data);
      if (r.type === T.A) { if (!addr.has(n)) addr.set(n, new Set()); addr.get(n).add(r.data); } // Dante mit Redundanz: Primary und Secondary
    }
    ctx.dirty();
  };

  // Passiv auf 5353 mithören (klappt, wenn das Betriebssystem den Port teilt) …
  let passive = null;
  try { passive = await openUdp({ port: PORT, iface, groups: [GROUP], onMessage }); }
  catch (e) { notes.push(`Passives Mithören nicht möglich (${explainError(e, PORT)}), nur aktive Abfragen.`); }
  // … und aktiv mit eigenem Port fragen: Antworten kommen dann per Unicast zurück (RFC 6762, 6.7)
  const q = dgram.createSocket({ type: 'udp4' });
  q.on('message', onMessage);
  q.on('error', () => {});
  await new Promise((r) => q.bind(0, r));
  const query = () => {
    const pkt = buildQuery(services);
    for (const a of joinAddrs(iface)) { try { q.setMulticastInterface(a); } catch {} q.send(pkt, PORT, GROUP, () => {}); }
    if (!joinAddrs(iface).length) q.send(pkt, PORT, GROUP, () => {});
  };
  query();
  const timer = setInterval(query, opts.interval || 15000);

  const instances = () => {
    const out = [];
    for (const [svc, set] of ptr) {
      for (const inst of set) {
        const k = inst.toLowerCase();
        const s = srv.get(k);
        const host = s?.target?.toLowerCase();
        const ips = [...((host && addr.get(host)) || [])];
        out.push({
          service: svc, instance: inst, label: inst.slice(0, inst.length - svc.length - 1) || inst,
          host: s?.target || '', port: s?.port || null, ip: ips[0] || from.get(k) || '', ips, txt: txt.get(k) || {}, age: Date.now() - (seen.get(k) || 0),
        });
      }
    }
    return out;
  };

  return {
    tick() {},
    snapshot() { return { iface, services, notes, passive: !!passive, instances: instances() }; },
    action(name) {
      if (name === 'query') { query(); return true; }
      if (name === 'clear') { ptr.clear(); srv.clear(); txt.clear(); addr.clear(); query(); return true; }
      return false;
    },
    stop() { clearInterval(timer); closeUdp(passive); try { q.close(); } catch {} },
  };
}

module.exports = { kind: 'mdns', parse, buildQuery, create, SERVICES };
