// Art-Net 4 mitlesen: Nodes per ArtPoll finden, ArtDmx-Universen und Kanalwerte anzeigen
const { openUdp, closeUdp, cstr, mac, Rate, explainError, listInterfaces } = require('./util');

const PORT = 6454;
const ID = Buffer.from('Art-Net\0', 'latin1');
const OP = { POLL: 0x2000, POLL_REPLY: 0x2100, DMX: 0x5000, SYNC: 0x5200, ADDRESS: 0x6000, TOD_DATA: 0x8100, RDM: 0x8300 };
const OP_NAMES = { 0x2000: 'ArtPoll', 0x2100: 'ArtPollReply', 0x5000: 'ArtDmx', 0x5200: 'ArtSync', 0x6000: 'ArtAddress', 0x8000: 'ArtTodRequest', 0x8100: 'ArtTodData', 0x8300: 'ArtRdm', 0xf800: 'ArtFirmwareMaster', 0x9700: 'ArtTimeCode' };

// Anzeige wie in den meisten Pulten: Net:Sub:Uni (z. B. 0:0:1) und 15-bit-Portadresse
const fmtPortAddr = (pa) => `${(pa >> 8) & 0x7f}:${(pa >> 4) & 0x0f}:${pa & 0x0f}`;

function parse(buf) {
  if (buf.length < 10 || !buf.subarray(0, 8).equals(ID)) return null;
  const op = buf.readUInt16LE(8);
  if (op === OP.DMX && buf.length >= 18) {
    const len = Math.min(buf.readUInt16BE(16), 512, buf.length - 18);
    return { op, sequence: buf[12], physical: buf[13], portAddress: ((buf[15] & 0x7f) << 8) | buf[14], data: buf.subarray(18, 18 + len) };
  }
  if (op === OP.POLL_REPLY && buf.length >= 207) {
    const ip = [...buf.subarray(10, 14)].join('.');
    const net = buf[18], sub = buf[19];
    const numPorts = Math.min(buf.readUInt16BE(172), 4);
    const ports = [];
    for (let i = 0; i < 4; i++) {
      const t = buf[174 + i];
      if (!t) continue;
      const proto = ['DMX512', 'MIDI', 'Avab', 'Colortran CMX', 'ADB 62.5', 'Art-Net', 'DALI'][t & 0x3f] || 'anderes';
      if (t & 0x80) ports.push({ dir: 'out', proto, portAddress: (net << 8) | (sub << 4) | (buf[190 + i] & 0x0f), good: buf[182 + i] });
      if (t & 0x40) ports.push({ dir: 'in', proto, portAddress: (net << 8) | (sub << 4) | (buf[186 + i] & 0x0f), good: buf[178 + i] });
    }
    return {
      op, ip, udpPort: buf.readUInt16LE(14), version: buf.readUInt16BE(16), oem: buf.readUInt16BE(20),
      esta: String.fromCharCode(buf[25] || 32, buf[24] || 32).trim(), shortName: cstr(buf, 26, 18), longName: cstr(buf, 44, 64),
      report: cstr(buf, 108, 64), numPorts, ports, style: buf[200], mac: mac(buf, 201),
      bindIp: buf.length >= 211 ? [...buf.subarray(207, 211)].join('.') : ip, bindIndex: buf.length >= 212 ? buf[211] : 0,
      dhcp: buf.length >= 213 ? !!(buf[212] & 0x02) : null,
    };
  }
  return { op };
}

// ArtPoll nach Art-Net 4 (14 Byte, ohne Zielbereich)
const pollPacket = () => Buffer.concat([ID, Buffer.from([0x00, 0x20, 0, 14, 0x00, 0x00])]);

async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const nodes = new Map(); // ip#bind → node
  const universes = new Map(); // portAddr → { senders: Map(ip → {rate, levels, seq}) }
  const ops = new Map(); // op → Rate
  const controllers = new Map(); // ip → Zeitpunkt des letzten ArtPoll
  let selected = null, lastPoll = 0, autoTimer = null;
  const own = new Set(listInterfaces().map((i) => i.address)); // eigene ArtPolls nicht als Pult zählen

  const onMessage = (buf, rinfo) => {
    const p = parse(buf);
    if (!p) return;
    if (!ops.has(p.op)) ops.set(p.op, new Rate());
    ops.get(p.op).hit(buf.length);
    const now = Date.now();
    if (p.op === OP.POLL) { if (!own.has(rinfo.address)) controllers.set(rinfo.address, now); ctx.dirty(); return; }
    if (p.op === OP.POLL_REPLY) {
      nodes.set(`${p.ip}#${p.bindIndex}`, { ...p, from: rinfo.address, seen: now });
      ctx.dirty(); return;
    }
    if (p.op === OP.DMX) {
      if (!universes.has(p.portAddress)) universes.set(p.portAddress, { senders: new Map() });
      const U = universes.get(p.portAddress);
      let s = U.senders.get(rinfo.address);
      if (!s) { s = { rate: new Rate(), levels: new Uint8Array(512), slots: 0 }; U.senders.set(rinfo.address, s); }
      s.rate.hit(buf.length); s.levels.fill(0); s.levels.set(p.data); s.slots = p.data.length; s.seen = now;
      ctx.dirty();
    }
  };

  let res;
  try { res = await openUdp({ port: PORT, iface, broadcast: true, onMessage }); }
  catch (e) { throw new Error(explainError(e, PORT)); }

  const targets = () => {
    const ifs = listInterfaces();
    const sel = iface ? ifs.filter((i) => i.address === iface) : ifs;
    return [...new Set(sel.map((i) => i.broadcast))];
  };
  const poll = () => {
    lastPoll = Date.now();
    const pkt = pollPacket();
    for (const t of targets()) res.sock.send(pkt, PORT, t, () => {});
    return targets();
  };
  if (opts.poll) poll(); // standardmäßig passiv, ArtPoll nur auf Knopfdruck

  return {
    tick(dt) {
      const now = Date.now();
      for (const r of ops.values()) r.tick(dt);
      for (const U of universes.values()) for (const [ip, s] of U.senders) { s.rate.tick(dt); if (now - s.seen > 10000) U.senders.delete(ip); }
      for (const [pa, U] of universes) if (!U.senders.size) universes.delete(pa);
      for (const [ip, t] of controllers) if (now - t > 30000) controllers.delete(ip);
    },
    snapshot() {
      const now = Date.now();
      let detail = null;
      if (selected !== null && universes.has(selected)) {
        const out = new Uint8Array(512);
        for (const s of universes.get(selected).senders.values()) for (let i = 0; i < 512; i++) if (s.levels[i] > out[i]) out[i] = s.levels[i];
        detail = { portAddress: selected, label: fmtPortAddr(selected), levels: Array.from(out) };
      }
      return {
        iface, lastPoll, autoPoll: !!autoTimer, targets: targets(),
        nodes: [...nodes.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })).map((n) => ({
          ip: n.ip, bindIndex: n.bindIndex, shortName: n.shortName, longName: n.longName, report: n.report, mac: n.mac, esta: n.esta,
          oem: n.oem, version: n.version, dhcp: n.dhcp, ports: n.ports.map((p) => ({ ...p, label: fmtPortAddr(p.portAddress) })), age: now - n.seen,
        })),
        universes: [...universes.entries()].sort((a, b) => a[0] - b[0]).map(([pa, U]) => ({
          portAddress: pa, label: fmtPortAddr(pa),
          senders: [...U.senders.entries()].map(([ip, s]) => ({ ip, fps: s.rate.rate, slots: s.slots, age: now - s.seen })),
        })),
        controllers: [...controllers.entries()].map(([ip, t]) => ({ ip, age: now - t })),
        ops: [...ops.entries()].map(([op, r]) => ({ op, name: OP_NAMES[op] || `0x${op.toString(16)}`, rate: r.rate, total: r.total })),
        detail,
      };
    },
    action(name, args = {}) {
      if (name === 'poll') return poll();
      if (name === 'autoPoll') {
        clearInterval(autoTimer); autoTimer = null;
        if (args.on) autoTimer = setInterval(poll, 10000);
        return !!autoTimer;
      }
      if (name === 'clearNodes') { nodes.clear(); return true; }
      if (name === 'select') { selected = args.portAddress === null || args.portAddress === undefined ? null : +args.portAddress; return true; }
      return false;
    },
    stop() { clearInterval(autoTimer); closeUdp(res); },
  };
}

module.exports = { kind: 'artnet', parse, create, pollPacket, fmtPortAddr };
