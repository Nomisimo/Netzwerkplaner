import test from "node:test";
import assert from "node:assert/strict";
import { anordnen, stapeln, entstapeln, stapelAnker, positionenSichern, knickPfad } from "../src/shared/anordnung.js";
import { NODE_H } from "../src/shared/layout.js";

const L = () => ({ pos: new Map([["core", { x: 0, y: 0 }], ["sw", { x: 300, y: 0 }], ["a", { x: 600, y: -40 }], ["b", { x: 600, y: 40 }]]), bounds: {} });
const eltern = new Map([["sw", "core"], ["a", "sw"], ["b", "sw"]]);

test("Angepinntes Gerät bleibt stehen, sein Ast folgt ihm", () => {
  const R = anordnen(L(), { ziele: { sw: { x: 300, y: 500 } }, eltern });
  assert.deepEqual([R.pos.get("sw").x, R.pos.get("sw").y], [300, 500]);
  assert.equal(R.pos.get("a").y, 460);
  assert.equal(R.pos.get("core").y, 0);
});

test("Fixierter Nachfahre bleibt, auch wenn der Ast wandert", () => {
  const R = anordnen(L(), { ziele: { sw: { x: 300, y: 500 }, b: { x: 900, y: 900 } }, eltern });
  assert.deepEqual([R.pos.get("b").x, R.pos.get("b").y], [900, 900]);
  assert.equal(R.pos.get("a").y, 460);
});

test("Auto-Anordnen aus: gesicherte Positionen gelten für alle", () => {
  const fix = positionenSichern(anordnen(L(), { eltern }));
  const neu = L(); neu.pos.get("sw").y = 999; // Layout hat sich geändert
  const R = anordnen(neu, { ziele: fix, eltern });
  assert.equal(R.pos.get("sw").y, 0);
});

test("Stapel: Geräte stehen lückenlos unter dem Anker", () => {
  let st = stapeln([], "a", "b", "s1");
  st = stapeln(st, "a", "sw", "s2");
  assert.deepEqual(st[0].ids, ["a", "b", "sw"]);
  assert.equal(stapelAnker(st, "sw"), "a");
  const R = anordnen(L(), { stapel: st });
  assert.equal(R.pos.get("b").x, 600);
  assert.equal(R.pos.get("b").y, -40 + NODE_H + 6);
  assert.equal(R.pos.get("sw").y, -40 + 2 * (NODE_H + 6));
  assert.equal(R.stapel.length, 1);
  assert.deepEqual(entstapeln(entstapeln(st, "b"), "sw"), []);
});

test("Knickpfad läuft durch den Knickpunkt", () => {
  assert.equal(knickPfad(0, 0, 100, 50, { x: 70, y: 10 }, "h", "eckig"), "M0,0 L70,0 L70,50 L100,50");
  assert.match(knickPfad(0, 0, 100, 50, { x: 70, y: 10 }, "h", "rund"), / 70,10 C/);
});

test("Kabel: einzeln auf eigenen Spuren, gebündelt als eine Linie", async () => {
  const { kabelSpuren } = await import("../src/shared/anordnung.js");
  const k = [
    { id: "a", von: "sw", nach: "x", seite: "h1", start: 0, ziel: -100 },
    { id: "b", von: "sw", nach: "y", seite: "h1", start: 0, ziel: 100 },
    { id: "c", von: "sw", nach: "y", seite: "h1", start: 0, ziel: 100 },
  ];
  const sp = kabelSpuren(k, "spuren");
  assert.ok(sp.get("a").start < sp.get("b").start && sp.get("b").start < sp.get("c").start);
  assert.notEqual(sp.get("b").ende, sp.get("c").ende);
  assert.notEqual(sp.get("b").spur, sp.get("c").spur);
  const bu = kabelSpuren(k, "buendel");
  assert.equal(bu.get("b").anzahl, 2);
  assert.equal(bu.get("c").versteckt, true);
  assert.equal(bu.get("a").start, 0);
  const pa = kabelSpuren(k, "paare");
  assert.equal(pa.get("a").start, 0);
  assert.equal(pa.get("b").start, -pa.get("c").start);
});
