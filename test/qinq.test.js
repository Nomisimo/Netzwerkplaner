import test from "node:test";
import assert from "node:assert/strict";
import { newVlan, emptyProject, buildIndex, validate } from "../src/shared/model.js";
import { qinqIssues, vlanPfad, vlanBaum, moeglicheAeussere, vlanNachVid } from "../src/shared/qinq.js";

const V = () => {
  const s1 = newVlan({ vid: 100, name: "Kunde A" }), s2 = newVlan({ vid: 200, name: "Kunde B" });
  const c1 = newVlan({ vid: 10, name: "Audio A", svlan: s1.id }), c2 = newVlan({ vid: 10, name: "Audio B", svlan: s2.id });
  return { s1, s2, c1, c2, all: [s1, s2, c1, c2] };
};

test("Gleiche VLAN-ID in verschiedenen S-VLANs: Warnung, kein Fehler", () => {
  const { all } = V();
  const i = qinqIssues(all);
  assert.equal(i.filter((x) => x.sev === "error").length, 0);
  assert.equal(i.filter((x) => x.sev === "warn").length, 1);
  assert.match(i[0].msg, /802\.1ad/);
});

test("Gleiche VLAN-ID in derselben Ebene: Fehler", () => {
  const { s1, c1 } = V();
  const c3 = newVlan({ vid: 10, name: "Audio C", svlan: s1.id });
  const i = qinqIssues([s1, c1, c3]);
  assert.equal(i.filter((x) => x.sev === "error").length, 1);
  const top = qinqIssues([newVlan({ vid: 5 }), newVlan({ vid: 5 })]);
  assert.equal(top[0].sev, "error");
});

test("Kreis und fehlendes äußeres VLAN werden erkannt", () => {
  const a = newVlan({ vid: 1 }), b = newVlan({ vid: 2 });
  a.svlan = b.id; b.svlan = a.id;
  assert.ok(qinqIssues([a, b]).some((x) => /Kreis/.test(x.msg)));
  assert.ok(qinqIssues([newVlan({ vid: 3, svlan: "weg" })]).some((x) => /gibt es nicht/.test(x.msg)));
});

test("Pfad, Baum, Auswahl und Suche nach ID", () => {
  const { s1, c1, all } = V();
  assert.equal(vlanPfad(c1, all), "100 › 10");
  assert.deepEqual(vlanBaum(all).map(({ v, tiefe }) => `${v.vid}:${tiefe}`), ["100:0", "10:1", "200:0", "10:1"]);
  assert.ok(!moeglicheAeussere(s1, all).some((x) => x.id === c1.id), "kein Kreis wählbar");
  const top = newVlan({ vid: 10, name: "normal" });
  assert.equal(vlanNachVid([...all, top], 10).id, top.id);
});

test("Validierung: Trunk mit zweimal derselben ID warnt", () => {
  const P = emptyProject();
  const { all, c1, c2 } = V();
  P.vlans = all;
  P.geraete.push({ id: "sw", name: "SW", isSwitch: true, typ: "switch_managed", interfaces: [], protokolle: [], ports: [{ id: "p1", name: "1", typ: "RJ45", modus: "trunk", vlans: [c1.id, c2.id], vlan: null }] });
  const issues = validate(P, buildIndex(P));
  assert.ok(issues.some((i) => /Trunk führt zweimal VLAN-ID 10/.test(i.msg)));
  assert.ok(!issues.some((i) => i.sev === "error" && /doppelt vergeben/.test(i.msg)));
});
