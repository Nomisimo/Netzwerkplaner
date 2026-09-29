// CITP/MSEx: Medienserver, Pulte und Visualizer über PINF/PLoc finden
const { openUdp, closeUdp, Rate, explainError } = require('./util');

const PORT = 4809;
const GROUPS = ['224.0.0.180', '239.224.0.180']; // zweite Gruppe: neuere Versionen, laut Recherche unbestätigt

// Nullterminierte Zeichenkette ab Offset lesen → [text, nächster Offset]
const zstr = (buf, o) => {
  let z = buf.indexOf(0, o);
  if (z < 0) z = buf.length;
  return [buf.toString('utf8', o, z), z + 1];
};

function parse(buf) {
  if (buf.length < 20 || buf.toString('latin1', 0, 4) !== 'CITP') return null;
  const layer = buf.toString('latin1', 16, 20);
  const out = { version: `${buf[4]}.${buf[5]}`, layer, size: buf.readUInt32LE(8) };
  if (layer === 'PINF' && buf.length >= 24) {
    out.message = buf.toString('latin1', 20, 24);
    if (out.message === 'PLoc' && buf.length >= 26) {
      out.tcpPort = buf.readUInt16LE(24);
      let o = 26;
      [out.type, o] = zstr(buf, o);
      [out.name, o] = zstr(buf, o);
      [out.state, o] = zstr(buf, o);
    }
    if (out.message === 'PNam' && buf.length > 24) out.name = zstr(buf, 24)[0];
  }
  return out;
}

async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const peers = new Map();
  const layers = new Map();
  const onMessage = (buf, rinfo) => {
    const p = parse(buf);
    if (!p) return;
    const key = `${p.layer}${p.message ? '/' + p.message : ''}`;
    if (!layers.has(key)) layers.set(key, new Rate());
    layers.get(key).hit(buf.length);
    if (p.message === 'PLoc' || p.message === 'PNam') {
      const old = peers.get(rinfo.address) || {};
      peers.set(rinfo.address, { ...old, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')), ip: rinfo.address, seen: Date.now() });
      ctx.dirty();
    }
  };
  let res;
  try { res = await openUdp({ port: PORT, iface, groups: GROUPS, onMessage }); }
  catch (e) { throw new Error(explainError(e, PORT)); }
  return {
    tick(dt) { for (const r of layers.values()) r.tick(dt); for (const [ip, p] of peers) if (Date.now() - p.seen > 60000) peers.delete(ip); },
    snapshot() {
      const now = Date.now();
      return {
        iface, joined: res.joined, failed: res.failed,
        peers: [...peers.values()].map((p) => ({ ip: p.ip, name: p.name || '', type: p.type || '', state: p.state || '', tcpPort: p.tcpPort, version: p.version, age: now - p.seen })),
        layers: [...layers.entries()].map(([k, r]) => ({ key: k, rate: r.rate, total: r.total })),
      };
    },
    action() { return false; },
    stop() { closeUdp(res); },
  };
}

module.exports = { kind: 'citp', parse, create };
