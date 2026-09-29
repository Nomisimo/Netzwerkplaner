import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex, validate, emptyProject, addConnection } from "../src/shared/model.js";
import { createDevice } from "../src/shared/catalog.js";
import { demoProject } from "../src/shared/demo.js";
import { KERN_BY_ID, defaultParams, streamRate } from "../src/shared/kernprotokolle.js";
import { statistik, leitungslast, analyseIssues, danteHops, pfad, switchHops, laufzeit, newStream } from "../src/shared/analyse.js";

const rate = (proto, menge, param = {}) => streamRate({ proto, menge, param });

test("Bandbreitenmodelle liefern plausible Richtwerte", () => {
  // Dante 48 kHz / 24 bit, 4 Kanäle je Flow: rund 6 Mbit/s je Flow
  const d = rate("dante", 4);
  assert.equal(d.flows, 1);
  assert.ok(d.mbit > 5 && d.mbit < 7, `Dante 4 Kanäle: ${d.mbit}`);
  assert.equal(rate("dante", 64).flows, 16);
  // sACN: 16 Universen bei 44 Hz ≈ 4 Mbit/s
  const s = rate("sacn", 16);
  assert.ok(s.mbit > 3.5 && s.mbit < 4.5, `sACN: ${s.mbit}`);
  assert.equal(s.gruppen, 16);
  assert.equal(rate("ndi", 2, { variante: "full", format: "1080p50" }).mbit, 210);
  assert.equal(rate("ndi", 1, { variante: "hx2", format: "1080p60" }).mbit, 15);
  assert.ok(rate("osc", 50).mbit < 0.1);
  for (const id of Object.keys(KERN_BY_ID)) assert.ok(Number.isFinite(rate(id, KERN_BY_ID[id].menge, defaultParams(id)).mbit), id);
});

test("Demo: Statistik, Leitungslast und Dante-Hops", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const S = statistik(P, X);
  assert.equal(S.summe.danteKanaele, 32 + 32 + 16 + 24 + 4);
  assert.equal(S.summe.universen, 8 + 24);
  assert.ok(S.summe.mbit > 100);
  const L = leitungslast(P, X);
  assert.ok(L.length > 10);
  assert.ok(L.every((l) => l.last < 1), "keine Leitung überlastet");
  // Die Kamera sendet NDI ohne Empfänger → Worst Case Richtung Core über den FOH-Uplink
  const up = L.find((l) => X.devById.get(l.child).name === "SW FOH");
  assert.ok(up.hoch >= 105, `FOH-Uplink hoch ${up.hoch}`);
  const dh = danteHops(P, X);
  assert.ok(dh.hops >= 2 && dh.hops <= 3, `hops ${dh.hops}`);
  assert.equal(dh.empfehlung, "0,25 ms");
  assert.equal(validate(P, X).concat(analyseIssues(P, X)).filter((i) => i.sev === "error").length, 0);
});

test("Multicast ohne IGMP flutet und Überlast wird gemeldet", () => {
  const P = emptyProject();
  const v20 = P.vlans.find((v) => v.vid === 20);
  v20.igmp = false;
  const sw = createDevice({ typ: "switch_managed", vlans: P.vlans, name: "SW" });
  const a = createDevice({ typ: "lichtpult", vlans: P.vlans, name: "Pult" });
  const b = createDevice({ typ: "node", vlans: P.vlans, name: "Node" });
  P.geraete.push(sw, a, b);
  addConnection(P, sw.id, a.id);
  addConnection(P, sw.id, b.id);
  a.stroeme = [newStream({ proto: "sacn", menge: 64 })];
  let X = buildIndex(P);
  const toNode = leitungslast(P, X).find((l) => l.child === b.id);
  assert.ok(toNode.runter > 15, "sACN flutet zum Node");
  assert.ok(analyseIssues(P, X).some((i) => /ohne IGMP/.test(i.msg)));
  v20.igmp = true;
  X = buildIndex(P);
  assert.equal(leitungslast(P, X).find((l) => l.child === b.id).runter, 0);
  a.stroeme = [newStream({ proto: "ndi", menge: 10 })];
  a.interfaces[0].vlan = v20.id;
  X = buildIndex(P);
  assert.ok(analyseIssues(P, X).some((i) => i.sev === "error" && /übersteigt/.test(i.msg)));
});

test("Pfad, Hops und Laufzeit", () => {
  const P = demoProject();
  const X = buildIndex(P);
  const cl5 = P.geraete.find((d) => d.name === "FOH CL5");
  const rio = P.geraete.find((d) => d.name === "Rio A");
  const v10 = P.vlans.find((v) => v.vid === 10).id;
  assert.equal(switchHops(pfad(P, X, cl5.id, rio.id, v10), X), 2); // Primary: FOH → Core
  assert.equal(switchHops(pfad(P, X, cl5.id, rio.id), X), 1); // kürzester Weg: Secondary-Switch
  const t = laufzeit({ hops: 3, mbit: 1000, bytes: 1500, switchUs: 3, meter: 100, queue: false });
  assert.ok(Math.abs(t.ser - 12.3) < 0.1);
  assert.ok(t.gesamt > 40 && t.gesamt < 60);
});
