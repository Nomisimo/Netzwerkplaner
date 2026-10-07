// MA-Net 2/3: Verkehr erkennen und zählen. Der Inhalt ist nicht dokumentiert und wird nicht entschlüsselt.
const { openUdp, closeUdp, Rate, explainError, zustand, aktivZuerst, kappen, alteEntfernen } = require('./util');

// MA-Net-Verkehr kann pausieren: erst nach 30 s Stille „alt“
const FRIST = 30000;

// MA-Net3: UDP 30020, Multicast 236.4.1.0–.4 (MA-Doku). MA-Net2: UDP 29998/29999 (Anwenderangaben MA-Forum).
const PROFILE = [
  { port: 30020, netz: 'MA-Net3', groups: ['236.4.1.0', '236.4.1.1', '236.4.1.2', '236.4.1.3', '236.4.1.4'] },
  { port: 29998, netz: 'MA-Net2', groups: [] },
  { port: 29999, netz: 'MA-Net2', groups: [] },
];

async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const extra = (opts.extraGroups || []).filter((g) => /^(22[4-9]|23\d)\.\d+\.\d+\.\d+$/.test(g));
  const flows = new Map(); // "ip|port" → { rate, netz, first }
  const socks = [], errors = [];
  for (const p of PROFILE) {
    const groups = p.netz === 'MA-Net2' && p.port === 29998 ? [...p.groups, ...extra] : p.groups;
    try {
      const r = await openUdp({
        port: p.port, iface, groups, broadcast: true,
        onMessage: (buf, rinfo) => {
          const k = `${rinfo.address}|${p.port}`;
          let f = flows.get(k);
          if (!f) { f = { ip: rinfo.address, port: p.port, netz: p.netz, rate: new Rate(), first: Date.now(), sizes: new Map() }; flows.set(k, f); }
          f.rate.hit(buf.length); f.seen = Date.now();
          f.sizes.set(buf.length, (f.sizes.get(buf.length) || 0) + 1);
          if (f.sizes.size > 64) f.sizes.clear();
          ctx.dirty();
        },
      });
      r.netz = p.netz; r.port = p.port;
      socks.push(r);
    } catch (e) { errors.push(explainError(e, p.port)); }
  }
  if (!socks.length) throw new Error(errors.join(' '));
  return {
    tick(dt) { for (const f of flows.values()) f.rate.tick(dt); kappen(flows); },
    snapshot() {
      const now = Date.now();
      return {
        iface, errors,
        sockets: socks.map((s) => ({ netz: s.netz, port: s.port, joined: s.joined, failed: s.failed })),
        flows: aktivZuerst([...flows.values()].sort((a, b) => b.rate.bps - a.rate.bps).map((f) => ({
          ip: f.ip, port: f.port, netz: f.netz, pps: f.rate.rate, bps: f.rate.bps, total: f.rate.total, age: now - f.seen, since: now - f.first,
          sizes: [...f.sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s),
          zustand: zustand(f.seen, FRIST, now),
        }))),
      };
    },
    action(name) {
      if (name === 'clear') { flows.clear(); return true; }
      if (name === 'alteEntfernen') return alteEntfernen(flows, FRIST);
      return false;
    },
    stop() { socks.forEach(closeUdp); },
  };
}

module.exports = { kind: 'manet', create, PROFILE };
