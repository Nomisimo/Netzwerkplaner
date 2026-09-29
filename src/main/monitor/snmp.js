// SNMPv2c (nur lesen): Portstatus, VLAN je Port (PVID), PoE und LLDP-Nachbarn von managed Switches
const dgram = require('dgram');

/* ── BER-Kodierung ─────────────────────────────────────────────────────── */
const encLen = (n) => (n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]));
const tlv = (tag, body) => Buffer.concat([Buffer.from([tag]), encLen(body.length), body]);
const encInt = (v) => {
  const bytes = [];
  let n = v;
  do { bytes.unshift(n & 255); n >>= 8; } while (n !== 0 && n !== -1);
  if (v >= 0 && bytes[0] & 0x80) bytes.unshift(0);
  if (v < 0 && !(bytes[0] & 0x80)) bytes.unshift(0xff);
  return tlv(0x02, Buffer.from(bytes));
};
const encOid = (oid) => {
  const p = oid.split('.').filter(Boolean).map(Number);
  const out = [40 * p[0] + p[1]];
  for (const n of p.slice(2)) {
    const b = [n & 0x7f];
    let x = Math.floor(n / 128);
    while (x > 0) { b.unshift((x & 0x7f) | 0x80); x = Math.floor(x / 128); }
    out.push(...b);
  }
  return tlv(0x06, Buffer.from(out));
};

function buildRequest({ community = 'public', pdu = 0xa1, id, oids, maxRep = 20 }) {
  const vbs = tlv(0x30, Buffer.concat(oids.map((o) => tlv(0x30, Buffer.concat([encOid(o), Buffer.from([0x05, 0x00])])))));
  // GetBulk: non-repeaters 0, max-repetitions statt error-status/-index
  const body = Buffer.concat([encInt(id), encInt(0), encInt(pdu === 0xa5 ? maxRep : 0), vbs]);
  return tlv(0x30, Buffer.concat([encInt(1), tlv(0x04, Buffer.from(community)), tlv(pdu, body)]));
}

function readTlv(buf, o) {
  const tag = buf[o];
  let len = buf[o + 1], hl = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + buf[o + 2 + i]; hl = 2 + n; }
  return { tag, start: o + hl, end: o + hl + len };
}
const decOid = (b) => {
  const out = [Math.floor(b[0] / 40), b[0] % 40];
  let n = 0;
  for (let i = 1; i < b.length; i++) { n = n * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { out.push(n); n = 0; } }
  return out.join('.');
};
const decUint = (b) => { let n = 0; for (const x of b) n = n * 256 + x; return n; };
const decInt = (b) => { const u = decUint(b); return b.length && b[0] & 0x80 ? u - 2 ** (8 * b.length) : u; };

function decValue(tag, b) {
  switch (tag) {
    case 0x02: return decInt(b);
    case 0x04: return b; // Buffer, Auswertung je OID
    case 0x05: return null;
    case 0x06: return decOid(b);
    case 0x40: return [...b].join('.');
    case 0x41: case 0x42: case 0x43: case 0x46: return decUint(b);
    case 0x80: case 0x81: case 0x82: return undefined; // noSuchObject/-Instance, endOfMibView
    default: return b;
  }
}

function parseResponse(buf) {
  const seq = readTlv(buf, 0);
  let o = seq.start;
  const ver = readTlv(buf, o); o = ver.end;
  const com = readTlv(buf, o); o = com.end;
  const pdu = readTlv(buf, o); o = pdu.start;
  const id = readTlv(buf, o); o = id.end;
  const es = readTlv(buf, o); o = es.end;
  const ei = readTlv(buf, o); o = ei.end;
  const vbl = readTlv(buf, o); o = vbl.start;
  const out = [];
  while (o < vbl.end) {
    const vb = readTlv(buf, o);
    const oid = readTlv(buf, vb.start);
    const val = readTlv(buf, oid.end);
    out.push({ oid: decOid(buf.subarray(oid.start, oid.end)), tag: val.tag, value: decValue(val.tag, buf.subarray(val.start, val.end)) });
    o = vb.end;
  }
  return { id: decUint(buf.subarray(id.start, id.end)), error: decUint(buf.subarray(es.start, es.end)), varbinds: out };
}

/* ── Client ────────────────────────────────────────────────────────────── */
class Client {
  constructor(host, community = 'public', timeout = 1500, port = 161) {
    this.host = host; this.port = port; this.community = community; this.timeout = timeout; this.id = Math.floor(Math.random() * 1e6); this.pending = new Map();
    this.sock = dgram.createSocket('udp4');
    this.sock.on('error', () => {});
    this.sock.on('message', (buf) => {
      let r; try { r = parseResponse(buf); } catch { return; }
      const p = this.pending.get(r.id);
      if (p) { this.pending.delete(r.id); clearTimeout(p.t); p.resolve(r); }
    });
  }
  request(pdu, oids, tries = 2) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const send = (left) => {
        const t = setTimeout(() => { this.pending.delete(id); left > 1 ? send(left - 1) : reject(new Error(`Keine SNMP-Antwort von ${this.host} (Community, ACL oder SNMP aus?)`)); }, this.timeout);
        this.pending.set(id, { resolve, t });
        this.sock.send(buildRequest({ community: this.community, pdu, id, oids }), this.port, this.host);
      };
      send(tries);
    });
  }
  async get(oids) { return (await this.request(0xa0, oids)).varbinds; }
  // Tabelle per GetBulk ablaufen, bis die OID den Teilbaum verlässt
  async walk(root, limit = 3000) {
    const out = [];
    let cur = root;
    while (out.length < limit) {
      const r = await this.request(0xa5, [cur]);
      if (r.error) break;
      let done = false;
      for (const vb of r.varbinds) {
        if (!vb.oid.startsWith(root + '.') || vb.value === undefined) { done = true; break; }
        out.push(vb); cur = vb.oid;
      }
      if (done || !r.varbinds.length) break;
    }
    return out;
  }
  close() { try { this.sock.close(); } catch {} }
}

const OID = {
  sysDescr: '1.3.6.1.2.1.1.1.0', sysUpTime: '1.3.6.1.2.1.1.3.0', sysName: '1.3.6.1.2.1.1.5.0', sysLocation: '1.3.6.1.2.1.1.6.0',
  ifDescr: '1.3.6.1.2.1.2.2.1.2', ifType: '1.3.6.1.2.1.2.2.1.3', ifOper: '1.3.6.1.2.1.2.2.1.8', ifAdmin: '1.3.6.1.2.1.2.2.1.7', ifPhys: '1.3.6.1.2.1.2.2.1.6',
  ifName: '1.3.6.1.2.1.31.1.1.1.1', ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15', ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
  ifInOctets: '1.3.6.1.2.1.31.1.1.1.6', ifOutOctets: '1.3.6.1.2.1.31.1.1.1.10', ifInErrors: '1.3.6.1.2.1.2.2.1.14',
  basePortIfIndex: '1.3.6.1.2.1.17.1.4.1.2', pvid: '1.3.6.1.2.1.17.7.1.4.5.1.1', vlanName: '1.3.6.1.2.1.17.7.1.4.3.1.1',
  vlanEgress: '1.3.6.1.2.1.17.7.1.4.3.1.2', vlanUntagged: '1.3.6.1.2.1.17.7.1.4.3.1.4',
  poeStatus: '1.3.6.1.2.1.105.1.1.1.6', poePower: '1.3.6.1.2.1.105.1.3.1.1.4',
  lldpLocPortDesc: '1.0.8802.1.1.2.1.3.7.1.4', lldpLocPortId: '1.0.8802.1.1.2.1.3.7.1.3',
  lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7', lldpRemPortDesc: '1.0.8802.1.1.2.1.4.1.1.8', lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9',
  lldpRemMgmtAddr: '1.0.8802.1.1.2.1.4.2.1.4',
};

const str = (v) => (Buffer.isBuffer(v) ? (/^[\x09\x0a\x0d\x20-\x7e]*$/.test(v.toString('latin1')) ? v.toString('latin1') : v.toString('hex').match(/../g)?.join(':') || '') : v == null ? '' : String(v));
const idx = (oid, root) => oid.slice(root.length + 1);
// Portliste (Bitmaske, Bit 1 = Brückenport 1) → Set der Brückenports
const portBits = (b) => { const s = new Set(); if (!Buffer.isBuffer(b)) return s; for (let i = 0; i < b.length; i++) for (let j = 0; j < 8; j++) if (b[i] & (0x80 >> j)) s.add(i * 8 + j + 1); return s; };
const POE = { 1: 'aus', 2: 'sucht', 3: 'liefert', 4: 'Fehler', 5: 'Test', 6: 'Fehler' };

async function readSwitch(host, community, port = 161) {
  const c = new Client(host, community, 1500, port);
  try {
    const sys = await c.get([OID.sysDescr, OID.sysUpTime, OID.sysName, OID.sysLocation]);
    const w = async (k) => { try { return await c.walk(OID[k]); } catch { return []; } };
    // Höchstens 4 Tabellen gleichzeitig, damit kleine Switch-CPUs nicht überlastet werden
    const keys = ['ifDescr', 'ifType', 'ifOper', 'ifAdmin', 'ifName', 'ifHighSpeed', 'ifAlias', 'ifPhys', 'basePortIfIndex', 'pvid', 'vlanName', 'vlanEgress', 'vlanUntagged', 'poeStatus', 'lldpRemPortId', 'lldpRemPortDesc', 'lldpRemSysName', 'lldpLocPortDesc', 'lldpLocPortId', 'ifInErrors'];
    const tables = [];
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < keys.length) { const i = next++; tables[i] = await w(keys[i]); } }));
    const [descr, type, oper, admin, name, speed, alias, phys, bp, pvid, vname, egress, untagged, poe, lrp, lrpd, lrn, llp, llpId, inErr] = tables;
    const ports = new Map();
    const P = (i) => { if (!ports.has(i)) ports.set(i, { ifIndex: +i }); return ports.get(i); };
    const map = (list, key, fn = (v) => v) => list.forEach((vb) => { P(idx(vb.oid, OID[key]))[key] = fn(vb.value); });
    map(descr, 'ifDescr', str); map(type, 'ifType'); map(oper, 'ifOper'); map(admin, 'ifAdmin'); map(name, 'ifName', str); map(speed, 'ifHighSpeed'); map(alias, 'ifAlias', str); map(phys, 'ifPhys', str); map(inErr, 'ifInErrors');
    // Brückenport → ifIndex
    const bpToIf = new Map(bp.map((vb) => [+idx(vb.oid, OID.basePortIfIndex), String(vb.value)]));
    const ifOfBp = (n) => bpToIf.get(n) || String(n);
    pvid.forEach((vb) => { P(ifOfBp(+idx(vb.oid, OID.pvid))).pvid = vb.value; });
    const vlans = vname.map((vb) => ({ vid: +idx(vb.oid, OID.vlanName).split('.').pop(), name: str(vb.value) }));
    // Tagged/untagged je Port aus den statischen VLAN-Tabellen
    const untag = new Map(untagged.map((vb) => [+idx(vb.oid, OID.vlanUntagged).split('.').pop(), portBits(vb.value)]));
    for (const vb of egress) {
      const vid = +idx(vb.oid, OID.vlanEgress).split('.').pop();
      for (const n of portBits(vb.value)) {
        const p = P(ifOfBp(n));
        (untag.get(vid)?.has(n) ? (p.untagged ||= []) : (p.tagged ||= [])).push(vid);
      }
    }
    // PoE: Index Gruppe.Port – Port meist = Brückenport
    poe.forEach((vb) => { const port = +idx(vb.oid, OID.poeStatus).split('.').pop(); P(ifOfBp(port)).poe = POE[vb.value] || String(vb.value); });
    // LLDP: Index timeMark.localPort.remIndex; localPort meist = Brückenport
    const locDesc = new Map(llp.map((vb) => [+idx(vb.oid, OID.lldpLocPortDesc), str(vb.value)]));
    const nb = new Map();
    const lk = (vb, key) => { const [, lp, ri] = idx(vb.oid, OID[key]).split('.'); const k = `${lp}.${ri}`; if (!nb.has(k)) nb.set(k, { localPort: +lp }); nb.get(k)[key] = str(vb.value); };
    lrp.forEach((vb) => lk(vb, 'lldpRemPortId')); lrpd.forEach((vb) => lk(vb, 'lldpRemPortDesc')); lrn.forEach((vb) => lk(vb, 'lldpRemSysName'));
    for (const n of nb.values()) {
      const p = P(ifOfBp(n.localPort));
      (p.lldp ||= []).push({ system: n.lldpRemSysName || '', port: n.lldpRemPortDesc || n.lldpRemPortId || '', localDesc: locDesc.get(n.localPort) || '' });
    }
    // Nur physische Ethernet-Ports (ifType 6 = ethernetCsmacd, 117 = gigabitEthernet) oder solche mit Brückenport
    const bridgeIfs = new Set(bpToIf.values());
    const list = [...ports.values()].filter((p) => p.ifDescr !== undefined && (p.ifType === 6 || p.ifType === 117 || bridgeIfs.has(String(p.ifIndex)))).sort((a, b) => a.ifIndex - b.ifIndex);
    const s = Object.fromEntries(sys.map((vb) => [Object.keys(OID).find((k) => OID[k] === vb.oid), vb.value]));
    return {
      host, t: Date.now(), sysName: str(s.sysName), sysDescr: str(s.sysDescr), sysLocation: str(s.sysLocation), uptime: s.sysUpTime ? Math.round(s.sysUpTime / 100) : null,
      ports: list.map((p) => ({ ...p, up: p.ifOper === 1, adminUp: p.ifAdmin === 1 })), vlans,
      supports: { qbridge: pvid.length > 0, lldp: nb.size > 0 || llpId.length > 0, poe: poe.length > 0 },
    };
  } finally { c.close(); }
}

async function create(opts = {}, ctx) {
  const results = new Map(), busy = new Set(), errors = new Map();
  let timer = null, autoTargets = [];
  const query = async ({ host, community = 'public' }) => {
    if (!host || busy.has(host)) return false;
    busy.add(host); errors.delete(host); ctx.dirty();
    try { results.set(host, await readSwitch(host, community)); }
    catch (e) { errors.set(host, e.message); }
    busy.delete(host); ctx.dirty();
    return true;
  };
  return {
    tick() {},
    snapshot() { return { results: Object.fromEntries(results), busy: [...busy], errors: Object.fromEntries(errors), auto: !!timer }; },
    action(name, args = {}) {
      if (name === 'query') { query(args); return true; }
      if (name === 'auto') {
        clearInterval(timer); timer = null; autoTargets = args.targets || [];
        if (args.on && autoTargets.length) { autoTargets.forEach(query); timer = setInterval(() => autoTargets.forEach(query), 10000); }
        return !!timer;
      }
      return false;
    },
    stop() { clearInterval(timer); },
  };
}

module.exports = { kind: "snmp", create, buildRequest, parseResponse, encOid, decOid, encInt, tlv, portBits, Client, readSwitch, OID };
