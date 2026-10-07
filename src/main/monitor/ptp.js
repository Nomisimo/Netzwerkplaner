// PTP-Clock mitlesen (Dante nutzt PTPv1, AES67 PTPv2):
// Wer ist Master bzw. Grandmaster, in welcher Domain, wie oft kommt Sync, gibt es konkurrierende Master?
const { openUdp, closeUdp, cstr, mac, Rate, explainError, zustand, aktivZuerst, kappen, alteEntfernen } = require('./util');

const FRIST = 5000; // Sync/Announce/Delay_Req kommen jede Sekunde oder öfter

const GROUP = '224.0.1.129';
const PORTS = [319, 320];
const V1_CONTROL = ['Sync', 'Delay_Req', 'Follow_Up', 'Delay_Resp', 'Management'];
const V2_TYPES = { 0: 'Sync', 1: 'Delay_Req', 2: 'Pdelay_Req', 3: 'Pdelay_Resp', 8: 'Follow_Up', 9: 'Delay_Resp', 10: 'Pdelay_Resp_Follow_Up', 11: 'Announce', 12: 'Signaling', 13: 'Management' };
const hex = (buf, s, n) => [...buf.subarray(s, s + n)].map((b) => b.toString(16).padStart(2, '0')).join('');

function parse(buf) {
  if (buf.length < 34) return null;
  // PTPv1 (IEEE 1588-2002): versionPTP als uint16 am Anfang
  if (buf.readUInt16BE(0) === 1 && buf.length >= 40) {
    const out = {
      version: 1, domain: cstr(buf, 4, 16) || '_DFLT', type: V1_CONTROL[buf[32]] || `Control ${buf[32]}`,
      clock: mac(buf, 22), port: buf.readUInt16BE(28), seq: buf.readUInt16BE(30),
    };
    // Sync-/Delay_Req-Nachricht: Grandmaster-Angaben (Offsets nach Wireshark-Dissector packet-ptp.c)
    if (buf[20] === 1 && buf.length >= 84) {
      out.gm = mac(buf, 54);
      out.stratum = buf[67];
      out.gmIdent = cstr(buf, 68, 4);
      out.preferred = !!buf[77];
      out.syncInterval = buf.readInt8(83);
    }
    return out;
  }
  // PTPv2 (IEEE 1588-2008)
  if ((buf[1] & 0x0f) === 2) {
    const t = buf[0] & 0x0f;
    const out = {
      version: 2, domain: String(buf[4]), type: V2_TYPES[t] || `Typ ${t}`,
      clock: hex(buf, 20, 8), port: buf.readUInt16BE(28), seq: buf.readUInt16BE(30), logInterval: buf.readInt8(33),
    };
    if (t === 11 && buf.length >= 64) {
      Object.assign(out, {
        prio1: buf[47], clockClass: buf[48], accuracy: buf[49], variance: buf.readUInt16BE(50), prio2: buf[52],
        gm: hex(buf, 53, 8), stepsRemoved: buf.readUInt16BE(61), timeSource: buf[63],
      });
    }
    return out;
  }
  return null;
}

async function create(opts = {}, ctx) {
  const iface = opts.iface || '';
  const clocks = new Map(); // version|domain|clock → Eintrag
  const socks = [], errors = [];
  const onMessage = (buf, rinfo) => {
    const p = parse(buf);
    if (!p) return;
    const k = `${p.version}|${p.domain}|${p.clock}`;
    let c = clocks.get(k);
    if (!c) { c = { version: p.version, domain: p.domain, clock: p.clock, ip: rinfo.address, sync: new Rate(), announce: new Rate(), delayReq: new Rate(), info: {} }; clocks.set(k, c); }
    c.ip = rinfo.address; c.seen = Date.now();
    if (p.type === 'Sync') { c.sync.hit(); c.lastSync = c.seen; }
    if (p.type === 'Announce') { c.announce.hit(); c.lastAnnounce = c.seen; }
    if (p.type === 'Delay_Req') c.delayReq.hit();
    for (const f of ['gm', 'stratum', 'gmIdent', 'preferred', 'syncInterval', 'prio1', 'prio2', 'clockClass', 'accuracy', 'stepsRemoved', 'timeSource', 'logInterval']) {
      if (p[f] !== undefined && (p.type === 'Sync' || p.type === 'Announce')) c.info[f] = p[f];
    }
    ctx.dirty();
  };
  for (const port of PORTS) {
    try { socks.push(await openUdp({ port, iface, groups: [GROUP], onMessage })); }
    catch (e) { errors.push(explainError(e, port)); }
  }
  if (!socks.length) throw new Error(errors.join(' '));
  return {
    tick(dt) {
      for (const c of clocks.values()) { c.sync.tick(dt); c.announce.tick(dt); c.delayReq.tick(dt); }
      kappen(clocks);
    },
    snapshot() {
      const now = Date.now();
      const list = aktivZuerst([...clocks.values()].map((c) => ({
        version: c.version, domain: c.domain, clock: c.clock, ip: c.ip, age: now - c.seen,
        syncRate: c.sync.rate, announceRate: c.announce.rate, delayReqRate: c.delayReq.rate,
        isMaster: !!c.lastSync && now - c.lastSync < 5000 || !!c.lastAnnounce && now - c.lastAnnounce < 5000,
        zustand: zustand(c.seen, FRIST, now), warMaster: !!(c.lastSync || c.lastAnnounce),
        ...c.info,
      })));
      // Mehr als ein sendender Master je Domain → Warnung
      const byDomain = {};
      for (const c of list.filter((c) => c.isMaster)) (byDomain[`v${c.version} ${c.domain}`] ||= []).push(c.ip);
      const conflicts = Object.entries(byDomain).filter(([, ips]) => ips.length > 1).map(([d, ips]) => ({ domain: d, ips }));
      return { iface, errors, clocks: list, conflicts, followers: list.filter((c) => !c.isMaster && c.zustand === 'aktiv').length };
    },
    action(name) {
      if (name === 'clear') { clocks.clear(); return true; }
      if (name === 'alteEntfernen') return alteEntfernen(clocks, FRIST);
      return false;
    },
    stop() { socks.forEach(closeUdp); },
  };
}

module.exports = { kind: 'ptp', parse, create };
