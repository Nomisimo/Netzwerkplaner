// OSC mitlesen: Nachrichten an frei wählbare UDP-Ports (grandMA3 8000, Yamaha 49900, Eos 8000/8001 …)
const { openUdp, closeUdp, Rate, explainError } = require('./util');

const pad4 = (n) => (n + 3) & ~3;
const ostr = (buf, o) => {
  let z = buf.indexOf(0, o);
  if (z < 0) throw new Error('OSC-String ohne Ende');
  return [buf.toString('utf8', o, z), pad4(z + 1)];
};

function parseMessage(buf) {
  let [address, o] = ostr(buf, 0);
  if (!address.startsWith('/')) throw new Error('keine OSC-Adresse');
  let tags = ',';
  if (o < buf.length && buf[o] === 0x2c) [tags, o] = ostr(buf, o);
  const args = [];
  for (const t of tags.slice(1)) {
    switch (t) {
      case 'i': args.push(buf.readInt32BE(o)); o += 4; break;
      case 'f': args.push(Math.round(buf.readFloatBE(o) * 1e5) / 1e5); o += 4; break;
      case 'd': args.push(buf.readDoubleBE(o)); o += 8; break;
      case 'h': args.push(Number(buf.readBigInt64BE(o))); o += 8; break;
      case 't': args.push(`t:${buf.readBigUInt64BE(o)}`); o += 8; break;
      case 's': case 'S': { let s; [s, o] = ostr(buf, o); args.push(s); break; }
      case 'b': { const n = buf.readInt32BE(o); args.push(`<blob ${n} B>`); o = pad4(o + 4 + n); break; }
      case 'c': args.push(String.fromCharCode(buf.readInt32BE(o))); o += 4; break;
      case 'r': args.push(`#${buf.subarray(o, o + 4).toString('hex')}`); o += 4; break;
      case 'm': args.push(`midi ${[...buf.subarray(o, o + 4)].join(' ')}`); o += 4; break;
      case 'T': args.push(true); break;
      case 'F': args.push(false); break;
      case 'N': args.push(null); break;
      case 'I': args.push('∞'); break;
      default: args.push(`?${t}`);
    }
  }
  return { address, types: tags.slice(1), args };
}

// Nachrichten und Bundles (rekursiv) in eine flache Liste zerlegen
function parse(buf, depth = 0) {
  if (buf.length >= 16 && buf.toString('latin1', 0, 8) === '#bundle\0') {
    const out = [];
    let o = 16;
    while (o + 4 <= buf.length && depth < 8) {
      const n = buf.readInt32BE(o);
      if (n <= 0 || o + 4 + n > buf.length) break;
      out.push(...parse(buf.subarray(o + 4, o + 4 + n), depth + 1));
      o += 4 + n;
    }
    return out;
  }
  return [parseMessage(buf)];
}

async function create(opts = {}, ctx) {
  const ports = [...new Set((opts.ports || [8000]).map(Number).filter((p) => p > 0 && p < 65536))];
  const log = [];
  const addrs = new Map(); // address → { rate, last, from }
  const socks = [], errors = [];
  let paused = false;
  for (const port of ports) {
    try {
      socks.push(await openUdp({
        port, iface: opts.iface, broadcast: true,
        onMessage: (buf, rinfo) => {
          let msgs;
          try { msgs = parse(buf); } catch (e) { msgs = [{ address: '(kein gültiges OSC)', types: '', args: [`${buf.length} B`] }]; }
          const now = Date.now();
          for (const m of msgs) {
            const a = addrs.get(m.address) || { rate: new Rate(), count: 0 };
            a.rate.hit(); a.count++; a.last = m.args; a.from = rinfo.address; a.port = port; a.seen = now;
            addrs.set(m.address, a);
            if (!paused) { log.push({ t: now, from: rinfo.address, port, ...m }); if (log.length > 300) log.shift(); }
          }
          ctx.dirty();
        },
      }));
    } catch (e) { errors.push(explainError(e, port)); }
  }
  if (!socks.length) throw new Error(errors.join(' ') || 'Kein Port geöffnet.');
  return {
    tick(dt) { for (const a of addrs.values()) a.rate.tick(dt); },
    snapshot() {
      const now = Date.now();
      return {
        ports, errors, paused,
        log: log.slice(-150),
        addresses: [...addrs.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 400)
          .map(([address, a]) => ({ address, count: a.count, rate: a.rate.rate, last: a.last, from: a.from, port: a.port, age: now - a.seen })),
      };
    },
    action(name, args = {}) {
      if (name === 'clear') { log.length = 0; addrs.clear(); return true; }
      if (name === 'pause') { paused = !!args.on; return paused; }
      return false;
    },
    stop() { socks.forEach(closeUdp); },
  };
}

module.exports = { kind: 'osc', parse, create };
