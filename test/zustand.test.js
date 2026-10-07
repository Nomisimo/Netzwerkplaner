// Live-Monitore: Einträge bleiben stehen und werden nur als „alt“ oder „beendet“ markiert
const test = require("node:test");
const assert = require("node:assert/strict");
const dgram = require("node:dgram");
const { zustand, aktivZuerst, kappen, alteEntfernen } = require("../src/main/monitor/util.js");
const sacn = require("../src/main/monitor/sacn.js");
const mdns = require("../src/main/monitor/mdns.js");

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const sende = (buf, port) => new Promise((r) => { const s = dgram.createSocket("udp4"); s.send(buf, port, "127.0.0.1", () => { s.close(); r(); }); });

test("Zustand: aktiv, alt, beendet und Sortierung", () => {
  const now = 100000;
  assert.equal(zustand(now - 1000, 3000, now), "aktiv");
  assert.equal(zustand(now - 4000, 3000, now), "alt");
  assert.equal(zustand(now, 3000, now, true), "beendet");
  const l = aktivZuerst([{ id: 1, zustand: "alt" }, { id: 2, zustand: "beendet" }, { id: 3, zustand: "aktiv" }, { id: 4, zustand: "aktiv" }]);
  assert.deepEqual(l.map((x) => x.id), [3, 4, 1, 2]);
});

test("Obergrenze und „Alte entfernen“", () => {
  const m = new Map([["a", { seen: 1 }], ["b", { seen: 3 }], ["c", { seen: 2 }]]);
  kappen(m, 2);
  assert.deepEqual([...m.keys()], ["b", "c"]);
  const n = new Map([["x", { seen: Date.now() }], ["y", { seen: 0 }], ["z", { seen: Date.now(), beendet: true }]]);
  assert.equal(alteEntfernen(n, 5000), 2);
  assert.deepEqual([...n.keys()], ["x"]);
});

function sacnData(universe, name, options = 0) {
  const b = Buffer.alloc(129);
  b.writeUInt16BE(0x10, 0);
  Buffer.from("ASC-E1.17\0\0\0", "latin1").copy(b, 4);
  b.writeUInt32BE(4, 18); Buffer.alloc(16, 0xcd).copy(b, 22);
  b.writeUInt32BE(2, 40); b.write(name, 44); b[108] = 100; b[112] = options; b.writeUInt16BE(universe, 113);
  b[117] = 2; b.writeUInt16BE(4, 123);
  return b;
}

test("sACN: Stream-Ende lässt die Quelle als „beendet“ stehen", async (t) => {
  let m;
  try { m = await sacn.create({ universes: [5] }, { dirty() {} }); } catch (e) { return t.skip(`Port 5568 belegt: ${e.message}`); }
  try {
    await sende(sacnData(5, "Pult"), 5568);
    await warte(100);
    let q = m.snapshot().universes.find((u) => u.universe === 5).sources[0];
    assert.equal(q.zustand, "aktiv");
    await sende(sacnData(5, "Pult", 0x20), 5568);
    await warte(100);
    m.tick(1000);
    q = m.snapshot().universes.find((u) => u.universe === 5).sources[0];
    assert.equal(q.source, "Pult");
    assert.equal(q.zustand, "beendet");
    assert.equal(m.action("alteEntfernen"), 1);
    assert.equal(m.snapshot().universes.find((u) => u.universe === 5).sources.length, 0);
  } finally { m.stop(); }
});

/* ── mDNS ───────────────────────────────────────────────────────────────── */
const enc = (n) => Buffer.concat([...n.split(".").map((p) => Buffer.concat([Buffer.from([Buffer.byteLength(p)]), Buffer.from(p)])), Buffer.from([0])]);
function ptrAntwort(svc, inst, ttl = 120) {
  const h = Buffer.alloc(12); h.writeUInt16BE(0x8400, 2); h.writeUInt16BE(1, 6);
  const rd = enc(inst); const f = Buffer.alloc(10);
  f.writeUInt16BE(12, 0); f.writeUInt16BE(1, 2); f.writeUInt32BE(ttl, 4); f.writeUInt16BE(rd.length, 8);
  return Buffer.concat([h, enc(svc), f, rd]);
}

test("mDNS: NDI zeigt nur _ndi._tcp, keine fremden Bonjour-Dienste; Goodbye heißt „beendet“", async () => {
  const m = await mdns.create({ services: mdns.SERVICES.ndi }, { dirty() {} });
  try {
    m.empfange(ptrAntwort("_ndi._tcp.local", "CAM1 (Studio)._ndi._tcp.local"));
    m.empfange(ptrAntwort("_airplay._tcp.local", "Wohnzimmer._airplay._tcp.local"));
    m.empfange(ptrAntwort("_netaudio-arc._udp.local", "Stagebox._netaudio-arc._udp.local"));
    let list = m.snapshot().instances;
    assert.deepEqual(list.map((i) => i.label), ["CAM1 (Studio)"]);
    assert.equal(list[0].zustand, "aktiv");
    m.empfange(ptrAntwort("_ndi._tcp.local", "CAM1 (Studio)._ndi._tcp.local", 0));
    list = m.snapshot().instances;
    assert.equal(list.length, 1);
    assert.equal(list[0].zustand, "beendet");
  } finally { m.stop(); }
});
