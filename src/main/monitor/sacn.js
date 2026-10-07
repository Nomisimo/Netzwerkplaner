// sACN (ANSI E1.31) mitlesen: Quellen, Universen, Priorität, Framerate, Kanalwerte
const { openUdp, join, leave, closeUdp, cstr, Rate, explainError, zustand, aktivZuerst, kappen, alteEntfernen } = require('./util');

// Ab wann ein Eintrag als „alt“ gilt: DMX kommt mindestens jede Sekunde, Discovery alle 10 s
const FRIST = { quelle: 3000, discovery: 35000 };

const PORT = 5568;
const ACN_ID = Buffer.from('ASC-E1.17\0\0\0', 'latin1');
const DISCOVERY_UNIVERSE = 64214;
const groupFor = (u) => `239.255.${(u >> 8) & 255}.${u & 255}`;
const cidStr = (b) => { const h = b.toString('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

// Ein E1.31-Paket zerlegen. Liefert null für alles, was kein sACN ist.
function parse(buf) {
  if (buf.length < 38 || !buf.subarray(4, 16).equals(ACN_ID)) return null;
  const rootVector = buf.readUInt32BE(18);
  const cid = cidStr(buf.subarray(22, 38));
  if (rootVector === 0x04) {
    if (buf.length < 126 || buf.readUInt32BE(40) !== 0x02 || buf[117] !== 0x02) return null;
    const count = buf.readUInt16BE(123); // inkl. Startcode
    const n = Math.max(0, Math.min(count - 1, 512, buf.length - 126));
    return {
      type: 'data', cid, source: cstr(buf, 44, 64), priority: buf[108], syncAddress: buf.readUInt16BE(109),
      sequence: buf[111], options: buf[112], preview: !!(buf[112] & 0x40), terminated: !!(buf[112] & 0x20),
      universe: buf.readUInt16BE(113), startCode: buf[125], data: buf.subarray(126, 126 + n),
    };
  }
  if (rootVector === 0x08) {
    const framing = buf.readUInt32BE(40);
    if (framing === 0x02 && buf.length >= 120 && buf.readUInt32BE(114) === 0x01) {
      const len = buf.readUInt16BE(112) & 0x0fff;
      const universes = [];
      for (let o = 120; o + 1 < Math.min(buf.length, 112 + len); o += 2) universes.push(buf.readUInt16BE(o));
      return { type: 'discovery', cid, source: cstr(buf, 44, 64), page: buf[118], lastPage: buf[119], universes };
    }
    if (framing === 0x01) return { type: 'sync', cid, syncAddress: buf.length >= 47 ? buf.readUInt16BE(45) : 0 };
  }
  return null;
}

async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const universes = new Map(); // uni → { sources: Map(cid → src), levels, prio }
  const discovered = new Map(); // cid → { source, ip, universes:Set, seen }
  let selected = null;
  let err = '';
  const wanted = new Set();

  const uni = (u) => {
    if (!universes.has(u)) universes.set(u, { sources: new Map() });
    return universes.get(u);
  };

  const onMessage = (buf, rinfo) => {
    const p = parse(buf);
    if (!p) return;
    const now = Date.now();
    if (p.type === 'discovery') {
      const d = discovered.get(p.cid) || { source: p.source, ip: rinfo.address, universes: new Set(), seen: now };
      if (p.page === 0) d.universes = new Set();
      p.universes.forEach((u) => d.universes.add(u));
      Object.assign(d, { source: p.source, ip: rinfo.address, seen: now });
      discovered.set(p.cid, d);
      ctx.dirty();
      return;
    }
    if (p.type !== 'data') return;
    const U = uni(p.universe);
    let s = U.sources.get(p.cid);
    if (!s) { s = { cid: p.cid, source: p.source, ip: rinfo.address, rate: new Rate(), seqErr: 0, lastSeq: null, levels: new Uint8Array(512), prioPerAddr: null, slots: 0 }; U.sources.set(p.cid, s); }
    // Stream-Ende: Quelle bleibt als „beendet“ stehen
    if (p.terminated) { s.beendet = true; s.seen = now; ctx.dirty(); return; }
    s.beendet = false;
    if (s.lastSeq !== null) {
      const diff = (p.sequence - s.lastSeq + 256) % 256;
      if (diff === 0 || diff > 20) s.seqErr++;
    }
    s.lastSeq = p.sequence;
    Object.assign(s, { source: p.source, ip: rinfo.address, priority: p.priority, preview: p.preview, seen: now, sync: p.syncAddress });
    if (p.startCode === 0x00) { s.levels.fill(0); s.levels.set(p.data); s.slots = p.data.length; s.rate.hit(buf.length); }
    else if (p.startCode === 0xdd) s.prioPerAddr = Uint8Array.from(p.data);
    ctx.dirty();
  };

  let res;
  try {
    res = await openUdp({ port: PORT, iface, groups: [groupFor(DISCOVERY_UNIVERSE)], onMessage });
  } catch (e) { throw new Error(explainError(e, PORT)); }

  const watch = (u) => {
    u = +u;
    if (!(u >= 1 && u <= 63999) || wanted.has(u)) return;
    wanted.add(u);
    if (!join(res, groupFor(u), iface)) err = `Beitritt zu Universum ${u} fehlgeschlagen (zu viele Multicast-Gruppen?).`;
    uni(u);
  };
  (opts.universes || [1]).forEach(watch);

  // Zusammengeführte Kanalwerte: höchste Priorität gewinnt, bei Gleichstand HTP (wie in E1.31 üblich)
  const merged = (U) => {
    const out = new Uint8Array(512);
    const live = [...U.sources.values()].filter((s) => !s.preview && !s.beendet && Date.now() - s.seen < 2500);
    if (!live.length) return { levels: out, winner: [] };
    const top = Math.max(...live.map((s) => s.priority));
    const win = live.filter((s) => s.priority === top);
    for (const s of win) for (let i = 0; i < 512; i++) if (s.levels[i] > out[i]) out[i] = s.levels[i];
    return { levels: out, winner: win.map((s) => s.cid) };
  };

  return {
    tick(dt) {
      const now = Date.now();
      for (const U of universes.values()) { for (const s of U.sources.values()) s.rate.tick(dt); kappen(U.sources); }
      kappen(discovered);
    },
    snapshot() {
      const now = Date.now();
      const list = [...universes.entries()].sort((a, b) => a[0] - b[0]).map(([u, U]) => ({
        universe: u, watched: wanted.has(u),
        sources: aktivZuerst([...U.sources.values()].map((s) => ({
          cid: s.cid, source: s.source, ip: s.ip, priority: s.priority, fps: s.rate.rate, seqErr: s.seqErr, preview: s.preview,
          slots: s.slots, perAddrPrio: !!s.prioPerAddr, sync: s.sync, age: now - s.seen, zustand: zustand(s.seen, FRIST.quelle, now, s.beendet),
        }))),
      }));
      let detail = null;
      if (selected && universes.has(selected)) {
        const m = merged(universes.get(selected));
        detail = { universe: selected, levels: Array.from(m.levels), winner: m.winner };
      }
      return {
        iface, joined: res.joined, failed: res.failed, err, universes: list, detail,
        discovery: aktivZuerst([...discovered.entries()].map(([cid, d]) => ({ cid, source: d.source, ip: d.ip, universes: [...d.universes].sort((a, b) => a - b), age: now - d.seen, zustand: zustand(d.seen, FRIST.discovery, now) }))),
      };
    },
    action(name, args = {}) {
      if (name === 'watch') { watch(args.universe); return true; }
      if (name === 'unwatch') { const u = +args.universe; wanted.delete(u); leave(res, groupFor(u), iface); universes.delete(u); if (selected === u) selected = null; return true; }
      if (name === 'watchDiscovered') { for (const d of discovered.values()) d.universes.forEach(watch); return true; }
      if (name === 'select') { selected = args.universe ? +args.universe : null; return true; }
      if (name === 'alteEntfernen') { let n = alteEntfernen(discovered, FRIST.discovery); for (const U of universes.values()) n += alteEntfernen(U.sources, FRIST.quelle); return n; }
      return false;
    },
    stop() { closeUdp(res); },
  };
}

module.exports = { kind: 'sacn', parse, create, groupFor };
