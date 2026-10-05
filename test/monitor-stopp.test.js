// Gestoppte Live-Monitore behalten ihren letzten Stand, bis man ihn verwirft
const test = require("node:test");
const assert = require("node:assert");
const { createManager, MODULES } = require("../src/main/monitor/index.js");

test("Stoppen behält die Einträge, Verwerfen entfernt sie", async () => {
  const sent = [];
  let eintraege = [];
  const orig = MODULES.osc;
  MODULES.osc = { create: async () => ({ tick() {}, snapshot: () => ({ list: [...eintraege] }), action() {}, stop() { eintraege = []; } }) };
  const m = createManager((msg) => sent.push(msg));
  try {
    assert.ok((await m.start("osc", { iface: "x" })).ok);
    eintraege = ["a", "b"];
    await m.stop("osc");
    const last = sent[sent.length - 1];
    assert.strictEqual(last.running, false);
    assert.deepStrictEqual(last.snapshot, { list: ["a", "b"] });
    assert.ok(last.stopped > 0);
    assert.deepStrictEqual(m.state().osc.snapshot, { list: ["a", "b"] });
    assert.ok((await m.action("osc", "verwerfen")).ok);
    assert.strictEqual(m.state().osc, undefined);
    assert.deepStrictEqual(sent[sent.length - 1], { kind: "osc", running: false });
  } finally {
    m.stopAll();
    MODULES.osc = orig;
  }
});
